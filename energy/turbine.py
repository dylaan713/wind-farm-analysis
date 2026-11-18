"""One turbine for one hour: wind at hub height, air density, the power curve, and thrust.

Every formula here is written out in the energy plan under "The model, exactly".
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

ALPHA = 0.14                 # shear exponent
REFERENCE_HEIGHT_M = 100.0   # the height the wind data is given at
GAS_CONSTANT = 287.05        # dry air, J/(kg K)
STANDARD_DENSITY = 1.225     # kg/m3, the density power curves are published at
BETZ = 16 / 27               # the most power any rotor can take from the wind
CT_MAX = 0.9
# Share of an ideal rotor's power that reaches the grid. Momentum theory alone treats electrical
# output as everything the rotor took from the wind, and gives thrust about a third too low.
# 0.78 is fitted to turbines that publish both curves: `uv run python -m energy.thrust_check`.
# Contains information from the Open Energy Platform wind turbine library, © Reiner Lemoine
# Institut, made available under the Open Database License (ODbL) 1.0. Only this number is
# taken from it; none of its rows are in this repo, and none may be added.
ROTOR_TO_GRID = 0.78


@dataclass(frozen=True)
class Turbine:
    model: str
    rated_kw: float
    hub_height_m: float
    rotor_diameter_m: float
    curve_v: np.ndarray          # ascending speeds, m/s
    curve_kw: np.ndarray
    cut_in: float
    cut_out: float
    curve_ct: np.ndarray | None = None


def load_turbine(csv_path: Path, hub_height_m: float, rotor_diameter_m: float) -> Turbine:
    """Read a curve file: `#` lines carry `model:` and `rated_kw:` (and the source), then the
    columns `v_ms,power_kw` and optionally `ct`."""
    header = {}
    for line in Path(csv_path).read_text().splitlines():
        if line.startswith("#") and ":" in line:
            key, value = line[1:].split(":", 1)
            header[key.strip()] = value.strip()
    if "model" not in header or "rated_kw" not in header:
        raise ValueError(f"{csv_path}: the header needs '# model:' and '# rated_kw:' lines")

    table = pd.read_csv(csv_path, comment="#")
    v = table["v_ms"].to_numpy(dtype=float)
    kw = table["power_kw"].to_numpy(dtype=float)
    if len(v) < 2 or np.any(np.diff(v) <= 0):
        raise ValueError(f"{csv_path}: speeds must be in ascending order with no repeats")
    if np.any(kw < 0):
        raise ValueError(f"{csv_path}: negative power in the curve")

    rising = np.flatnonzero(kw > 0)
    if len(rising) == 0:
        raise ValueError(f"{csv_path}: the curve never produces power")
    cut_in = float(v[max(rising[0] - 1, 0)])     # the last speed with zero power before the rise
    ct = table["ct"].to_numpy(dtype=float) if "ct" in table.columns else None
    return Turbine(
        model=header["model"], rated_kw=float(header["rated_kw"]),
        hub_height_m=float(hub_height_m), rotor_diameter_m=float(rotor_diameter_m),
        curve_v=v, curve_kw=kw, cut_in=cut_in, cut_out=float(v[-1]), curve_ct=ct,
    )


def hub_speed(v_100, hub_height_m: float, alpha: float = ALPHA):
    """Wind speed at hub height from the speed at 100 m, by the power law."""
    return v_100 * (hub_height_m / REFERENCE_HEIGHT_M) ** alpha


def air_density(pressure_pa, temp_k):
    return pressure_pa / (GAS_CONSTANT * temp_k)


def equivalent_speed(v, rho):
    """The speed that carries the same power at standard density."""
    return v * (rho / STANDARD_DENSITY) ** (1 / 3)


def _same_shape(result: np.ndarray, like):
    return float(result) if np.ndim(like) == 0 else result


def _running(t: Turbine, v: np.ndarray) -> np.ndarray:
    return (v >= t.cut_in) & (v < t.cut_out)


def power_kw(t: Turbine, v):
    """Power at speed v: linear between curve points, 0 below cut-in and at or above cut-out,
    never above the rating. A missing speed gives a missing power."""
    speeds = np.asarray(v, dtype=float)
    p = np.clip(np.interp(speeds, t.curve_v, t.curve_kw), 0.0, t.rated_kw)
    p = np.where(np.isnan(speeds), np.nan, np.where(_running(t, speeds), p, 0.0))
    return _same_shape(p, v)


def _ct_from_cp(cp: np.ndarray) -> np.ndarray:
    """Momentum theory: solve Cp = 4a(1-a)^2 for a in [0, 1/3] by bisection, then Ct = 4a(1-a)."""
    cp = np.clip(cp, 0.0, BETZ)
    lo, hi = np.zeros_like(cp), np.full_like(cp, 1 / 3)
    for _ in range(60):                       # 4a(1-a)^2 rises all the way across [0, 1/3]
        mid = (lo + hi) / 2
        low = 4 * mid * (1 - mid) ** 2 < cp
        lo, hi = np.where(low, mid, lo), np.where(low, hi, mid)
    a = (lo + hi) / 2
    return np.where(cp > 0, np.minimum(4 * a * (1 - a), CT_MAX), 0.0)


def ct_from_cp(cp: float) -> float:
    return float(_ct_from_cp(np.asarray(cp, dtype=float)))


def ct_from_power(kw, v, rotor_diameter_m: float, efficiency: float = ROTOR_TO_GRID) -> np.ndarray:
    """Thrust derived from electrical power. The power an ideal rotor would have had to take from
    the wind is the electrical power divided by `efficiency`; momentum theory gives the thrust
    that goes with it. 0 where there is no power or no wind."""
    power_w = np.asarray(kw, dtype=float) * 1000.0
    speeds = np.asarray(v, dtype=float)
    swept = np.pi * (rotor_diameter_m / 2) ** 2
    live = (power_w > 0) & (speeds > 0)
    with np.errstate(divide="ignore", invalid="ignore"):
        cp = np.where(live, power_w / (0.5 * STANDARD_DENSITY * swept * speeds**3), 0.0)
    return np.where(live, _ct_from_cp(cp / efficiency), 0.0)


def thrust_coefficient(t: Turbine, v):
    """Ct at speed v: the published curve if the turbine has one, otherwise derived from the
    power curve. 0 whenever the turbine is not running."""
    speeds = np.asarray(v, dtype=float)
    if t.curve_ct is not None:
        ct = np.where(_running(t, speeds), np.interp(speeds, t.curve_v, t.curve_ct), 0.0)
        return _same_shape(ct, v)
    return _same_shape(ct_from_power(power_kw(t, speeds), speeds, t.rotor_diameter_m), v)
