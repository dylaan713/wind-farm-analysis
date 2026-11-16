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
MODEL_SIGMA_FLOOR = 0.03      # one good held-out year does not prove the model is that good


@dataclass(frozen=True)
class PValues:
    """Yearly energy that is exceeded with the given chance: P90 is beaten 9 years in 10."""
    p50: float
    p75: float
    p90: float
    p99: float


def sigmas(yearly_mwh: pd.Series, holdout_error_pct: float) -> tuple[float, float]:
    """(sigma_iav, sigma_model), both as shares of the mean year.

    sigma_iav is the standard deviation of the yearly totals over their mean (the sample
    standard deviation, dividing by n - 1). sigma_model is the size of the held-out year's
    error, never taken as less than 3%.
    """
    years = yearly_mwh.dropna()
    if len(years) < 2:
        raise ValueError(f"the year-to-year spread needs at least two years, got {len(years)}")
    sigma_iav = float(years.std(ddof=1) / years.mean())
    sigma_model = max(MODEL_SIGMA_FLOOR, abs(holdout_error_pct) / 100.0)
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
