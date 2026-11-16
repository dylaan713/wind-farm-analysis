"""The Jensen (Park) wake: deficit behind one rotor, how much of a downstream rotor it covers, and
how several wakes add up."""
import pytest

from energy.wake import combine, deficit, overlap_fraction


def test_deficit_known_value():
    assert deficit(0.8, 400.0, 40.0) == pytest.approx(0.180502, abs=1e-6)


def test_no_deficit_upwind():
    assert deficit(0.8, -10.0, 40.0) == 0.0
    assert deficit(0.8, 0.0, 40.0) == 0.0


def test_deficit_falls_with_distance():
    assert deficit(0.8, 200.0, 40.0) > deficit(0.8, 400.0, 40.0) > deficit(0.8, 800.0, 40.0)


def test_overlap_full_when_centred():
    assert overlap_fraction(40, 70, 0) == 1.0


def test_overlap_none_when_clear():
    assert overlap_fraction(40, 70, 110) == 0.0
    assert overlap_fraction(40, 70, 200) == 0.0


def test_overlap_full_when_rotor_inside_wake():
    assert overlap_fraction(40, 70, 30) == 1.0


def test_overlap_equal_circles():
    assert overlap_fraction(40, 40, 40) == pytest.approx(0.391002, abs=1e-6)


def test_overlap_partial():
    assert overlap_fraction(40, 70, 60) == pytest.approx(0.595167, abs=1e-6)


def test_combine_is_root_sum_square():
    assert combine([0.18, 0.10]) == pytest.approx(0.205913, abs=1e-6)


def test_combine_of_nothing_is_zero():
    assert combine([]) == 0.0
