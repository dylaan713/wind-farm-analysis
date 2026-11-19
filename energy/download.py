"""Fetch and cache the three public data sources.

Everything lands in data/raw/ (git-ignored). Each fetch is cached and atomic. Tests never touch
the network: they call the parse_* functions on small sample files.

Sources and their exact shapes were checked on 2026-11-14; see docs/data-sources.md.
"""
from __future__ import annotations

import datetime as _dt
import io
import json
import zipfile
from pathlib import Path

import pandas as pd
import requests

RAW = Path("data/raw")
USER_AGENT = "wind-farm-study"   # generic on purpose: no names, no contact details
TIMEOUT_S = 60

# --- 1. US Wind Turbine Database (USGS) -------------------------------------------------------
TURBINES_URL = "https://energy.usgs.gov/api/uswtdb/v1/turbines"
TURBINE_FIELDS = [
    "case_id", "eia_id", "p_name", "t_state", "p_year", "p_tnum", "p_cap", "t_manu", "t_model",
    "t_cap", "t_hh", "t_rd", "xlong", "ylat", "t_retrofit", "t_retro_yr", "t_offshore",
]
_TURBINE_FLOATS = ["p_cap", "t_cap", "t_hh", "t_rd", "xlong", "ylat"]
_TURBINE_INTS = ["case_id", "eia_id", "p_year", "p_tnum", "t_retrofit", "t_retro_yr", "t_offshore"]

# --- 2. EIA Form 923 --------------------------------------------------------------------------
EIA923_BASE = "https://www.eia.gov/electricity/data/eia923"
EIA923_FIRST_YEAR = 2008                      # earlier years use a different form
EIA923_MEMBER = "Schedules_2_3_4_5"           # the workbook's name changes yearly; this part does not
EIA923_SHEET = "Page 1 Generation and Fuel Data"
EIA923_HEADER_ROW = 6                         # 1-based
WIND_FUEL = "WND"
MONTHLY_REPORTER = "M"                        # 'A' and 'AM' are not treated as measured monthly
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

# --- 3. ERA5 through Open-Meteo's historical archive --------------------------------------------
WIND_URL = "https://archive-api.open-meteo.com/v1/archive"
WIND_VARS = {"wind_speed_100m": "m/s", "wind_direction_100m": "°", "temperature_2m": "°C", "surface_pressure": "hPa"}
# Always named. Left to choose, the service answers with ERA5 before 2017 and ECMWF IFS (a finer,
# different model) from 2017 on; checked 2026-11-14. One model for every year, or the long record has a seam.
WIND_MODEL = "era5"
ERA5_GRID_DEG = 0.25


def fetch(url: str, dest: Path, *, params: dict | None = None, force: bool = False) -> Path:
    """Download url to dest unless it is already there. Writes to a .part file and renames on success."""
    dest = Path(dest)
    if dest.exists() and not force:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + ".part")
    try:
        reply = requests.get(url, params=params, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT_S)
        if reply.status_code != 200:
            raise RuntimeError(f"{url} answered {reply.status_code}")
        part.write_bytes(reply.content)
        part.replace(dest)
    except requests.RequestException as err:
        raise RuntimeError(f"could not fetch {url}: {err}") from err
    finally:
        part.unlink(missing_ok=True)
    return dest


# ---- turbines ----------------------------------------------------------------------------------
def parse_turbines(path: Path) -> pd.DataFrame:
    t = pd.DataFrame(json.loads(Path(path).read_text()))
    missing = [c for c in TURBINE_FIELDS if c not in t.columns]
    if missing:
        raise ValueError(f"turbine data is missing fields: {missing}")
    for c in _TURBINE_FLOATS:
        t[c] = pd.to_numeric(t[c], errors="coerce").astype("float64")
    for c in _TURBINE_INTS:
        t[c] = pd.to_numeric(t[c], errors="coerce").astype("Int64")
    return t[TURBINE_FIELDS]


def turbines(force: bool = False) -> pd.DataFrame:
    """Every turbine in the database, one row each."""
    path = fetch(TURBINES_URL, RAW / "uswtdb" / "turbines.json", params={"select": ",".join(TURBINE_FIELDS)}, force=force)
    return parse_turbines(path)


# ---- generation --------------------------------------------------------------------------------
def generation_url(year: int, today_year: int | None = None) -> str:
    """The two newest years sit beside the page; everything older is under archive/."""
    if year < EIA923_FIRST_YEAR:
        raise ValueError(f"EIA Form 923 starts in {EIA923_FIRST_YEAR}; {year} uses an older form")
    today_year = today_year or _dt.date.today().year
    folder = "xls" if year >= today_year - 1 else "archive/xls"
    return f"{EIA923_BASE}/{folder}/f923_{year}.zip"


def _clean(header) -> str:
    return " ".join(str(header).split()) if header is not None else ""


def _read_wind_rows(source) -> pd.DataFrame:
    """All wind rows of one year's sheet: plant_id, plant_name, state, frequency, year, twelve months."""
    raw = pd.read_excel(source, sheet_name=EIA923_SHEET, header=EIA923_HEADER_ROW - 1, engine="openpyxl")
    raw.columns = [_clean(c) for c in raw.columns]
    need = ["Plant Id", "Plant Name", "Plant State", "Reported Fuel Type Code", "Respondent Frequency", "YEAR"] + [f"Netgen {m}" for m in MONTHS]
    missing = [c for c in need if c not in raw.columns]
    if missing:
        raise ValueError(f"generation sheet is missing columns: {missing}")
    wind_rows = raw[raw["Reported Fuel Type Code"].astype(str).str.strip() == WIND_FUEL]
    out = pd.DataFrame({
        "plant_id": pd.to_numeric(wind_rows["Plant Id"], errors="coerce").astype("Int64"),
        "plant_name": wind_rows["Plant Name"].astype(str).str.strip(),
        "state": wind_rows["Plant State"].astype(str).str.strip(),
        "frequency": wind_rows["Respondent Frequency"].fillna("").astype(str).str.strip(),
        "year": pd.to_numeric(wind_rows["YEAR"], errors="coerce").astype("Int64"),
    })
    for i, m in enumerate(MONTHS, start=1):
        out[f"m{i:02d}"] = pd.to_numeric(wind_rows[f"Netgen {m}"], errors="coerce").astype("float64")   # "." becomes NaN
    return out.reset_index(drop=True)


def _plant_months(wind_rows: pd.DataFrame, plant_id: int) -> pd.DataFrame:
    rows = wind_rows[wind_rows["plant_id"] == plant_id]
    if rows.empty:
        raise ValueError(f"plant {plant_id} has no wind ({WIND_FUEL}) row in this file")
    year = int(rows["year"].iloc[0])
    month_cols = [f"m{i:02d}" for i in range(1, 13)]
    # A plant can have more than one wind row; a month is missing only if every row lacks it.
    totals = rows[month_cols].sum(axis=0, min_count=1)
    return pd.DataFrame({
        "month": pd.period_range(f"{year}-01", periods=12, freq="M"),
        "net_mwh": totals.to_numpy(dtype="float64"),
        "reported_monthly": bool((rows["frequency"] == MONTHLY_REPORTER).all()),
    })


def parse_generation(path: Path, plant_id: int) -> pd.DataFrame:
    """Twelve months for one plant from one year's workbook. Values are kept exactly as reported."""
    return _plant_months(_read_wind_rows(path), plant_id)


def wind_plants(year: int, force: bool = False) -> pd.DataFrame:
    """Every wind row EIA published for a year. The 20 MB workbook is read once and cached as CSV."""
    cache = RAW / "eia923" / f"wind_{year}.csv"
    if cache.exists() and not force:
        return pd.read_csv(cache, dtype={"plant_id": "Int64", "year": "Int64", "frequency": "string", "plant_name": "string", "state": "string"}, keep_default_na=False, na_values=[""]).assign(
            frequency=lambda f: f["frequency"].fillna("")
        )
    archive = fetch(generation_url(year), RAW / "eia923" / f"f923_{year}.zip", force=force)
    with zipfile.ZipFile(archive) as z:
        members = [n for n in z.namelist() if EIA923_MEMBER in n]
        if len(members) != 1:
            raise ValueError(f"expected one '{EIA923_MEMBER}' workbook in {archive.name}, found {members}")
        rows = _read_wind_rows(io.BytesIO(z.read(members[0])))
    cache.parent.mkdir(parents=True, exist_ok=True)
    rows.to_csv(cache, index=False)
    return rows


def generation(plant_id: int, years: list[int]) -> pd.DataFrame:
    """Monthly reported net generation for one plant over several years."""
    return pd.concat([_plant_months(wind_plants(y), plant_id) for y in years], ignore_index=True)


# ---- wind --------------------------------------------------------------------------------------
def parse_wind(payload: dict) -> pd.DataFrame:
    units = payload.get("hourly_units", {})
    for name, unit in WIND_VARS.items():
        if units.get(name) != unit:
            raise ValueError(f"{name} came back in {units.get(name)!r}, expected {unit!r}")
    for axis in ("latitude", "longitude"):
        v = payload.get(axis)
        if v is not None and abs(v / ERA5_GRID_DEG - round(v / ERA5_GRID_DEG)) > 1e-6:
            raise ValueError(f"{axis} {v} is not on the ERA5 quarter-degree grid: this is not ERA5 data")
    h = payload["hourly"]
    num = lambda name: pd.to_numeric(pd.Series(h[name], dtype="object"), errors="coerce").to_numpy(dtype="float64")
    return pd.DataFrame(
        {
            "speed_100m": num("wind_speed_100m"),
            "dir_100m": num("wind_direction_100m"),
            "temp_k": num("temperature_2m") + 273.15,
            "pressure_pa": num("surface_pressure") * 100.0,
        },
        index=pd.DatetimeIndex(pd.to_datetime(h["time"]), tz="UTC", name="time"),
    )


def wind(lat: float, lon: float, start_year: int, end_year: int) -> pd.DataFrame:
    """Hourly wind at 100 m and the air's state at a point, one request per year."""
    frames = []
    for year in range(start_year, end_year + 1):
        dest = RAW / "wind" / f"{WIND_MODEL}_{lat:.4f}_{lon:.4f}_{year}.json"
        fetch(WIND_URL, dest, params={
            "latitude": lat, "longitude": lon, "start_date": f"{year}-01-01", "end_date": f"{year}-12-31",
            "hourly": ",".join(WIND_VARS), "wind_speed_unit": "ms", "timezone": "GMT", "models": WIND_MODEL,
        })
        frames.append(parse_wind(json.loads(dest.read_text())))
    return pd.concat(frames)
