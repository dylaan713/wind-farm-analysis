"""Check the derived thrust against turbines that publish a thrust curve.

The chosen turbine has a power curve but no published thrust curve, so its thrust is derived from
its power (`turbine.ct_from_power`). This script measures how well that derivation does on turbines
where the answer is known, and finds the one efficiency that fits them best.

    uv run python -m energy.thrust_check

It reads the Open Energy Platform wind turbine library (© Reiner Lemoine Institut, Open Database
License 1.0). The library is downloaded to the git-ignored cache and never committed; only the
fitted number and the error figures are taken from it.
"""
from __future__ import annotations

import json

import numpy as np

from energy import download
from energy.turbine import ROTOR_TO_GRID, ct_from_power

LIBRARY_URL = "https://openenergyplatform.org/api/v0/schema/supply/tables/wind_turbine_library/rows/"  # checked 2026-11-15
LIBRARY_FILE = download.RAW / "oep_wind_turbine_library.json"
SPEEDS = np.arange(4.0, 16.5, 1.0)          # m/s; from just above cut-in to past rated speed
EFFICIENCIES = np.arange(0.60, 1.0001, 0.005)
HELD_OUT_MAKER = "Vestas"                   # the chosen turbine's maker: fitted without, tested on


def parse_library(rows: list[dict]) -> tuple[list[dict], list[str]]:
    """Turbines that have both a power curve and a thrust curve, and the names of rows that claim
    both but cannot be read."""
    kept, skipped = [], []
    for row in rows:
        if not (row.get("has_power_curve") and row.get("has_ct_curve")):
            continue
        try:
            v, kw, ct_v, ct = (np.array(json.loads(row[key]), dtype=float) for key in (
                "power_curve_wind_speeds", "power_curve_values",
                "thrust_coefficient_curve_wind_speeds", "thrust_coefficient_curve_values"))
            if len(v) != len(kw) or len(ct_v) != len(ct) or len(v) < 2:
                raise ValueError("curve lengths differ")
            diameter = float(row["rotor_diameter"])
        except (TypeError, ValueError, KeyError):
            skipped.append(str(row.get("name")))
            continue
        kept.append({"maker": str(row.get("manufacturer")), "name": str(row.get("name")),
                     "rotor_diameter_m": diameter, "v": v, "kw": kw, "ct_v": ct_v, "ct": ct})
    return kept, skipped


def ct_error(turbines: list[dict], efficiency: float, speeds: np.ndarray = SPEEDS) -> np.ndarray:
    """Derived thrust minus published thrust: one row per turbine, one column per speed."""
    rows = []
    for t in turbines:
        derived = ct_from_power(np.interp(speeds, t["v"], t["kw"]), speeds, t["rotor_diameter_m"], efficiency)
        rows.append(derived - np.interp(speeds, t["ct_v"], t["ct"]))
    return np.array(rows)


def fit_efficiency(turbines: list[dict], speeds: np.ndarray = SPEEDS) -> float:
    """The efficiency with the smallest mean absolute thrust error."""
    if not turbines:
        raise ValueError("no turbines to fit")
    errors = [np.abs(ct_error(turbines, e, speeds)).mean() for e in EFFICIENCIES]
    return float(EFFICIENCIES[int(np.argmin(errors))])


def library(force: bool = False) -> tuple[list[dict], list[str]]:
    path = download.fetch(LIBRARY_URL, LIBRARY_FILE, force=force)
    return parse_library(json.loads(path.read_text()))


def main() -> None:
    turbines, skipped = library()
    others = [t for t in turbines if t["maker"] != HELD_OUT_MAKER]
    held_out = [t for t in turbines if t["maker"] == HELD_OUT_MAKER]
    fitted = fit_efficiency(others)
    print(f"{len(turbines)} turbines with both curves; unreadable rows skipped: {skipped or 'none'}")
    print(f"fitted on {len(others)} turbines from other makers: efficiency {fitted:.3f}")
    print(f"fitted on all {len(turbines)}: {fit_efficiency(turbines):.3f}; the model uses {ROTOR_TO_GRID}")
    print(f"tested on {len(held_out)} {HELD_OUT_MAKER} turbines, thrust coefficient, {SPEEDS[0]:.0f} to {SPEEDS[-1]:.0f} m/s:")
    for label, efficiency in (("no correction", 1.0), (f"efficiency {ROTOR_TO_GRID}", ROTOR_TO_GRID)):
        error = ct_error(held_out, efficiency)
        print(f"  {label:16} mean absolute error {np.abs(error).mean():.3f}, mean error {error.mean():+.3f}")
    print("  mean error by speed, with the correction:")
    for speed, e in zip(SPEEDS, ct_error(held_out, ROTOR_TO_GRID).mean(axis=0)):
        print(f"    {speed:4.0f} m/s  {e:+.3f}")


if __name__ == "__main__":
    main()
