"""Longitude and latitude to local metres, and downwind and crosswind distances between turbines."""
import numpy as np
import pytest

from energy.geometry import along_across, to_local_m


def test_one_degree_of_latitude():
    x, y = to_local_m(np.array([0.0]), np.array([1.0]), 0.0, 0.0)
    assert y[0] == pytest.approx(111195.08)
    assert x[0] == pytest.approx(0.0)


def test_longitude_shrinks_with_latitude():
    x, y = to_local_m(np.array([1.0]), np.array([40.0]), 0.0, 40.0)
    assert x[0] == pytest.approx(85180.373, abs=0.01)
    assert y[0] == pytest.approx(0.0)


def test_wind_from_west_puts_east_turbine_downwind():
    along, across = along_across(np.array([0.0, 500.0]), np.array([0.0, 0.0]), 270.0)
    assert along[1, 0] == pytest.approx(500.0)
    assert along[0, 1] == pytest.approx(-500.0)
    np.testing.assert_allclose(across, 0.0, atol=1e-9)


def test_wind_from_north_puts_south_turbine_downwind():
    along, across = along_across(np.array([0.0, 0.0]), np.array([0.0, -500.0]), 0.0)
    assert along[1, 0] == pytest.approx(500.0)
    np.testing.assert_allclose(across, 0.0, atol=1e-9)


def test_direction_wraps():
    x = np.array([0.0, 300.0, -150.0])
    y = np.array([0.0, 400.0, 250.0])
    a1, c1 = along_across(x, y, 359.9)
    a2, c2 = along_across(x, y, -0.1)
    np.testing.assert_allclose(a1, a2, atol=1e-9)
    np.testing.assert_allclose(c1, c2, atol=1e-9)
    a3, c3 = along_across(x, y, 360.0)
    a4, c4 = along_across(x, y, 0.0)
    np.testing.assert_allclose(a3, a4, atol=1e-9)
    np.testing.assert_allclose(c3, c4, atol=1e-9)
