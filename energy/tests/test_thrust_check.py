"""The check behind the rotor-to-grid efficiency: derived thrust against published thrust."""
import numpy as np
import pytest

from energy.thrust_check import SPEEDS, ct_error, fit_efficiency, parse_library
from energy.turbine import ct_from_power


def _turbine(efficiency: float, diameter: float = 100.0, maker: str = "Maker") -> dict:
    """A made-up turbine whose published thrust is exactly what the method gives at `efficiency`."""
    v = np.arange(0.0, 25.5, 0.5)
    area = np.pi * (diameter / 2) ** 2
    kw = np.minimum(0.45 * 0.5 * 1.225 * area * v**3 / 1000.0, 3000.0)
    kw[v < 3.0] = 0.0
    return {"maker": maker, "name": "made up", "rotor_diameter_m": diameter,
            "v": v, "kw": kw, "ct_v": v, "ct": ct_from_power(kw, v, diameter, efficiency=efficiency)}


def test_error_is_zero_at_the_efficiency_the_turbine_was_made_with():
    assert np.abs(ct_error([_turbine(0.8)], 0.8)).max() == pytest.approx(0.0, abs=1e-9)


def test_derived_thrust_is_too_low_when_no_efficiency_is_applied():
    error = ct_error([_turbine(0.8)], 1.0)
    assert error.shape == (1, len(SPEEDS))
    assert error.max() <= 1e-9 and error.min() < -0.1       # derived minus published


def test_fit_finds_the_efficiency():
    assert fit_efficiency([_turbine(0.8), _turbine(0.8, diameter=120.0)]) == pytest.approx(0.8, abs=0.003)


def test_fit_refuses_an_empty_list():
    with pytest.raises(ValueError):
        fit_efficiency([])


def test_parse_library_keeps_only_turbines_with_both_curves():
    good = {"manufacturer": "Maker", "name": "A", "rotor_diameter": "100", "has_power_curve": True,
            "has_ct_curve": True, "power_curve_wind_speeds": "[3.0, 8.0, 12.0]",
            "power_curve_values": "[0.0, 800.0, 2000.0]",
            "thrust_coefficient_curve_wind_speeds": "[3.0, 8.0, 12.0]",
            "thrust_coefficient_curve_values": "[0.9, 0.8, 0.4]"}
    no_thrust = {**good, "name": "B", "has_ct_curve": False, "thrust_coefficient_curve_values": None}
    cut_off = {**good, "name": "C", "power_curve_values": "[0.0, 800.0, 20"}
    uneven = {**good, "name": "D", "power_curve_values": "[0.0, 800.0]"}
    kept, skipped = parse_library([good, no_thrust, cut_off, uneven])
    assert [t["name"] for t in kept] == ["A"]
    assert kept[0]["rotor_diameter_m"] == 100.0 and kept[0]["kw"].tolist() == [0.0, 800.0, 2000.0]
    assert skipped == ["C", "D"]            # broken rows are named, never dropped silently
