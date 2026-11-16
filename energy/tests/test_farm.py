"""The farm: each turbine's waked speed, farm power, the direction x speed table, and hourly and
monthly energy."""
import numpy as np
import pandas as pd
import pytest

from energy.farm import (
    DIR_STEP, SPEEDS, coverage, farm_power_kw, gross_table, hourly_power_kw, monthly_mwh,
    power_table, turbine_speeds,
)
from energy.turbine import Turbine, power_kw, thrust_coefficient
from energy.wake import deficit

# The test turbine from Task 3: 80 m rotor, so r0 = 40 m.
T = Turbine(
    model="test 2 MW", rated_kw=2000.0, hub_height_m=80.0, rotor_diameter_m=80.0,
    curve_v=np.array([3.0, 8.0, 12.0, 25.0]), curve_kw=np.array([0.0, 800.0, 2000.0, 2000.0]),
    cut_in=3.0, cut_out=25.0,
)
PAIR_X, PAIR_Y = np.array([0.0, 400.0]), np.array([0.0, 0.0])


def test_single_turbine_has_no_wake():
    for d in np.arange(0.0, 360.0, DIR_STEP):
        for v in (2.0, 5.0, 10.0, 15.0, 26.0):
            assert farm_power_kw(T, [0.0], [0.0], d, v) == pytest.approx(power_kw(T, v))


def test_two_aligned_turbines():
    speeds = turbine_speeds(T, PAIR_X, PAIR_Y, 270.0, 10.0)
    back = 10.0 * (1 - deficit(thrust_coefficient(T, 10.0), 400.0, 40.0))
    assert speeds[0] == pytest.approx(10.0)
    assert speeds[1] == pytest.approx(back)
    assert farm_power_kw(T, PAIR_X, PAIR_Y, 270.0, 10.0) == pytest.approx(
        power_kw(T, 10.0) + power_kw(T, back))


def test_two_turbines_crosswind_have_no_wake():
    for d in (0.0, 180.0):
        assert farm_power_kw(T, PAIR_X, PAIR_Y, d, 10.0) == pytest.approx(2 * power_kw(T, 10.0))


def test_reversing_the_wind_swaps_the_roles():
    from_west = turbine_speeds(T, PAIR_X, PAIR_Y, 270.0, 10.0)
    from_east = turbine_speeds(T, PAIR_X, PAIR_Y, 90.0, 10.0)
    assert from_east[1] == pytest.approx(10.0)
    assert from_east[0] == pytest.approx(from_west[1])
    assert farm_power_kw(T, PAIR_X, PAIR_Y, 90.0, 10.0) == pytest.approx(
        farm_power_kw(T, PAIR_X, PAIR_Y, 270.0, 10.0))


def test_three_in_a_row_uses_each_ones_own_ct():
    x = np.array([0.0, 400.0, 800.0])
    s = turbine_speeds(T, x, np.zeros(3), 270.0, 10.0)
    assert s[2] < s[1] < s[0]
    # The third sees the first's wake at its Ct at 10 m/s, and the second's at its Ct at s[1].
    d1 = deficit(thrust_coefficient(T, s[0]), 800.0, 40.0)
    d2 = deficit(thrust_coefficient(T, s[1]), 400.0, 40.0)
    assert s[2] == pytest.approx(10.0 * (1 - np.hypot(d1, d2)))


def test_far_apart_turbines_lose_almost_nothing():
    x = np.array([0.0, 20000.0, 40000.0])
    for d in np.arange(0.0, 360.0, DIR_STEP):
        assert farm_power_kw(T, x, np.zeros(3), d, 10.0) > 0.995 * 3 * power_kw(T, 10.0)


def test_farm_never_exceeds_gross():
    rng = np.random.default_rng(20261114)
    x, y = rng.uniform(-1500, 1500, 12), rng.uniform(-1500, 1500, 12)
    table = power_table(T, x, y)
    gross = gross_table(T, 12)
    assert np.all(table <= gross[None, :] + 1e-9)
    assert np.all(table >= 0.0)


def test_power_table_shape_and_zero_rows():
    rng = np.random.default_rng(1)
    table = power_table(T, rng.uniform(-800, 800, 4), rng.uniform(-800, 800, 4))
    assert table.shape == (72, 61)
    assert np.all(table[:, SPEEDS == 0.0] == 0.0)
    assert np.all(table[:, SPEEDS >= 25.0] == 0.0)


def test_direction_bin_wrap():
    table = np.zeros((72, 61))
    table[0, :] = 1.0
    table[71, :] = 2.0                     # the bin centred on 355
    got = hourly_power_kw(table, np.array([359.9, 0.1, 357.4, 357.6, 360.0, -2.0]), np.full(6, 10.0))
    np.testing.assert_allclose(got, [1.0, 1.0, 2.0, 1.0, 1.0, 1.0])


def test_hourly_lookup_interpolates_speed():
    table = np.tile(SPEEDS * 100.0, (72, 1))
    i = int(np.flatnonzero(SPEEDS == 9.5)[0])
    got = hourly_power_kw(table, np.array([90.0]), np.array([9.75]))
    assert got[0] == pytest.approx((table[18, i] + table[18, i + 1]) / 2)


def test_hourly_lookup_keeps_missing_hours_missing():
    table = np.ones((72, 61))
    got = hourly_power_kw(table, np.array([np.nan, 10.0]), np.array([10.0, np.nan]))
    assert np.all(np.isnan(got))


def test_monthly_mwh_skips_missing_hours():
    idx = pd.date_range("2020-01-01", periods=744, freq="h")
    kw = pd.Series(1000.0, index=idx)
    kw.iloc[5] = np.nan
    assert monthly_mwh(kw).iloc[0] == pytest.approx(743.0)
    assert coverage(kw).iloc[0] == pytest.approx(743 / 744)


def test_coverage_counts_absent_hours_as_missing():
    idx = pd.date_range("2020-01-01", periods=744, freq="h").delete(10)
    assert coverage(pd.Series(1.0, index=idx)).iloc[0] == pytest.approx(743 / 744)


def test_monthly_mwh_units():
    idx = pd.date_range("2021-01-01", periods=744, freq="h")
    assert monthly_mwh(pd.Series(1000.0, index=idx)).iloc[0] == pytest.approx(744.0)
