"""The Jensen (Park) wake: the slower air behind one rotor, how much of a downstream rotor it
covers, and how several wakes add up at one turbine.

Every formula here is written out in the energy plan under "The model, exactly".
"""
from __future__ import annotations

import math

K_DEFAULT = 0.075   # wake expansion: the wake's radius grows 0.075 m per metre downwind


def deficit(ct: float, along_m: float, r0: float, k: float = K_DEFAULT) -> float:
    """Fractional speed drop inside the wake `along_m` metres downwind of a rotor of radius `r0`
    with thrust coefficient `ct`. Zero at or upwind of the rotor."""
    if not 0.0 <= ct <= 1.0:
        raise ValueError(f"thrust coefficient {ct} is outside 0 to 1")
    if r0 <= 0.0:
        raise ValueError(f"rotor radius {r0} must be positive")
    if along_m <= 0.0:
        return 0.0
    return (1.0 - math.sqrt(1.0 - ct)) / (1.0 + k * along_m / r0) ** 2


def overlap_fraction(r0: float, rw: float, across_m: float) -> float:
    """Share of a rotor disc (radius `r0`) inside a wake circle (radius `rw`) whose centre is
    `across_m` metres away: the two-circle lens area divided by the rotor's area."""
    if r0 <= 0.0 or rw <= 0.0:
        raise ValueError(f"radii must be positive, got rotor {r0} and wake {rw}")
    d = abs(across_m)
    if d >= r0 + rw:
        return 0.0
    if d <= rw - r0:            # rotor entirely inside the wake
        return 1.0
    if d <= r0 - rw:            # wake entirely inside the rotor (only if the wake is smaller)
        return (rw / r0) ** 2
    # Clamped because rounding can push the cosine a hair past 1 near the boundaries above.
    a = r0 * r0 * math.acos(min(1.0, max(-1.0, (d * d + r0 * r0 - rw * rw) / (2.0 * d * r0))))
    b = rw * rw * math.acos(min(1.0, max(-1.0, (d * d + rw * rw - r0 * r0) / (2.0 * d * rw))))
    c = 0.5 * math.sqrt(max(0.0, (-d + r0 + rw) * (d + r0 - rw) * (d - r0 + rw) * (d + r0 + rw)))
    return (a + b - c) / (math.pi * r0 * r0)


def combine(effects) -> float:
    """Total deficit at one turbine from several wakes: the root of the sum of squares."""
    return math.sqrt(sum(e * e for e in effects))
