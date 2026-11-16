"""Year-to-year spread, model error, and the P-values drawn from them."""
import numpy as np
import pandas as pd
import pytest

from energy.uncertainty import DRAWS, SEED, p_values, sigmas


def test_sigma_model_has_a_floor():
    yearly = pd.Series([100.0, 110.0, 90.0])
    assert sigmas(yearly, 1.0)[1] == pytest.approx(0.03)
    assert sigmas(yearly, 8.0)[1] == pytest.approx(0.08)
    assert sigmas(yearly, -8.0)[1] == pytest.approx(0.08)      # a model that ran low counts the same


def test_sigma_model_is_the_worst_year_not_the_held_out_one():
    yearly = pd.Series([100.0, 110.0, 90.0])
    errors = pd.Series([-2.89, -1.16, 3.83, 1.46], index=[2018, 2019, 2023, 2025])
    assert sigmas(yearly, errors)[1] == pytest.approx(0.0383)
    assert sigmas(yearly, pd.Series([-4.5, 1.0]))[1] == pytest.approx(0.045)
    assert sigmas(yearly, pd.Series([-1.0, 2.0]))[1] == pytest.approx(0.03)     # the floor still holds
    with pytest.raises(ValueError):
        sigmas(yearly, pd.Series([1.0, float("nan")]))


def test_sigma_iav_is_relative():
    # Mean 100; sample standard deviation exactly 6.
    yearly = pd.Series([94.0, 100.0, 106.0]) * 1000.0
    assert yearly.std(ddof=1) == pytest.approx(6000.0)
    assert sigmas(yearly, 1.0)[0] == pytest.approx(0.06)


def test_sigmas_need_at_least_two_years():
    with pytest.raises(ValueError, match="two"):
        sigmas(pd.Series([100.0]), 1.0)


def test_p_values_are_ordered():
    p = p_values(100000.0, 0.06, 0.05)
    assert p.p50 > p.p75 > p.p90 > p.p99 > 0


def test_p_values_match_the_normal_case():
    p = p_values(100000.0, 0.06, 0.05)
    combined = np.hypot(0.06, 0.05)                              # 0.078102
    assert p.p90 == pytest.approx(100000.0 * (1 - 1.281552 * combined), rel=0.01)
    assert p.p99 == pytest.approx(100000.0 * (1 - 2.326348 * combined), rel=0.01)
    assert p.p50 == pytest.approx(100000.0, rel=0.005)


def test_ten_year_is_tighter():
    one, ten = p_values(100000.0, 0.06, 0.05), p_values(100000.0, 0.06, 0.05, years=10)
    assert ten.p99 > one.p99 and ten.p90 > one.p90
    assert ten.p50 == pytest.approx(one.p50, rel=0.005)
    # Averaging over ten years shrinks the wind's share, never the model's.
    assert ten.p90 < 100000.0 * (1 - 1.281552 * 0.05) * 1.01


def test_seed_makes_it_repeatable():
    assert p_values(100000.0, 0.06, 0.05) == p_values(100000.0, 0.06, 0.05)
    assert (SEED, DRAWS) == (20261114, 20_000)


def test_no_spread_gives_one_number():
    p = p_values(5000.0, 0.0, 0.0)
    assert p.p50 == p.p75 == p.p90 == p.p99 == 5000.0
