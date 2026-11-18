"""Writes the result files the finance model and the site read, and the fixtures the TypeScript
version of the model is checked against.

The shape of `energy-contract.json` is fixed in the energy plan under "Contract 1".
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from energy.farm import DIR_STEP, DIRECTIONS, farm_power_kw, turbine_speeds
from energy.turbine import ALPHA, Turbine, power_kw, thrust_coefficient
from energy.uncertainty import PValues
from energy.validate import Validation
from energy.wake import K_DEFAULT

MODEL_VERSION = "1.0.0"
WIND_SOURCE = "ERA5 via Open-Meteo"
CALIBRATION_NOTE = "absorbs real losses and model and wind-data bias; not a loss figure"
ROSE_SPEED_STEP = 1.0
ROSE_TOP_SPEED = 30.0
MAX_FILE_BYTES = 200_000
# The power curve is a row of the System Advisor Model's turbine library; its licence asks that
# the notice travels with every copy, so it is written into each file that carries the curve.
CURVE_NOTICE = (
    "Power curve from the System Advisor Model (SAM) wind turbine library, github.com/NREL/SAM, "
    "BSD 3-Clause, Copyright (c) 2017, 2022 Alliance for Energy Innovation, LLC. "
    "Full notice in data/turbines/NOTICE.md. Thrust is derived in energy/turbine.py."
)


@dataclass(frozen=True)
class Results:
    """Everything one run of the model produced, ready to be written out."""
    farm: dict                 # the "farm" block of the contract
    turbine: Turbine
    x: np.ndarray              # local metres east of the farm's centre
    y: np.ndarray              # local metres north
    wind: pd.DataFrame         # hourly, with `dir_100m` and `v_eq` (hub height, density-corrected)
    validation: Validation
    one_year: PValues
    ten_year: PValues
    sigma_iav: float
    sigma_model: float
    monthly_shape: list[float]
    wake_loss_pct: float
    generated: str             # the date of the run, YYYY-MM-DD


def _p_block(p: PValues) -> dict:
    return {"p50": round(p.p50), "p75": round(p.p75), "p90": round(p.p90), "p99": round(p.p99)}


def contract(r: Results) -> dict:
    """What the finance model and the site receive: exactly the keys of "Contract 1"."""
    v = r.validation
    return {
        "model_version": MODEL_VERSION,
        "generated": r.generated,
        "farm": dict(r.farm),
        "energy_mwh": _p_block(r.one_year),
        "energy_mwh_10yr": _p_block(r.ten_year),
        "monthly_shape": [round(share, 6) for share in r.monthly_shape],
        "wake_loss_pct": round(r.wake_loss_pct, 2),
        "blind": {
            "assumed_losses_pct": round(v.assumed_losses * 100.0, 2),
            "error_pct": round(v.blind_error_pct, 2),
            "months_used": v.blind_months,
        },
        "calibration": {"factor": round(v.calibration_factor, 4), "note": CALIBRATION_NOTE},
        "uncertainty": {"sigma_iav": round(r.sigma_iav, 4), "sigma_model": round(r.sigma_model, 4)},
        "validation": {
            "calibration_years": list(v.calibration_years),
            "holdout_year": v.holdout_year,
            "annual_error_pct": round(v.annual_error_pct, 2),
            "monthly_mape_pct": round(v.monthly_mape_pct, 2),
            "r2": round(v.r2, 3),
            "excluded_months": list(v.excluded_months),
        },
        "assumptions": {"alpha": ALPHA, "wake_k": K_DEFAULT, "wind_source": WIND_SOURCE},
    }


def validation_monthly(v: Validation) -> dict:
    """Every month that was compared: what the model made of it and what the farm reported.
    `blind_mwh` is the modelled energy less the assumed losses; `calibrated_mwh` is the modelled
    energy times the calibration factor."""
    months = [
        {
            "month": row.month,
            "modelled_mwh": None if pd.isna(row.modelled_mwh) else round(row.modelled_mwh, 1),
            "blind_mwh": None if pd.isna(row.modelled_mwh) else round(row.modelled_mwh * (1.0 - v.assumed_losses), 1),
            "calibrated_mwh": None if pd.isna(row.modelled_mwh) else round(row.modelled_mwh * v.calibration_factor, 1),
            "reported_mwh": round(row.reported_mwh, 1),
            "used_for": row.used_for,
        }
        for row in v.table.itertuples()
    ]
    return {
        "calibration_factor": round(v.calibration_factor, 4),
        "assumed_losses_pct": round(v.assumed_losses * 100.0, 2),
        "holdout_year": v.holdout_year,
        "months": months,
    }


def wind_rose(wind: pd.DataFrame) -> dict:
    """How often the wind comes from each direction at each speed: 72 direction bins centred on
    0, 5, ..., 355 degrees by 31 speed bins centred on 0, 1, ..., 30 m/s (the last also holds
    everything faster). The shares sum to 1. Hours with no direction or no speed are left out.
    The speed is `v_eq`, the one the power table is looked up with."""
    known = wind[["dir_100m", "v_eq"]].dropna()
    if known.empty:
        raise ValueError("no hour has both a wind direction and a speed")
    n_dirs = len(DIRECTIONS)
    n_speeds = int(ROSE_TOP_SPEED / ROSE_SPEED_STEP) + 1
    row = np.floor(np.mod(known["dir_100m"].to_numpy(), 360.0) / DIR_STEP + 0.5).astype(int) % n_dirs
    col = np.clip(np.floor(known["v_eq"].to_numpy() / ROSE_SPEED_STEP + 0.5).astype(int), 0, n_speeds - 1)
    counts = np.zeros((n_dirs, n_speeds))
    np.add.at(counts, (row, col), 1.0)
    return {
        "dir_step": int(DIR_STEP),
        "speed_step": int(ROSE_SPEED_STEP),
        "speed": "at hub height, corrected for air density",
        "hours": int(len(known)),
        "mean_speed_ms": round(float(known["v_eq"].mean()), 3),
        "freq": np.round(counts / counts.sum(), 7).tolist(),
    }


def layout(r: Results) -> dict:
    return {
        "units": "metres east (x) and north (y) of the farm's centre",
        "rotor_diameter_m": r.turbine.rotor_diameter_m,
        "turbines": [{"x": round(float(a), 1), "y": round(float(b), 1)} for a, b in zip(r.x, r.y)],
    }


def power_curve(t: Turbine) -> dict:
    return {
        "model": t.model,
        "rated_kw": t.rated_kw,
        "cut_in_ms": t.cut_in,
        "cut_out_ms": t.cut_out,
        "v_ms": [float(v) for v in t.curve_v],
        "power_kw": [float(p) for p in power_kw(t, t.curve_v)],
        "ct": [round(float(c), 4) for c in thrust_coefficient(t, t.curve_v)],
        "notice": CURVE_NOTICE,
    }


def _row_direction(x: np.ndarray, y: np.ndarray) -> float:
    """A wind direction that blows straight from one turbine to its nearest neighbour."""
    if len(x) < 2:
        return 270.0
    gaps = np.hypot(x[:, None] - x[None, :], y[:, None] - y[None, :])
    np.fill_diagonal(gaps, np.inf)
    a, b = np.unravel_index(np.argmin(gaps), gaps.shape)
    # The air travels toward (-sin, -cos) of the direction it comes from.
    return float(np.degrees(np.arctan2(-(x[b] - x[a]), -(y[b] - y[a]))) % 360.0)


def energy_cases(t: Turbine, x, y) -> dict:
    """Worked answers for the TypeScript version to reproduce: the turbine, the layout, 20 cases
    of one turbine across 0 to 30 m/s, and 20 cases of the whole farm across directions and
    speeds, including 0 and 359.9 degrees and one direction straight along a pair of turbines."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    one_turbine = [
        {"v": round(float(v), 4), "power_kw": float(power_kw(t, round(float(v), 4))),
         "ct": float(thrust_coefficient(t, round(float(v), 4)))}
        for v in np.linspace(0.0, 30.0, 20)
    ]
    directions = [0.0, 359.9, round(_row_direction(x, y), 3), 45.0, 90.0, 137.5, 180.0, 222.5, 270.0, 315.0]
    whole_farm = [
        {"wind_from_deg": d, "v": v, "farm_power_kw": farm_power_kw(t, x, y, d, v),
         "turbine_speeds": [round(float(s), 6) for s in turbine_speeds(t, x, y, d, v)]}
        for d in directions for v in (6.0, 9.5)
    ]
    return {
        "notice": CURVE_NOTICE,
        "wake_k": K_DEFAULT,
        "spec": {
            "model": t.model, "rated_kw": t.rated_kw, "hub_height_m": t.hub_height_m,
            "rotor_diameter_m": t.rotor_diameter_m,
            "curve_v": [float(v) for v in t.curve_v], "curve_kw": [float(p) for p in t.curve_kw],
            "curve_ct": None if t.curve_ct is None else [float(c) for c in t.curve_ct],
            "cut_in": t.cut_in, "cut_out": t.cut_out,
        },
        "layout": [{"x": float(a), "y": float(b)} for a, b in zip(x, y)],
        "turbine": one_turbine,
        "farm": whole_farm,
    }


def _write(path: Path, content: dict) -> Path:
    text = json.dumps(content, indent=1, allow_nan=False) + "\n"
    if len(text.encode()) >= MAX_FILE_BYTES:
        raise ValueError(f"{path.name} would be {len(text.encode())} bytes; the limit is {MAX_FILE_BYTES}")
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_suffix(path.suffix + ".part")
    part.write_text(text)
    part.replace(path)
    return path


def write_all(
    r: Results, out_dir: Path = Path("data/results"), fixtures_dir: Path = Path("data/fixtures"),
) -> list[Path]:
    """Write the five result files and the fixtures file; returns the paths written."""
    out_dir, fixtures_dir = Path(out_dir), Path(fixtures_dir)
    return [
        _write(out_dir / "energy-contract.json", contract(r)),
        _write(out_dir / "validation-monthly.json", validation_monthly(r.validation)),
        _write(out_dir / "wind-rose.json", wind_rose(r.wind)),
        _write(out_dir / "layout.json", layout(r)),
        _write(out_dir / "power-curve.json", power_curve(r.turbine)),
        _write(fixtures_dir / "energy-cases.json", energy_cases(r.turbine, r.x, r.y)),
    ]
