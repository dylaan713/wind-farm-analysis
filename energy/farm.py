"""The farm: each turbine's waked wind speed, farm power, the direction x speed table, and hourly
and monthly energy.

Every formula here is written out in the energy plan under "The model, exactly".
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from energy.geometry import along_across
from energy.turbine import Turbine, power_kw, thrust_coefficient
from energy.wake import K_DEFAULT, deficit, overlap_fraction

DIR_STEP = 5.0                        # 72 bins centred on 0, 5, ..., 355
DIRECTIONS = np.arange(0.0, 360.0, DIR_STEP)
SPEED_STEP = 0.5
SPEEDS = np.arange(0.0, 30.5, SPEED_STEP)   # 61 speeds


def _wake_geometry(x, y, wind_from_deg: float, r0: float, k: float) -> tuple[np.ndarray, np.ndarray]:
    """Everything about the wakes that depends on the layout and the direction but not the speed.

    Returns the turbines' order from most upwind to most downwind, and `reach[i, j]`: the effect
    turbine j's wake would have on turbine i if j's thrust coefficient were 1 (the deficit at
    that distance times the share of i's rotor the wake covers). The real effect is
    `(1 - sqrt(1 - Ct_j)) * reach[i, j]`, because the Jensen deficit is that factor times a
    term that only depends on distance. 0 wherever j is not upwind of i.
    """
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    if x.shape != y.shape or x.ndim != 1:
        raise ValueError(f"x and y must be two lists of the same length, got {x.shape} and {y.shape}")
    along, across = along_across(x, y, wind_from_deg)
    n = len(x)
    reach = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            if along[i, j] > 0.0:
                covered = overlap_fraction(r0, r0 + k * along[i, j], across[i, j])
                if covered > 0.0:
                    reach[i, j] = covered * deficit(1.0, along[i, j], r0, k)
    theta = np.radians(wind_from_deg)
    downwind = -x * np.sin(theta) - y * np.cos(theta)
    return np.argsort(downwind, kind="stable"), reach


def _walk_downwind(t: Turbine, order: np.ndarray, reach: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Waked speed at each turbine for each free-stream speed in `v`: shape (turbines, speeds).
    Turbines are taken from most upwind to most downwind, so every wake that reaches a turbine
    has already been given its strength, at the thrust of the turbine's own waked speed."""
    n = len(order)
    speeds = np.empty((n, len(v)))
    strength = np.zeros((n, len(v)))          # 1 - sqrt(1 - Ct) for the turbines done so far
    for i in order:
        total = np.sqrt(np.sum((reach[i][:, None] * strength) ** 2, axis=0))
        # Root-sum-square of many close wakes can pass 1; the air cannot blow backwards.
        speeds[i] = v * (1.0 - np.minimum(total, 1.0))
        strength[i] = 1.0 - np.sqrt(1.0 - thrust_coefficient(t, speeds[i]))
    return speeds


def turbine_speeds(t: Turbine, x, y, wind_from_deg: float, v: float, k: float = K_DEFAULT) -> np.ndarray:
    """Wind speed at each turbine, in the order given, when the free wind is `v` m/s from
    `wind_from_deg`."""
    order, reach = _wake_geometry(x, y, wind_from_deg, t.rotor_diameter_m / 2, k)
    return _walk_downwind(t, order, reach, np.array([float(v)]))[:, 0]


def farm_power_kw(t: Turbine, x, y, wind_from_deg: float, v: float, k: float = K_DEFAULT) -> float:
    return float(np.sum(power_kw(t, turbine_speeds(t, x, y, wind_from_deg, v, k))))


def power_table(t: Turbine, x, y, k: float = K_DEFAULT) -> np.ndarray:
    """Farm power in kW for every direction bin (rows) and every speed in SPEEDS (columns)."""
    table = np.empty((len(DIRECTIONS), len(SPEEDS)))
    for row, direction in enumerate(DIRECTIONS):
        order, reach = _wake_geometry(x, y, float(direction), t.rotor_diameter_m / 2, k)
        table[row] = np.sum(power_kw(t, _walk_downwind(t, order, reach, SPEEDS)), axis=0)
    return table


def gross_table(t: Turbine, n_turbines: int) -> np.ndarray:
    """Farm power in kW at every speed in SPEEDS with no wakes at all."""
    return n_turbines * power_kw(t, SPEEDS)


def hourly_power_kw(table: np.ndarray, wind_from_deg, v_eq) -> np.ndarray:
    """Look each hour up in a power table: the nearest direction bin, linear between speeds.
    An hour with a missing direction or speed stays missing. Speeds past the end of the table
    use its last column."""
    direction = np.asarray(wind_from_deg, dtype=float)
    speed = np.asarray(v_eq, dtype=float)
    missing = np.isnan(direction) | np.isnan(speed)

    n_dirs = table.shape[0]
    row = np.floor(np.mod(np.where(missing, 0.0, direction), 360.0) / DIR_STEP + 0.5).astype(int) % n_dirs
    place = np.clip(np.where(missing, 0.0, speed), SPEEDS[0], SPEEDS[-1]) / SPEED_STEP
    low = np.minimum(np.floor(place).astype(int), len(SPEEDS) - 1)
    high = np.minimum(low + 1, len(SPEEDS) - 1)
    share = place - low
    power = table[row, low] * (1.0 - share) + table[row, high] * share
    return np.where(missing, np.nan, power)


def monthly_mwh(hourly_kw: pd.Series) -> pd.Series:
    """Energy per calendar month, indexed by the month's first day. Each hour of kW is that many
    kWh. Missing hours add nothing (they are not zeros: see `coverage`); a month with no hours
    at all is missing."""
    return hourly_kw.resample("MS").sum(min_count=1) / 1000.0


def coverage(hourly_kw: pd.Series) -> pd.Series:
    """Share of each calendar month's hours that have a value. An hour that is NaN and an hour
    that is absent from the index both count as missing."""
    present = hourly_kw.resample("MS").count()
    return present / (present.index.days_in_month * 24)
