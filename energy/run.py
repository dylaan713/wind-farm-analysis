"""One command from the public data to every result file: `uv run python -m energy.run`.

Downloads are cached in data/raw/, so only the first run uses the network.
"""
from __future__ import annotations

import datetime as dt
from pathlib import Path

import numpy as np
import pandas as pd

from energy import download
from energy.export import Results, write_all
from energy.farm import coverage, gross_table, hourly_power_kw, monthly_mwh, power_table
from energy.geometry import to_local_m
from energy.turbine import Turbine, air_density, equivalent_speed, hub_speed, load_turbine
from energy.uncertainty import p_values, sigmas
from energy.validate import MIN_COVERAGE, validate, yearly_errors_pct

EIA_PLANT_ID = 58692                      # Black Oak Getty, MN (docs/farm-selection.md)
CURVE_FILE = Path("data/turbines/vestas-v110-2.0.csv")
LONG_TERM_FIRST_YEAR = 2000               # the long-term series runs from here
REPORT_FIRST_YEAR = 2018                  # the first full year the farm reported
HOLDOUT_YEAR = 2025                       # the most recent full year


def _one_value(rows: pd.DataFrame, column: str):
    values = rows[column].unique()
    if len(values) != 1:
        raise ValueError(f"the farm's turbines disagree on {column}: {list(values)}")
    return values[0]


def compute(
    farm_rows: pd.DataFrame, curve_file: Path, wind: pd.DataFrame, generation: pd.DataFrame,
    holdout_year: int, generated: str,
) -> Results:
    """The whole model, with no downloading: `farm_rows` are the farm's rows of the turbine
    database, `wind` is hourly from the first long-term year to the end of the held-out year,
    and `generation` is the farm's monthly reported output."""
    lon0, lat0 = float(farm_rows["xlong"].mean()), float(farm_rows["ylat"].mean())
    x, y = to_local_m(farm_rows["xlong"], farm_rows["ylat"], lon0, lat0)
    count = len(farm_rows)
    capacity_mw = float(farm_rows["t_cap"].sum()) / 1000.0
    turbine: Turbine = load_turbine(
        curve_file, float(_one_value(farm_rows, "t_hh")), float(_one_value(farm_rows, "t_rd")))
    if abs(turbine.rated_kw - float(_one_value(farm_rows, "t_cap"))) > 1e-6:
        raise ValueError(f"the curve file is for {turbine.rated_kw} kW turbines, the farm's are {_one_value(farm_rows, 't_cap')} kW")

    wind = wind.copy()
    wind["v_eq"] = equivalent_speed(
        hub_speed(wind["speed_100m"], turbine.hub_height_m), air_density(wind["pressure_pa"], wind["temp_k"]))
    direction, speed = wind["dir_100m"].to_numpy(), wind["v_eq"].to_numpy()
    waked_kw = pd.Series(hourly_power_kw(power_table(turbine, x, y), direction, speed), index=wind.index)
    no_wakes = np.tile(gross_table(turbine, count), (72, 1))
    gross_kw = pd.Series(hourly_power_kw(no_wakes, direction, speed), index=wind.index)

    monthly = monthly_mwh(waked_kw)
    monthly.index = monthly.index.tz_localize(None).to_period("M")
    share_present = coverage(waked_kw)
    share_present.index = monthly.index

    reported = generation.set_index("month")
    v = validate(
        monthly.reindex(reported.index), reported["net_mwh"], share_present.reindex(reported.index),
        holdout_year, reported["reported_monthly"], capacity_mw)

    # Long term: every full year, today's layout, the calibration factor. A year with too much
    # wind data missing would read low, so it stops the run instead of being filled or dropped.
    yearly_hours = waked_kw.groupby(waked_kw.index.year).agg(["sum", "count", "size"])
    thin = yearly_hours.index[yearly_hours["count"] < MIN_COVERAGE * yearly_hours["size"]]
    if len(thin):
        raise ValueError(f"wind data is more than 2% missing in {list(thin)}")
    yearly_net = yearly_hours["sum"] / 1000.0 * v.calibration_factor
    sigma_iav, sigma_model = sigmas(yearly_net, yearly_errors_pct(v))
    p50 = float(yearly_net.mean())

    by_month = monthly.groupby(monthly.index.month).sum()
    return Results(
        farm={
            "name": str(_one_value(farm_rows, "p_name")), "eia_plant_id": int(_one_value(farm_rows, "eia_id")),
            "state": str(_one_value(farm_rows, "t_state")), "capacity_mw": capacity_mw, "turbine_count": count,
            "turbine_model": turbine.model, "hub_height_m": turbine.hub_height_m,
            "rotor_diameter_m": turbine.rotor_diameter_m,
        },
        turbine=turbine, x=x, y=y, wind=wind, validation=v,
        one_year=p_values(p50, sigma_iav, sigma_model),
        ten_year=p_values(p50, sigma_iav, sigma_model, years=10),
        sigma_iav=sigma_iav, sigma_model=sigma_model,
        monthly_shape=[float(s) for s in by_month / by_month.sum()],
        wake_loss_pct=float((1.0 - waked_kw.sum() / gross_kw.sum()) * 100.0),
        generated=generated,
    )


def summary(r: Results) -> str:
    v, one, ten = r.validation, r.one_year, r.ten_year
    return "\n".join([
        f"{r.farm['name']}: {r.farm['turbine_count']} x {r.farm['turbine_model']}, {r.farm['capacity_mw']} MW",
        f"A. Blind: {v.blind_error_pct:+.2f}% against {v.blind_months} reported months "
        f"(assumed losses {v.assumed_losses * 100:.2f}%)",
        f"B. Calibrated on {v.calibration_years[0]} to {v.calibration_years[-1]} (factor {v.calibration_factor:.4f}), "
        f"tested on {v.holdout_year}: annual error {v.annual_error_pct:+.2f}%, "
        f"monthly mean absolute error {v.monthly_mape_pct:.2f}%, R2 {v.r2:.3f}",
        f"Excluded months: {v.excluded_months or 'none'}",
        f"Wake loss {r.wake_loss_pct:.2f}%; year-to-year sigma {r.sigma_iav:.4f}; model sigma {r.sigma_model:.4f}",
        f"One year, MWh:   P50 {one.p50:,.0f}  P75 {one.p75:,.0f}  P90 {one.p90:,.0f}  P99 {one.p99:,.0f}",
        f"Ten years, MWh:  P50 {ten.p50:,.0f}  P75 {ten.p75:,.0f}  P90 {ten.p90:,.0f}  P99 {ten.p99:,.0f}",
    ])


def main() -> None:
    turbines = download.turbines()
    farm_rows = turbines[turbines["eia_id"] == EIA_PLANT_ID]
    if farm_rows.empty:
        raise ValueError(f"plant {EIA_PLANT_ID} is not in the turbine database")
    lat0, lon0 = round(float(farm_rows["ylat"].mean()), 4), round(float(farm_rows["xlong"].mean()), 4)
    wind = download.wind(lat0, lon0, LONG_TERM_FIRST_YEAR, HOLDOUT_YEAR)
    generation = download.generation(EIA_PLANT_ID, list(range(REPORT_FIRST_YEAR, HOLDOUT_YEAR + 1)))
    results = compute(farm_rows, CURVE_FILE, wind, generation, HOLDOUT_YEAR, dt.date.today().isoformat())
    print(summary(results))
    for path in write_all(results):
        print(f"wrote {path} ({path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
