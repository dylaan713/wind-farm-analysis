"""One turbine: shear, air density, the power curve and the thrust derived from it."""
from pathlib import Path

import numpy as np
import pytest

from energy.turbine import (
    ROTOR_TO_GRID, Turbine, air_density, ct_from_cp, ct_from_power, equivalent_speed, hub_speed,
    load_turbine, power_kw, thrust_coefficient,
)

T = Turbine(
    model="test 2 MW", rated_kw=2000.0, hub_height_m=80.0, rotor_diameter_m=80.0,
    curve_v=np.array([3.0, 8.0, 12.0, 25.0]), curve_kw=np.array([0.0, 800.0, 2000.0, 2000.0]),
    cut_in=3.0, cut_out=25.0,
)

REAL_CURVE = Path(__file__).resolve().parents[2] / "data" / "turbines" / "vestas-v110-2.0.csv"


def test_shear():
    assert hub_speed(8.0, 80.0) == pytest.approx(7.753943, abs=1e-6)


def test_shear_at_100m_is_unchanged():
    assert hub_speed(8.0, 100.0) == pytest.approx(8.0)


def test_standard_density():
    assert air_density(101325.0, 288.15) == pytest.approx(1.225012, abs=1e-6)


def test_density_correction():
    assert equivalent_speed(8.0, 1.10) == pytest.approx(7.718072, abs=1e-6)


def test_power_interpolates():
    assert power_kw(T, 10.0) == pytest.approx(1400.0)


def test_power_is_zero_below_cut_in():
    assert power_kw(T, 2.99) == 0.0


def test_power_is_zero_at_cut_out():
    assert power_kw(T, 25.0) == 0.0 and power_kw(T, 40.0) == 0.0


def test_power_never_negative_or_above_rated():
    p = power_kw(T, np.linspace(0.0, 40.0, 401))
    assert p.min() >= 0.0 and p.max() <= 2000.0


def test_power_accepts_arrays():
    v = np.array([[2.0, 10.0], [12.0, 30.0]])
    p = power_kw(T, v)
    assert p.shape == v.shape
    assert p.tolist() == [[0.0, 1400.0], [2000.0, 0.0]]


def test_power_of_a_missing_hour_stays_missing():
    assert np.isnan(power_kw(T, np.array([np.nan, 10.0]))[0])


def test_ct_from_cp_known_point():
    assert ct_from_cp(0.512) == pytest.approx(0.64, abs=1e-6)


def test_ct_from_cp_at_betz_limit():
    assert ct_from_cp(16 / 27) == pytest.approx(0.888889, abs=1e-5)


def test_ct_from_cp_above_betz_is_capped():
    assert ct_from_cp(0.7) == pytest.approx(0.888889, abs=1e-5)


def test_ct_from_cp_of_nothing_is_nothing():
    assert ct_from_cp(0.0) == 0.0 and ct_from_cp(-0.1) == 0.0


def test_thrust_is_zero_when_not_running():
    assert thrust_coefficient(T, 2.0) == 0.0 and thrust_coefficient(T, 26.0) == 0.0


def test_thrust_is_derived_from_the_power_curve():
    # at 8 m/s the test turbine makes 800 kW: Cp = 800000 / (0.5 × 1.225 × pi × 40² × 8³) = 0.5076.
    # The rotor is taken to have captured that divided by 0.78, which is over the Betz limit, so
    # the thrust is the Betz value.
    cp = 800_000.0 / (0.5 * 1.225 * np.pi * 40.0**2 * 8.0**3)
    assert ROTOR_TO_GRID == 0.78
    assert thrust_coefficient(T, 8.0) == pytest.approx(ct_from_cp(cp / 0.78))
    assert thrust_coefficient(T, 8.0) == pytest.approx(0.888889, abs=1e-5)
    assert thrust_coefficient(T, np.array([2.0, 8.0, 26.0])).shape == (3,)


def test_ct_from_power_divides_by_the_rotor_to_grid_efficiency():
    # 300 kW at 6 m/s on an 80 m rotor: Cp = 0.4511; / 0.78 = 0.5783
    cp = 300_000.0 / (0.5 * 1.225 * np.pi * 40.0**2 * 6.0**3)
    ct = ct_from_power(np.array([300.0]), np.array([6.0]), 80.0)
    assert ct[0] == pytest.approx(ct_from_cp(cp / 0.78))
    assert ct[0] > ct_from_cp(cp)                       # more thrust than the uncorrected figure
    assert ct_from_power(np.array([300.0]), np.array([6.0]), 80.0, efficiency=1.0)[0] == pytest.approx(ct_from_cp(cp))


def test_ct_from_power_is_zero_without_power_or_wind():
    assert ct_from_power(np.array([0.0, 100.0]), np.array([8.0, 0.0]), 80.0).tolist() == [0.0, 0.0]


def test_a_published_thrust_curve_is_used_when_there_is_one():
    t = Turbine(
        model="with thrust", rated_kw=2000.0, hub_height_m=80.0, rotor_diameter_m=80.0,
        curve_v=T.curve_v, curve_kw=T.curve_kw, cut_in=3.0, cut_out=25.0,
        curve_ct=np.array([0.0, 0.8, 0.4, 0.1]),
    )
    assert thrust_coefficient(t, 10.0) == pytest.approx(0.6)
    assert thrust_coefficient(t, 2.0) == 0.0 and thrust_coefficient(t, 25.0) == 0.0


def _write(tmp_path, text):
    path = tmp_path / "curve.csv"
    path.write_text(text)
    return path


def test_load_turbine_reads_the_csv_and_skips_comments(tmp_path):
    path = _write(tmp_path, "# model: Test 2 MW\n# rated_kw: 2000\n# source: made up\n"
                            "v_ms,power_kw\n2,0\n3,0\n8,800\n12,2000\n25,2000\n")
    t = load_turbine(path, hub_height_m=80.0, rotor_diameter_m=80.0)
    assert t.model == "Test 2 MW" and t.rated_kw == 2000.0
    assert t.hub_height_m == 80.0 and t.rotor_diameter_m == 80.0
    assert t.curve_v.tolist() == [2.0, 3.0, 8.0, 12.0, 25.0]
    assert t.cut_in == 3.0          # the last speed with zero power before the curve rises
    assert t.cut_out == 25.0        # the last speed in the file
    assert t.curve_ct is None


def test_load_turbine_reads_a_thrust_column(tmp_path):
    path = _write(tmp_path, "# model: T\n# rated_kw: 2000\nv_ms,power_kw,ct\n3,0,0\n8,800,0.8\n25,2000,0.1\n")
    assert load_turbine(path, 80.0, 80.0).curve_ct.tolist() == [0.0, 0.8, 0.1]


def test_load_turbine_rejects_unsorted_speeds(tmp_path):
    path = _write(tmp_path, "# model: T\n# rated_kw: 2000\nv_ms,power_kw\n3,0\n12,2000\n8,800\n")
    with pytest.raises(ValueError, match="ascending"):
        load_turbine(path, 80.0, 80.0)


def test_load_turbine_rejects_a_file_without_a_model_or_rating(tmp_path):
    path = _write(tmp_path, "v_ms,power_kw\n3,0\n8,800\n")
    with pytest.raises(ValueError, match="rated_kw"):
        load_turbine(path, 80.0, 80.0)


def test_load_turbine_rejects_negative_power(tmp_path):
    path = _write(tmp_path, "# model: T\n# rated_kw: 2000\nv_ms,power_kw\n3,0\n8,-5\n")
    with pytest.raises(ValueError, match="negative"):
        load_turbine(path, 80.0, 80.0)


# The farm's real turbine, as transcribed into the repo.

def test_the_real_curve_loads_and_matches_the_turbine_database():
    t = load_turbine(REAL_CURVE, hub_height_m=80.0, rotor_diameter_m=110.0)
    assert t.model == "Vestas V110-2.0" and t.rated_kw == 2000.0
    assert len(t.curve_v) == 19
    assert t.cut_in == 2.0 and t.cut_out == pytest.approx(19.983154)


def test_the_real_curve_never_exceeds_rated_power():
    # the library's point at 15.97 m/s reads 2002.09 kW; output is held at the 2000 kW rating
    t = load_turbine(REAL_CURVE, 80.0, 110.0)
    p = power_kw(t, np.linspace(0.0, 30.0, 3001))
    assert p.min() >= 0.0 and p.max() == 2000.0


def test_the_real_curve_stays_under_the_betz_limit():
    t = load_turbine(REAL_CURVE, 80.0, 110.0)
    v = np.linspace(2.5, 19.9, 200)
    cp = power_kw(t, v) * 1000.0 / (0.5 * 1.225 * np.pi * 55.0**2 * v**3)
    assert cp.max() < 16 / 27
    assert cp.max() == pytest.approx(0.455, abs=0.01)     # peak efficiency, near 7.5 m/s
    ct = thrust_coefficient(t, v)
    assert ct.min() > 0.0 and ct.max() < 0.9
    # Cp 0.453 / 0.78 = 0.581 -> a = 0.28 -> Ct = 4 × 0.28 × 0.72 = 0.806. Uncorrected it was 0.54.
    assert thrust_coefficient(t, 8.0) == pytest.approx(0.806, abs=0.005)
