import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from energy import download as d

S = Path(__file__).parent / "samples"


def test_parse_turbines_has_the_columns_and_types():
    t = d.parse_turbines(S / "turbines.json")
    assert len(t) == 20
    for col in ["eia_id", "p_name", "t_state", "p_year", "t_manu", "t_model", "t_cap", "t_hh", "t_rd", "xlong", "ylat", "t_retrofit"]:
        assert col in t.columns, col
    for col in ["t_cap", "t_hh", "t_rd", "xlong", "ylat"]:
        assert pd.api.types.is_float_dtype(t[col]), col
    # eia_id is whole numbers but may be missing, so it is a nullable integer.
    assert str(t["eia_id"].dtype) == "Int64"
    assert t["eia_id"].isna().sum() == 1
    assert (t["eia_id"] == 65511).sum() == 12


def test_parse_generation_returns_twelve_months_for_a_wind_plant():
    g = d.parse_generation(S / "f923_sample.xlsx", 7526)
    assert len(g) == 12
    assert list(g["month"].astype(str))[:2] == ["2024-01", "2024-02"]
    assert str(g["month"].iloc[-1]) == "2024-12"
    assert g["net_mwh"].iloc[0] == pytest.approx(11526.0)
    assert g["net_mwh"].sum() == pytest.approx(639926.0, abs=1.0)
    assert pd.api.types.is_float_dtype(g["net_mwh"])


def test_parse_generation_rejects_a_plant_with_no_wind_row():
    with pytest.raises(ValueError, match="3"):
        d.parse_generation(S / "f923_sample.xlsx", 3)      # Barry: natural gas only
    with pytest.raises(ValueError, match="99999"):
        d.parse_generation(S / "f923_sample.xlsx", 99999)  # not in the file


def test_parse_generation_flags_annual_reporters():
    assert d.parse_generation(S / "f923_sample.xlsx", 7526)["reported_monthly"].all()       # frequency M
    assert not d.parse_generation(S / "f923_sample.xlsx", 90)["reported_monthly"].any()     # frequency AM


def test_parse_generation_keeps_zero_and_negative_months(tmp_path):
    import openpyxl
    wb = openpyxl.load_workbook(S / "f923_sample.xlsx")
    ws = wb.active
    header = [str(c.value).replace("\n", " ").strip() if c.value else "" for c in ws[6]]
    jan, feb, mar = (header.index(f"Netgen {m}") + 1 for m in ("January", "February", "March"))
    ws.cell(row=7, column=jan, value=0); ws.cell(row=7, column=feb, value=-12.5); ws.cell(row=7, column=mar, value=".")
    wb.save(tmp_path / "edited.xlsx")
    g = d.parse_generation(tmp_path / "edited.xlsx", 7526)
    assert g["net_mwh"].iloc[0] == 0.0
    assert g["net_mwh"].iloc[1] == -12.5
    assert np.isnan(g["net_mwh"].iloc[2])   # "." is EIA's mark for no value


def test_parse_wind_converts_units_and_keeps_gaps():
    payload = json.loads((S / "wind-week.json").read_text())
    payload["hourly"]["wind_speed_100m"][5] = None
    w = d.parse_wind(payload)
    assert len(w) == 168
    assert str(w.index.tz) == "UTC"
    assert list(w.columns) == ["speed_100m", "dir_100m", "temp_k", "pressure_pa"]
    assert w["speed_100m"].iloc[0] == pytest.approx(4.79)
    assert w["temp_k"].iloc[0] == pytest.approx(3.8 + 273.15)
    assert w["pressure_pa"].iloc[0] == pytest.approx(96810.0)
    assert np.isnan(w["speed_100m"].iloc[5]) and w["speed_100m"].isna().sum() == 1


def test_parse_wind_refuses_the_wrong_units():
    payload = json.loads((S / "wind-week.json").read_text())
    payload["hourly_units"]["wind_speed_100m"] = "km/h"
    with pytest.raises(ValueError, match="m/s"):
        d.parse_wind(payload)


class _Reply:
    def __init__(self, status=200, content=b"hello"):
        self.status_code, self.content = status, content


def test_fetch_uses_cache(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(d.requests, "get", lambda *a, **k: calls.append(a) or _Reply())
    dest = tmp_path / "sub" / "file.bin"
    assert d.fetch("https://example.org/x", dest).read_bytes() == b"hello"
    d.fetch("https://example.org/x", dest)
    assert len(calls) == 1
    headers_sent = []
    monkeypatch.setattr(d.requests, "get", lambda *a, **k: headers_sent.append(k.get("headers")) or _Reply())
    d.fetch("https://example.org/x", dest, force=True)
    assert headers_sent == [{"User-Agent": "wind-farm-study"}]


def test_fetch_is_atomic_and_names_the_url_on_failure(tmp_path, monkeypatch):
    dest = tmp_path / "file.bin"
    monkeypatch.setattr(d.requests, "get", lambda *a, **k: _Reply(status=503))
    with pytest.raises(RuntimeError, match="https://example.org/missing"):
        d.fetch("https://example.org/missing", dest)
    assert not dest.exists() and not list(tmp_path.iterdir())

    def boom(*a, **k):
        raise d.requests.ConnectionError("no route")
    monkeypatch.setattr(d.requests, "get", boom)
    with pytest.raises(RuntimeError, match="https://example.org/missing"):
        d.fetch("https://example.org/missing", dest)
    assert not list(tmp_path.iterdir())


def test_generation_url_knows_which_years_are_archived():
    assert d.generation_url(2024, today_year=2026).endswith("/archive/xls/f923_2024.zip")
    assert d.generation_url(2008, today_year=2026).endswith("/archive/xls/f923_2008.zip")
    assert d.generation_url(2025, today_year=2026).endswith("/eia923/xls/f923_2025.zip")
    assert d.generation_url(2026, today_year=2026).endswith("/eia923/xls/f923_2026.zip")
    with pytest.raises(ValueError):
        d.generation_url(2007, today_year=2026)   # a different form before 2008
