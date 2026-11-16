"""Calibration on earlier years and the test on a held-out year, on made-up series."""
import numpy as np
import pandas as pd
import pytest

from energy.validate import (
    ASSUMED_LOSSES, LOSS_AVAILABILITY, LOSS_ELECTRICAL, LOSS_ENVIRONMENTAL,
    LOSS_TURBINE_PERFORMANCE, usable_months, validate,
)

NAMEPLATE_MW = 78.0
HOLDOUT = 2022


def series(first_year: int = 2018, last_year: int = 2022, ratio: float = 0.85):
    """Modelled, reported (= ratio x modelled), coverage and the monthly-reporter flag."""
    months = pd.period_range(f"{first_year}-01", f"{last_year}-12", freq="M")
    # Windier in winter, and a little different each year, so no two months are alike.
    modelled = pd.Series(
        20000.0 + 5000.0 * np.cos((months.month - 1) / 12 * 2 * np.pi) + 150.0 * (months.year - first_year),
        index=months,
    )
    return (modelled, modelled * ratio, pd.Series(1.0, index=months), pd.Series(True, index=months))


def run(modelled, reported, coverage, flags, holdout_year: int = HOLDOUT):
    return validate(modelled, reported, coverage, holdout_year, flags, NAMEPLATE_MW)


def test_calibration_factor_is_recovered():
    v = run(*series())
    assert v.calibration_factor == pytest.approx(0.85)
    assert v.calibration_years == [2018, 2019, 2020, 2021]
    assert v.holdout_year == 2022
    assert v.annual_error_pct == pytest.approx(0.0, abs=1e-9)
    assert v.monthly_mape_pct == pytest.approx(0.0, abs=1e-9)
    assert v.r2 == pytest.approx(1.0)


def test_holdout_is_not_used_for_calibration():
    modelled, reported, coverage, flags = series()
    reported[reported.index.year == HOLDOUT] = 0.70 * modelled[modelled.index.year == HOLDOUT]
    v = run(modelled, reported, coverage, flags)
    assert v.calibration_factor == pytest.approx(0.85)
    assert v.annual_error_pct == pytest.approx(21.43, abs=0.01)
    assert v.monthly_mape_pct == pytest.approx(21.43, abs=0.01)


def test_error_sign():
    modelled, reported, coverage, flags = series()
    held = reported.index.year == HOLDOUT
    reported[held] = 0.70 * modelled[held]            # the farm made less than the model says
    assert run(modelled, reported, coverage, flags).annual_error_pct > 0
    reported[held] = 1.00 * modelled[held]            # the farm made more
    assert run(modelled, reported, coverage, flags).annual_error_pct < 0
    assert run(*series(ratio=0.5)).blind_error_pct > 0
    assert run(*series(ratio=1.2)).blind_error_pct < 0


def test_assumed_losses_value():
    # The four group totals as SAM's defaults file states them, in percent.
    assert LOSS_AVAILABILITY * 100 == pytest.approx(5.5011685, abs=1e-6)
    assert LOSS_ELECTRICAL * 100 == pytest.approx(2.00809, abs=1e-6)
    assert LOSS_TURBINE_PERFORMANCE * 100 == pytest.approx(3.9544964, abs=1e-6)
    assert LOSS_ENVIRONMENTAL * 100 == pytest.approx(2.3981951, abs=1e-6)
    assert ASSUMED_LOSSES == pytest.approx(0.131936, abs=1e-6)


def test_blind_error_uses_no_farm_output_for_tuning():
    for holdout_year in (2020, 2021, 2022):
        modelled, reported, coverage, flags = series(last_year=holdout_year)
        v = run(modelled, reported, coverage, flags, holdout_year)
        assert v.blind_error_pct == pytest.approx(2.125, abs=0.01)     # (1 - 0.131936) / 0.85 - 1
        assert v.assumed_losses == ASSUMED_LOSSES


def test_blind_error_covers_all_usable_months():
    modelled, reported, coverage, flags = series()
    reported.loc["2019-06"] = 0.0
    v = run(modelled, reported, coverage, flags)
    used = v.table["used_for"]
    assert v.blind_months == (used == "calibration").sum() + (used == "holdout").sum() == 59


def test_calibration_factor_may_exceed_one():
    assert run(*series(ratio=1.10)).calibration_factor == pytest.approx(1.10)


def test_zero_month_is_excluded_with_reason():
    modelled, reported, coverage, flags = series()
    reported.loc["2019-06"] = 0.0
    reported.loc["2020-02"] = -12.0
    usable, excluded = usable_months(modelled, reported, coverage, NAMEPLATE_MW)
    assert excluded == [
        {"month": "2019-06", "reason": "reported zero or negative"},
        {"month": "2020-02", "reason": "reported zero or negative"},
    ]
    assert len(usable) == 58 and pd.Period("2019-06", "M") not in usable
    assert run(modelled, reported, coverage, flags).calibration_factor == pytest.approx(0.85)


def test_low_coverage_month_is_excluded_with_reason():
    modelled, reported, coverage, flags = series()
    coverage.loc["2021-03"] = 0.979
    coverage.loc["2021-04"] = 0.98               # exactly at the limit is kept
    usable, excluded = usable_months(modelled, reported, coverage, NAMEPLATE_MW)
    assert excluded == [{"month": "2021-03", "reason": "wind data missing"}]
    assert pd.Period("2021-04", "M") in usable


def test_missing_wind_is_the_reason_when_a_month_fails_two_rules():
    modelled, reported, coverage, flags = series()
    coverage.loc["2021-03"] = 0.0
    modelled.loc["2021-03"] = np.nan             # no wind hours at all, so no modelled energy
    reported.loc["2021-03"] = 0.0
    _, excluded = usable_months(modelled, reported, coverage, NAMEPLATE_MW)
    assert excluded == [{"month": "2021-03", "reason": "wind data missing"}]


def test_above_nameplate_month_is_excluded_with_reason():
    modelled, reported, coverage, flags = series()
    reported.loc["2020-02"] = NAMEPLATE_MW * 29 * 24 + 1.0      # 2020 is a leap year
    reported.loc["2021-02"] = NAMEPLATE_MW * 28 * 24            # exactly at nameplate is kept
    usable, excluded = usable_months(modelled, reported, coverage, NAMEPLATE_MW)
    assert excluded == [{"month": "2020-02", "reason": "reported above nameplate"}]
    assert pd.Period("2021-02", "M") in usable


def test_excluded_months_are_in_the_table_and_marked():
    modelled, reported, coverage, flags = series()
    reported.loc["2019-06"] = 0.0
    coverage.loc["2022-11"] = 0.5
    v = run(modelled, reported, coverage, flags)
    table = v.table.set_index("month")
    assert list(v.table.columns) == ["month", "modelled_mwh", "reported_mwh", "used_for"]
    assert len(table) == 60
    assert table.loc["2019-06", "used_for"] == "excluded"
    assert table.loc["2022-11", "used_for"] == "excluded"
    assert table.loc["2019-07", "used_for"] == "calibration"
    assert table.loc["2022-01", "used_for"] == "holdout"
    assert table.loc["2019-06", "reported_mwh"] == 0.0          # kept exactly as reported
    assert v.excluded_months == [
        {"month": "2019-06", "reason": "reported zero or negative"},
        {"month": "2022-11", "reason": "wind data missing"},
    ]


def test_annual_reporter_is_refused():
    modelled, reported, coverage, flags = series()
    flags.loc["2020-01":"2020-12"] = False
    with pytest.raises(ValueError, match="2020-01"):
        run(modelled, reported, coverage, flags)


def test_holdout_needs_at_least_ten_usable_months():
    modelled, reported, coverage, flags = series()
    reported.loc["2022-01":"2022-02"] = 0.0
    assert run(modelled, reported, coverage, flags).table["used_for"].eq("holdout").sum() == 10
    reported.loc["2022-03"] = 0.0
    with pytest.raises(ValueError, match="held-out"):
        run(modelled, reported, coverage, flags)


def test_calibration_needs_at_least_two_years():
    with pytest.raises(ValueError, match="calibration"):
        run(*series(first_year=2021))
    assert run(*series(first_year=2020)).calibration_years == [2020, 2021]


def test_a_month_after_the_holdout_year_is_refused():
    with pytest.raises(ValueError, match="2022-01"):
        run(*series(), holdout_year=2021)


def test_a_month_with_no_reported_figure_is_refused_not_dropped():
    modelled, reported, coverage, flags = series()
    reported.loc["2019-06"] = np.nan
    with pytest.raises(ValueError, match="2019-06"):
        run(modelled, reported, coverage, flags)


def test_modelled_series_from_hourly_timestamps_lines_up():
    """`monthly_mwh` labels months by their first day in UTC; reported months are periods."""
    modelled, reported, coverage, flags = series()
    stamps = modelled.index.to_timestamp().tz_localize("UTC")
    v = run(modelled.set_axis(stamps), reported, coverage.set_axis(stamps), flags)
    assert v.calibration_factor == pytest.approx(0.85)
    assert v.blind_months == 60
