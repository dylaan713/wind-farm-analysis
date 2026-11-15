"""Shortlist wind farms that suit a clean validation: one turbine model, built once, never
repowered, on flat ground, reporting to EIA every month, with a sensible record of output."""
from __future__ import annotations

import pandas as pd

MIN_TURBINES, MAX_TURBINES = 20, 150
LATEST_BUILD_YEAR = 2019            # leaves at least four full reported years
FLAT_STATES = ["IA", "KS", "NE", "OK", "TX", "ND", "SD", "MN", "IL", "IN"]
CF_MIN, CF_MAX = 0.20, 0.60


def candidates(turbines: pd.DataFrame) -> pd.DataFrame:
    """One row per farm that passes the tests the turbine database alone can settle."""
    rows = []
    for eia_id, g in turbines.dropna(subset=["eia_id"]).groupby("eia_id"):
        n = len(g)
        if not MIN_TURBINES <= n <= MAX_TURBINES:
            continue
        if g["p_name"].nunique() != 1 or g["t_model"].nunique(dropna=False) != 1 or g["p_year"].nunique(dropna=False) != 1:
            continue
        if g[["t_model", "p_year", "t_cap", "t_hh", "t_rd", "xlong", "ylat"]].isna().any().any():
            continue
        if g["t_cap"].nunique() != 1 or g["t_hh"].nunique() != 1 or g["t_rd"].nunique() != 1:
            continue
        if (g["t_retrofit"].fillna(0) != 0).any() or (g["t_offshore"].fillna(0) != 0).any():
            continue
        first = g.iloc[0]
        if int(first["p_year"]) > LATEST_BUILD_YEAR or first["t_state"] not in FLAT_STATES or g["t_state"].nunique() != 1:
            continue
        rows.append({
            "eia_id": int(eia_id), "p_name": first["p_name"], "t_state": first["t_state"], "p_year": int(first["p_year"]),
            "n_turbines": n, "t_manu": first["t_manu"], "t_model": first["t_model"],
            "capacity_mw": n * float(first["t_cap"]) / 1000.0,
            "hub_height_m": float(first["t_hh"]), "rotor_diameter_m": float(first["t_rd"]),
            "lon": float(g["xlong"].mean()), "lat": float(g["ylat"].mean()),
        })
    cols = ["eia_id", "p_name", "t_state", "p_year", "n_turbines", "t_manu", "t_model", "capacity_mw", "hub_height_m", "rotor_diameter_m", "lon", "lat"]
    return pd.DataFrame(rows, columns=cols).sort_values("capacity_mw", ascending=False, ignore_index=True)


def capacity_factors(generation: pd.DataFrame, capacity_mw: float) -> pd.Series:
    """Reported energy over what the farm would make flat out, for each calendar year."""
    hours = generation["month"].dt.days_in_month * 24
    by_year = generation.assign(hours=hours).groupby(generation["month"].dt.year)
    return (by_year["net_mwh"].sum() / (by_year["hours"].sum() * capacity_mw)).rename("capacity_factor")


def screen_generation(generation: pd.DataFrame, capacity_mw: float) -> str | None:
    """None if the farm's reported record is usable; otherwise the reason it is not."""
    if not generation["reported_monthly"].all():
        return "annual reporter in at least one year (monthly figures would be estimates)"
    if generation["net_mwh"].isna().any():
        return f"missing months: {int(generation['net_mwh'].isna().sum())}"
    cf = capacity_factors(generation, capacity_mw)
    bad = cf[(cf < CF_MIN) | (cf > CF_MAX)]
    if len(bad):
        return "capacity factor outside 20-60% in " + ", ".join(f"{y} ({v:.0%})" for y, v in bad.items())
    return None


def neighbours(turbines: pd.DataFrame, eia_id: int, within_km: float) -> int:
    """How many turbines that are NOT part of this farm stand within a distance of any of its turbines.

    Neighbours matter because their wakes reach the farm and the model does not include them.
    """
    import numpy as np

    t = turbines.dropna(subset=["xlong", "ylat"])
    own = (t["eia_id"] == eia_id).fillna(False).to_numpy(dtype=bool)
    ox, oy = t["xlong"].to_numpy(dtype=float)[own], t["ylat"].to_numpy(dtype=float)[own]
    nx, ny = t["xlong"].to_numpy(dtype=float)[~own], t["ylat"].to_numpy(dtype=float)[~own]
    if not len(ox) or not len(nx):
        return 0
    km_lat, km_lon = 111.195, 111.195 * np.cos(np.radians(oy.mean()))
    # Only look at turbines in a box around the farm before measuring distances.
    pad_lat, pad_lon = within_km / km_lat, within_km / km_lon
    box = (nx > ox.min() - pad_lon) & (nx < ox.max() + pad_lon) & (ny > oy.min() - pad_lat) & (ny < oy.max() + pad_lat)
    if not box.any():
        return 0
    d = np.hypot((nx[box][:, None] - ox[None, :]) * km_lon, (ny[box][:, None] - oy[None, :]) * km_lat).min(axis=1)
    return int((d < within_km).sum())
