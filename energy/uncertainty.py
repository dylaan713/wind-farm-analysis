"""How sure the yearly energy is: the spread between windy and calm years, the model's own error,
and the P-values that come from the two together.

Every formula here is written out in the energy plan under "The model, exactly".
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd

SEED = 20261114
DRAWS = 20_000
MODEL_SIGMA_FLOOR = 0.03      # a run of good years does not prove the model is that good


@dataclass(frozen=True)
class PValues:
    """Yearly energy that is exceeded with the given chance: P90 is beaten 9 years in 10."""
    p50: float
    p75: float
    p90: float
    p99: float


def sigmas(yearly_mwh: pd.Series, yearly_error_pct) -> tuple[float, float]:
    """(sigma_iav, sigma_model), both as shares of the mean year.

    sigma_iav is the standard deviation of the yearly totals over their mean (the sample
    standard deviation, dividing by n - 1).

    sigma_model is the calibrated model's worst year: the largest of its yearly errors, in
    percent, over every year it was compared with the farm, and never less than 3%. The plan
    first used the held-out year alone; one good year only shows the scaling held that once, so
    the rule was widened (Dylan, 2026-11-16). It is still a statement about this farm given its
    own record, not about how accurate the model is unscaled.
    """
    years = yearly_mwh.dropna()
    if len(years) < 2:
        raise ValueError(f"the year-to-year spread needs at least two years, got {len(years)}")
    sigma_iav = float(years.std(ddof=1) / years.mean())
    errors = np.atleast_1d(np.asarray(yearly_error_pct, dtype=float))
    if errors.size == 0 or np.isnan(errors).any():
        raise ValueError("the model's yearly errors are missing")
    sigma_model = max(MODEL_SIGMA_FLOOR, float(np.abs(errors).max()) / 100.0)
    return sigma_iav, sigma_model


def p_values(p50: float, sigma_iav: float, sigma_model: float, years: int = 1) -> PValues:
    """P-values for the average of `years` years, from 20,000 draws of
    p50 x (1 + wind error) x (1 + model error). Averaging over more years shrinks the wind
    error by the square root of the number of years; the model error is the same every year,
    so it does not shrink. The seed is fixed, so the same inputs always give the same numbers.
    """
    if years < 1:
        raise ValueError(f"years must be at least 1, got {years}")
    rng = np.random.default_rng(SEED)
    wind_error = rng.normal(0.0, sigma_iav / math.sqrt(years), DRAWS)
    model_error = rng.normal(0.0, sigma_model, DRAWS)
    draws = p50 * (1.0 + wind_error) * (1.0 + model_error)
    p50_, p75, p90, p99 = np.percentile(draws, [50, 25, 10, 1])
    return PValues(p50=float(p50_), p75=float(p75), p90=float(p90), p99=float(p99))
