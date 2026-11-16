"""Two checks of the model against what the farm reported.

A. Blind: the modelled energy less a fixed set of assumed losses, compared with every usable
   month. No number comes from the farm's own output. This is the only result that may be called
   a prediction.
B. Calibrated on the farm's earlier years, tested on a held-out year: one factor is fitted on the
   earlier years, and the errors are measured on a year the factor never saw.

Every formula here is written out in the energy plan under "The model, exactly".
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


def _together(*shares: float) -> float:
    """Several losses applied one after another: what is left is the product of what each leaves."""
    left = 1.0
    for share in shares:
        left *= 1.0 - share
    return 1.0 - left


# Fixed before the farm's output is looked at (Dylan, 2026-11-16). Each number is the share of
# energy lost to one cause, and every one is the default in the System Advisor Model's wind
# inputs: `deploy/runtime/defaults/Wind Power_Single Owner.json` in github.com/NREL/SAM at commit
# e6935c1, read 2026-11-16 (BSD 3-Clause; see docs/data-sources.md). They are a published
# tool's general defaults, not figures for this farm. SAM's fifth group, curtailment and
# operating strategies (2.80%), is left out: the plan names these four.
LOSS_AVAILABILITY = _together(0.0358, 0.005, 0.015)                # turbines, the rest of the plant, the grid
LOSS_ELECTRICAL = _together(0.0191, 0.001)                         # cables and transformers, the farm's own use
LOSS_TURBINE_PERFORMANCE = _together(0.011, 0.004, 0.0081, 0.017)  # power curve, high-wind restart, site, generic
LOSS_ENVIRONMENTAL = _together(0.0021, 0.018, 0.004)               # icing, blade wear, weather shutdowns
ASSUMED_LOSSES = _together(
    LOSS_AVAILABILITY, LOSS_ELECTRICAL, LOSS_TURBINE_PERFORMANCE, LOSS_ENVIRONMENTAL)

MIN_COVERAGE = 0.98               # a month with more than 2% of its wind hours missing is not used
MIN_HOLDOUT_MONTHS = 10
MIN_CALIBRATION_YEARS = 2

REASON_WIND = "wind data missing"
REASON_ZERO = "reported zero or negative"
REASON_NAMEPLATE = "reported above nameplate"


@dataclass(frozen=True)
class Validation:
    calibration_factor: float          # NOT a loss figure: it also absorbs wind-data and model bias
    calibration_years: list[int]
    holdout_year: int
    blind_error_pct: float             # positive when the model is above the reported total
    blind_months: int
    assumed_losses: float
    annual_error_pct: float            # held-out year only, positive when the model is above
    monthly_mape_pct: float            # held-out year only
    r2: float                          # held-out year only
    excluded_months: list[dict]        # {"month": "2021-02", "reason": "..."}
    table: pd.DataFrame                # month, modelled_mwh, reported_mwh, used_for


def _by_month(values: pd.Series, name: str) -> pd.Series:
    """The same series indexed by calendar month, whatever kind of dates it came with."""
    index = values.index
    if isinstance(index, pd.DatetimeIndex):
        index = (index.tz_localize(None) if index.tz is not None else index).to_period("M")
    elif isinstance(index, pd.PeriodIndex):
        index = index.asfreq("M")
    else:
        raise ValueError(f"{name} must be indexed by month (dates or periods), got {type(index).__name__}")
    if index.has_duplicates:
        raise ValueError(f"{name} has the same month more than once")
    return values.set_axis(index).sort_index()


def _aligned(modelled: pd.Series, reported: pd.Series, coverage: pd.Series) -> pd.DataFrame:
    """One row per reported month. A reported month the model has no row for is an error, and so
    is a reported month with no figure: months are only ever left out by the three named rules."""
    reported = _by_month(reported, "reported")
    months = reported.index
    frame = pd.DataFrame({
        "modelled_mwh": _by_month(modelled, "modelled").reindex(months),
        "reported_mwh": reported,
        "coverage": _by_month(coverage, "coverage").reindex(months),
    })
    for column, what in (("coverage", "wind coverage"), ("reported_mwh", "reported figure")):
        gaps = frame.index[frame[column].isna()]
        if len(gaps):
            raise ValueError(f"no {what} for {gaps[0]} ({len(gaps)} such months)")
    return frame


def _reasons(frame: pd.DataFrame, nameplate_mw: float) -> pd.Series:
    """Why each month is left out, or None. The first rule a month fails is the one recorded."""
    if nameplate_mw <= 0:
        raise ValueError(f"nameplate {nameplate_mw} MW must be positive")
    hours = frame.index.days_in_month * 24
    reasons = pd.Series(None, index=frame.index, dtype=object)
    reasons[(frame["reported_mwh"] > nameplate_mw * hours).to_numpy()] = REASON_NAMEPLATE
    reasons[(frame["reported_mwh"] <= 0).to_numpy()] = REASON_ZERO
    reasons[(frame["coverage"] < MIN_COVERAGE).to_numpy()] = REASON_WIND
    lost = frame.index[reasons.isna().to_numpy() & frame["modelled_mwh"].isna().to_numpy()]
    if len(lost):
        raise ValueError(f"no modelled energy for {lost[0]} although its wind data is complete")
    return reasons


def _excluded_list(reasons: pd.Series) -> list[dict]:
    return [{"month": str(month), "reason": reason} for month, reason in reasons.dropna().items()]


def usable_months(
    modelled: pd.Series, reported: pd.Series, coverage: pd.Series, nameplate_mw: float,
) -> tuple[pd.Index, list[dict]]:
    """The months that can be compared, and the ones left out with the reason for each.

    A month is left out for exactly three reasons, checked in this order: wind coverage below
    0.98, reported generation of zero or less, reported generation above nameplate x hours.
    """
    reasons = _reasons(_aligned(modelled, reported, coverage), nameplate_mw)
    return reasons.index[reasons.isna().to_numpy()], _excluded_list(reasons)


def yearly_errors_pct(v: Validation) -> pd.Series:
    """The calibrated model's error in each year it was compared, in percent, positive when the
    model is above the farm: the months used in that year, modelled x calibration factor against
    reported. All but the held-out year were used to fit the factor, so these flatter the model."""
    used = v.table[v.table["used_for"] != "excluded"]
    by_year = used.groupby(used["month"].str[:4].astype(int))[["modelled_mwh", "reported_mwh"]].sum()
    return (by_year["modelled_mwh"] * v.calibration_factor / by_year["reported_mwh"] - 1.0) * 100.0


def _pct_error(model_total: float, reported_total: float) -> float:
    return (model_total - reported_total) / reported_total * 100.0


def validate(
    modelled: pd.Series, reported: pd.Series, coverage: pd.Series, holdout_year: int,
    reported_monthly: pd.Series, nameplate_mw: float,
) -> Validation:
    """Run both checks. `modelled` is waked monthly MWh before any losses, `reported` is the
    farm's net MWh, `coverage` is the share of each month's wind hours present, and
    `reported_monthly` says whether each month's figure was measured (a monthly filing) or is the
    agency's estimate from an annual filing. The held-out year must be the last one given."""
    flags = _by_month(reported_monthly, "reported_monthly")
    estimated = flags.index[~flags.astype(bool).to_numpy()]
    if len(estimated):
        raise ValueError(
            f"{estimated[0]} comes from an annual filing ({len(estimated)} such months): its "
            "monthly figures are estimates, not measurements, and cannot be validated against"
        )

    frame = _aligned(modelled, reported, coverage)
    missing_flags = frame.index.difference(flags.index)
    if len(missing_flags):
        raise ValueError(f"no reporting-frequency flag for {missing_flags[0]}")
    later = frame.index[frame.index.year > holdout_year]
    if len(later):
        raise ValueError(f"{later[0]} is after the held-out year {holdout_year}, which must be the last")

    reasons = _reasons(frame, nameplate_mw)
    usable = reasons.isna().to_numpy()
    is_holdout = frame.index.year == holdout_year
    used_for = np.where(~usable, "excluded", np.where(is_holdout, "holdout", "calibration"))

    calibration = frame[used_for == "calibration"]
    holdout = frame[used_for == "holdout"]
    calibration_years = sorted(int(y) for y in set(calibration.index.year))
    if len(calibration_years) < MIN_CALIBRATION_YEARS:
        raise ValueError(
            f"calibration needs at least {MIN_CALIBRATION_YEARS} years before {holdout_year}, "
            f"got {calibration_years}"
        )
    if len(holdout) < MIN_HOLDOUT_MONTHS:
        raise ValueError(
            f"the held-out year {holdout_year} has {len(holdout)} usable months; "
            f"at least {MIN_HOLDOUT_MONTHS} are needed"
        )

    # A. Blind: assumed losses only, every usable month.
    everything = frame[usable]
    blind_error = _pct_error(
        everything["modelled_mwh"].sum() * (1.0 - ASSUMED_LOSSES), everything["reported_mwh"].sum())

    # B. One factor from the earlier years, then measured on the held-out year alone.
    factor = calibration["reported_mwh"].sum() / calibration["modelled_mwh"].sum()
    net = holdout["modelled_mwh"] * factor
    actual = holdout["reported_mwh"]
    spread = float(((actual - actual.mean()) ** 2).sum())
    # R squared here is 1 - (squared error) / (spread of the reported months), not a squared
    # correlation: a model that is off by a constant is marked down for it.
    r2 = 1.0 - float(((actual - net) ** 2).sum()) / spread if spread > 0 else float("nan")

    table = pd.DataFrame({
        "month": frame.index.astype(str),
        "modelled_mwh": frame["modelled_mwh"].to_numpy(),
        "reported_mwh": frame["reported_mwh"].to_numpy(),
        "used_for": used_for,
    })
    return Validation(
        calibration_factor=float(factor),
        calibration_years=calibration_years,
        holdout_year=int(holdout_year),
        blind_error_pct=float(blind_error),
        blind_months=int(usable.sum()),
        assumed_losses=ASSUMED_LOSSES,
        annual_error_pct=float(_pct_error(net.sum(), actual.sum())),
        monthly_mape_pct=float(((net - actual).abs() / actual).mean() * 100.0),
        r2=r2,
        excluded_months=_excluded_list(reasons),
        table=table,
    )
