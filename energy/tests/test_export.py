"""The result files, and the whole run on a made-up farm with made-up wind (no network)."""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from energy.export import (
    MAX_FILE_BYTES, contract, energy_cases, layout, power_curve, validation_monthly, wind_rose,
    write_all,
)
from energy.farm import farm_power_kw
from energy.geometry import along_across
from energy.run import compute, summary

CURVE_FILE = Path("data/turbines/vestas-v110-2.0.csv")
FIRST, LAST = 2018, 2023

CONTRACT_KEYS = {
    "model_version": None, "generated": None,
    "farm": {"name", "eia_plant_id", "state", "capacity_mw", "turbine_count", "turbine_model",
             "hub_height_m", "rotor_diameter_m"},
    "energy_mwh": {"p50", "p75", "p90", "p99"},
    "energy_mwh_10yr": {"p50", "p75", "p90", "p99"},
    "monthly_shape": None, "wake_loss_pct": None,
    "blind": {"assumed_losses_pct", "error_pct", "months_used"},
    "calibration": {"factor", "note"},
    "uncertainty": {"sigma_iav", "sigma_model"},
    "validation": {"calibration_years", "holdout_year", "annual_error_pct", "monthly_mape_pct",
                   "r2", "excluded_months"},
    "assumptions": {"alpha", "wake_k", "wind_source"},
}


def made_up_farm() -> pd.DataFrame:
    """Twelve turbines in three rows of four, 500 m apart, somewhere flat."""
    east, north = np.meshgrid(np.arange(4) * 500.0, np.arange(3) * 500.0)
    return pd.DataFrame({
        "eia_id": 99999, "p_name": "Made-Up Ridge", "t_state": "MN", "t_cap": 2000,
        "t_hh": 80.0, "t_rd": 110.0,
        "xlong": -95.0 + east.ravel() / (111195.08 * np.cos(np.radians(45.0))),
        "ylat": 45.0 + north.ravel() / 111195.08,
    })


def made_up_wind() -> pd.DataFrame:
    hours = pd.date_range(f"{FIRST}-01-01", f"{LAST}-12-31 23:00", freq="h", tz="UTC", name="time")
    rng = np.random.default_rng(7)
    windier_in_winter = 1.0 + 0.2 * np.cos((hours.day_of_year.to_numpy() - 15) / 365.25 * 2 * np.pi)
    year_to_year = 1.0 + 0.04 * np.sin(hours.year.to_numpy() * 2.3)
    wind = pd.DataFrame({
        "speed_100m": rng.weibull(2.0, len(hours)) * 8.5 * windier_in_winter * year_to_year,
        "dir_100m": rng.uniform(0.0, 360.0, len(hours)),
        "temp_k": 280.0, "pressure_pa": 97000.0,
    }, index=hours)
    wind.iloc[100:103, 0] = np.nan            # three hours with no speed
    wind.iloc[5000, 1] = np.nan               # one with no direction
    return wind


def made_up_generation(net_mwh) -> pd.DataFrame:
    months = pd.period_range(f"{FIRST}-01", f"{LAST}-12", freq="M")
    return pd.DataFrame({"month": months, "net_mwh": net_mwh, "reported_monthly": True})


@pytest.fixture(scope="module")
def results():
    farm_rows, wind = made_up_farm(), made_up_wind()
    # First pass only to learn what the model makes of each month; then the farm "reports" 90% of it.
    first = compute(farm_rows, CURVE_FILE, wind, made_up_generation(5000.0), LAST, "2026-11-16")
    reported = first.validation.table["modelled_mwh"].to_numpy() * 0.9
    return compute(farm_rows, CURVE_FILE, wind, made_up_generation(reported), LAST, "2026-11-16")


def test_the_whole_run_recovers_what_was_put_in(results):
    v = results.validation
    assert v.calibration_factor == pytest.approx(0.9)
    assert v.annual_error_pct == pytest.approx(0.0, abs=1e-6)
    assert v.excluded_months == []
    assert results.sigma_model == pytest.approx(0.03)            # the floor
    assert 0.0 < results.sigma_iav < 0.2
    assert 0.0 < results.wake_loss_pct < 30.0
    yearly_modelled = v.table.assign(year=v.table["month"].str[:4]).groupby("year")["modelled_mwh"].sum()
    assert results.one_year.p50 == pytest.approx(0.9 * yearly_modelled.mean(), rel=0.01)
    assert "Made-Up Ridge" in summary(results)


def test_contract_has_every_key(results):
    c = contract(results)
    assert set(c) == set(CONTRACT_KEYS)
    for key, inner in CONTRACT_KEYS.items():
        if inner is not None:
            assert set(c[key]) == inner, key
    assert c["farm"] == {
        "name": "Made-Up Ridge", "eia_plant_id": 99999, "state": "MN", "capacity_mw": 24.0,
        "turbine_count": 12, "turbine_model": "Vestas V110-2.0", "hub_height_m": 80.0,
        "rotor_diameter_m": 110.0,
    }
    assert c["blind"]["assumed_losses_pct"] == 13.19
    assert c["validation"]["holdout_year"] == LAST
    assert c["validation"]["calibration_years"] == list(range(FIRST, LAST))


def test_contract_p_values_are_ordered_as_the_finance_model_needs(results):
    c = contract(results)
    for block in (c["energy_mwh"], c["energy_mwh_10yr"]):
        assert block["p99"] <= block["p90"] <= block["p75"] <= block["p50"]
    assert c["energy_mwh_10yr"]["p99"] >= c["energy_mwh"]["p99"]


def test_monthly_shape_sums_to_one(results):
    shape = contract(results)["monthly_shape"]
    assert len(shape) == 12
    assert sum(shape) == pytest.approx(1.0, abs=1e-5)
    assert shape[0] > shape[6]                                   # the made-up wind is stronger in winter


def test_wind_rose_sums_to_one_and_skips_missing_hours():
    wind = pd.DataFrame({
        "dir_100m": [0.0, 359.9, 357.4, 90.0, np.nan, 180.0, 270.0],
        "v_eq":     [5.4, 5.6, 0.2, 31.7, 8.0, np.nan, 29.5],
    })
    rose = wind_rose(wind)
    freq = np.array(rose["freq"])
    assert freq.shape == (72, 31) and (rose["dir_step"], rose["speed_step"]) == (5, 1)
    assert rose["hours"] == 5
    assert freq.sum() == pytest.approx(1.0)
    assert freq[0, 5] == pytest.approx(0.2)      # 0.0 degrees at 5.4 m/s
    assert freq[0, 6] == pytest.approx(0.2)      # 359.9 wraps to the bin centred on 0; 5.6 rounds to 6
    assert freq[71, 0] == pytest.approx(0.2)     # 357.4 belongs to the bin centred on 355
    assert freq[18, 30] == pytest.approx(0.2)    # faster than the table goes: the last speed bin
    assert freq[54, 30] == pytest.approx(0.2)    # 29.5 rounds up to 30


def test_wind_rose_refuses_wind_with_nothing_in_it():
    with pytest.raises(ValueError):
        wind_rose(pd.DataFrame({"dir_100m": [np.nan], "v_eq": [np.nan]}))


def test_validation_monthly_lists_every_month(results):
    doc = validation_monthly(results.validation)
    assert len(doc["months"]) == 12 * (LAST - FIRST + 1)
    first = doc["months"][0]
    assert set(first) == {"month", "modelled_mwh", "blind_mwh", "calibrated_mwh", "reported_mwh", "used_for"}
    assert first["calibrated_mwh"] == pytest.approx(first["reported_mwh"], abs=0.2)
    assert first["blind_mwh"] == pytest.approx(first["modelled_mwh"] * (1 - 0.131936), abs=0.2)


def test_energy_cases_cover_what_the_typescript_version_must_match(results):
    cases = energy_cases(results.turbine, results.x, results.y)
    assert len(cases["turbine"]) == 20 and len(cases["farm"]) == 20
    assert cases["turbine"][0]["v"] == 0.0 and cases["turbine"][-1]["v"] == 30.0
    assert len(cases["layout"]) == 12 and len(cases["farm"][0]["turbine_speeds"]) == 12
    directions = {c["wind_from_deg"] for c in cases["farm"]}
    assert {0.0, 359.9} <= directions
    # One direction blows straight down a pair of turbines: some pair has no crosswind offset.
    in_line = cases["farm"][4]["wind_from_deg"]
    along, across = along_across(results.x, results.y, in_line)
    assert np.any((along > 0) & (across < 0.5))
    case = cases["farm"][5]
    assert case["farm_power_kw"] == pytest.approx(
        farm_power_kw(results.turbine, results.x, results.y, case["wind_from_deg"], case["v"]))
    assert cases["spec"]["curve_ct"] is None and "BSD 3-Clause" in cases["notice"]


def test_layout_and_power_curve(results):
    assert len(layout(results)["turbines"]) == 12
    curve = power_curve(results.turbine)
    assert len(curve["v_ms"]) == len(curve["power_kw"]) == len(curve["ct"])
    assert max(curve["power_kw"]) == 2000.0 and "BSD 3-Clause" in curve["notice"]


def test_result_files_are_small(results, tmp_path):
    written = write_all(results, tmp_path / "results", tmp_path / "fixtures")
    assert sorted(p.name for p in written) == [
        "energy-cases.json", "energy-contract.json", "layout.json", "power-curve.json",
        "validation-monthly.json", "wind-rose.json",
    ]
    for path in written:
        assert path.stat().st_size < MAX_FILE_BYTES, path.name
        json.loads(path.read_text(), parse_constant=lambda bad: pytest.fail(f"{path.name} holds {bad}"))
    assert not list(tmp_path.rglob("*.part"))
