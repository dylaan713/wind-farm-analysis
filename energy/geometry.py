"""Where the turbines are: longitude and latitude to local metres, and how far each turbine sits
downwind and crosswind of each other one.

Every formula here is written out in the energy plan under "The model, exactly".
"""
from __future__ import annotations

import numpy as np

METRES_PER_DEGREE = 111195.08   # one degree of latitude, on a sphere of radius 6,371 km


def to_local_m(lon, lat, lon0: float, lat0: float) -> tuple[np.ndarray, np.ndarray]:
    """Metres east (x) and north (y) of (lon0, lat0). Flat-earth, fine over a few kilometres."""
    lon = np.asarray(lon, dtype=float)
    lat = np.asarray(lat, dtype=float)
    x = (lon - lon0) * METRES_PER_DEGREE * np.cos(np.radians(lat0))
    y = (lat - lat0) * METRES_PER_DEGREE
    return x, y


def along_across(x, y, wind_from_deg: float) -> tuple[np.ndarray, np.ndarray]:
    """For wind coming from `wind_from_deg` (compass, clockwise from north):
    along[i, j] is how far turbine i is downwind of turbine j (negative when upwind), and
    across[i, j] is the crosswind distance between them, never negative."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    theta = np.radians(wind_from_deg)
    # The air travels toward (-sin, -cos); the crosswind axis is perpendicular to it.
    dx = x[:, None] - x[None, :]
    dy = y[:, None] - y[None, :]
    along = -dx * np.sin(theta) - dy * np.cos(theta)
    across = np.abs(dx * np.cos(theta) - dy * np.sin(theta))
    return along, across
