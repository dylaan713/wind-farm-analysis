import pandas as pd
import pytest

from energy.select_farm import candidates, capacity_factors, screen_generation


def farm(eia_id, n, *, model="V110-2.0", year=2016, state="IA", cap=2000.0, name=None, lon=-95.0, lat=42.0, **over):
    rows = [{
        "case_id": eia_id * 1000 + i, "eia_id": eia_id, "p_name": name or f"Farm {eia_id}", "t_state": state, "p_year": year,
        "p_tnum": n, "p_cap": (n * cap / 1000 if cap else None), "t_manu": "Vestas", "t_model": model, "t_cap": cap, "t_hh": 80.0, "t_rd": 110.0,
        "xlong": lon + 0.01 * i, "ylat": lat + 0.002 * i, "t_retrofit": 0, "t_retro_yr": None, "t_offshore": 0,
    } for i in range(n)]
    for r in rows:
        r.update(over)
    return rows


def table(*farms):
    t = pd.DataFrame([r for f in farms for r in f])
    for c in ["eia_id", "p_year", "p_tnum", "t_retrofit", "t_retro_yr", "t_offshore", "case_id"]:
        t[c] = pd.to_numeric(t[c], errors="coerce").astype("Int64")
    return t


def ids(t):
    return sorted(int(i) for i in candidates(t)["eia_id"])


def test_a_plain_farm_is_kept_with_its_summary():
    c = candidates(table(farm(1, 40)))
    assert len(c) == 1
    row = c.iloc[0]
    assert (row["eia_id"], row["n_turbines"], row["t_model"], row["t_state"], row["p_year"]) == (1, 40, "V110-2.0", "IA", 2016)
    assert row["capacity_mw"] == pytest.approx(80.0)            # 40 × 2000 kW
    assert row["hub_height_m"] == 80.0 and row["rotor_diameter_m"] == 110.0


def test_centroid_is_the_mean_position():
    row = candidates(table(farm(1, 21))).iloc[0]
    assert row["lon"] == pytest.approx(-95.0 + 0.01 * 10) and row["lat"] == pytest.approx(42.0 + 0.002 * 10)


def test_mixed_models_are_rejected():
    mixed = farm(2, 30)
    mixed[5]["t_model"] = "V100-2.0"
    assert ids(table(farm(1, 40), mixed)) == [1]


def test_mixed_build_years_are_rejected():
    phased = farm(2, 30)
    phased[0]["p_year"] = 2018
    assert ids(table(farm(1, 40), phased)) == [1]


def test_size_limits():
    assert ids(table(farm(1, 19), farm(2, 20), farm(3, 150), farm(4, 151))) == [2, 3]


def test_too_recent_to_have_enough_history():
    assert ids(table(farm(1, 40, year=2019), farm(2, 40, year=2020))) == [1]


def test_repowered_offshore_and_hilly_farms_are_rejected():
    repowered = farm(2, 30); repowered[3]["t_retrofit"] = 1
    assert ids(table(farm(1, 40), repowered, farm(3, 30, t_offshore=1), farm(4, 30, state="WV"))) == [1]


def test_missing_dimensions_are_rejected():
    assert ids(table(farm(1, 40), farm(2, 30, t_hh=None), farm(3, 30, t_rd=None), farm(4, 30, cap=None))) == [1]


def test_a_plant_built_as_two_named_projects_is_rejected():
    assert ids(table(farm(1, 40), farm(2, 20, name="West") + farm(2, 20, name="East"))) == [1]


def test_turbines_without_a_plant_id_are_ignored():
    orphan = farm(9, 30); [r.update(eia_id=None) for r in orphan]
    assert ids(table(farm(1, 40), orphan)) == [1]


def test_capacity_factor_uses_the_hours_in_each_year():
    months = pd.period_range("2023-01", periods=24, freq="M")
    gen = pd.DataFrame({"month": months, "net_mwh": [100.0 * m.days_in_month * 24 * 0.4 for m in months], "reported_monthly": True})
    cf = capacity_factors(gen, capacity_mw=100.0)
    assert cf.to_dict() == pytest.approx({2023: 0.4, 2024: 0.4})   # 2024 is a leap year


def test_generation_screen_names_the_reason():
    months = pd.period_range("2023-01", periods=12, freq="M")
    good = pd.DataFrame({"month": months, "net_mwh": [80.0 * m.days_in_month * 24 * 0.42 for m in months], "reported_monthly": True})
    assert screen_generation(good, capacity_mw=80.0) is None
    assert "annual" in screen_generation(good.assign(reported_monthly=False), capacity_mw=80.0)
    assert "capacity factor" in screen_generation(good.assign(net_mwh=good["net_mwh"] * 0.3), capacity_mw=80.0)
    assert "capacity factor" in screen_generation(good.assign(net_mwh=good["net_mwh"] * 1.6), capacity_mw=80.0)
    holed = good.copy(); holed.loc[4, "net_mwh"] = float("nan")
    assert "missing" in screen_generation(holed, capacity_mw=80.0)


def test_neighbours_counts_other_farms_turbines_by_distance():
    from energy.select_farm import neighbours
    home = farm(1, 20)                                              # spans 0.19 degrees of longitude from -95.0
    close = farm(2, 5, lon=-95.0, lat=42.03)                        # about 3.3 km north of the first turbine
    far = farm(3, 5, lon=-95.0, lat=42.5)                           # about 55 km north
    orphan = farm(4, 3, lon=-95.0, lat=42.02); [r.update(eia_id=None) for r in orphan]   # no plant id, still a neighbour
    t = table(home, close, far, orphan)
    assert neighbours(t, 1, within_km=5.0) == 8                     # five close ones and three orphans
    assert neighbours(t, 1, within_km=1.0) == 0
    assert neighbours(t, 1, within_km=100.0) == 13
    assert neighbours(t, 3, within_km=5.0) == 0
