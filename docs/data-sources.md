# Data sources for the energy model

Checked against each source on 2026-11-14 (energy plan, Task 1 Step 1). All three are free and need
no key or account. Re-check before relying on any of this after a long gap.

## 1. Turbines: US Wind Turbine Database (USGS)

- **Address:** `https://energy.usgs.gov/api/uswtdb/v1/turbines` returns JSON, one object per turbine.
  It answered a plain request with a generic client name; `?limit=1` returned one record.
- **Fields seen in a live record** (the ones the plan uses): `eia_id`, `p_name`, `t_state`, `p_year`,
  `p_tnum` (turbines in the project), `p_cap` (project MW), `t_manu`, `t_model`, `t_cap` (kW),
  `t_hh` (hub height, m), `t_rd` (rotor diameter, m), `xlong`, `ylat`.
- **Also present and useful:** `t_retrofit` (0 or 1) and `t_retro_yr`. A retrofitted turbine means
  the farm was repowered, which the selection criteria exclude. `t_offshore` marks offshore turbines.
- **Tested live:** one request with a `select=` list of fields returned all 77,839 turbines (22 MB,
  about two seconds), so no paging is needed. 1,348 distinct EIA plant ids.
- **Not yet confirmed:** the citation wording. The data page itself
  (`https://energy.usgs.gov/uswtdb/data/`) refuses automated readers, so read it in a browser.

## 2. Reported generation: EIA Form 923

- **Address:** `https://www.eia.gov/electricity/data/eia923/archive/xls/f923_YYYY.zip` for 2008 to
  2024. The two newest years are not under `archive`: `https://www.eia.gov/electricity/data/eia923/xls/f923_2025.zip`
  and `…/xls/f923_2026.zip` (2026 is monthly data to date, not a full year). 2024 downloaded: 22.8 MB.
- **File inside (2024):** `EIA923_Schedules_2_3_4_5_M_12_2024_Final.xlsx`. The name changes each
  year, so find it by pattern (`Schedules_2_3_4_5`), not by exact name.
- **Sheet:** `Page 1 Generation and Fuel Data`. **Header row: 6.** 97 columns.
- **Columns** (0-based position in 2024; match by name, positions can move between years):
  `Plant Id` (0), `Plant Name` (3), `Plant State` (6), `Reported Fuel Type Code` (14; wind is `WND`),
  `Respondent Frequency` (17), `Netgen January` … `Netgen December` (79–90),
  `Net Generation (Megawatthours)` (95), `YEAR` (96).
- **Monthly against annual reporters.** `Respondent Frequency` takes the values `A`, `AM` and `M`.
  The file's own layout sheet says only that it "designates the reporting frequency for the plant";
  it does not define the three codes. EIA's page says about 3,034 plants are in the monthly survey
  and about 9,528 more report through the annual one.
  - Wind rows in 2024: **594 `M`, 753 `AM`, 13 blank.**
  - **Rule adopted:** only `M` counts as a monthly reporter. `AM` is treated as *not* measured
    monthly until EIA's documentation is found to say otherwise. 594 wind plants is plenty to
    choose from, so nothing is lost by being strict.
- **Nameplate capacity** is not on this sheet. It is in EIA Form 860 (a separate yearly file); the
  plan's capacity check (Task 2 Step 3) needs that source confirmed, or can use `p_cap` from the
  turbine database instead.

## 3. Wind: ERA5 through Open-Meteo's historical archive

- **Address:** `https://archive-api.open-meteo.com/v1/archive`
- **Hourly variables:** `wind_speed_100m`, `wind_direction_100m`, `temperature_2m`,
  `surface_pressure`. 100 m wind is listed as available (from ERA5, at 0.25°), from 1940.
- **Parameters:** `latitude`, `longitude`, `start_date`, `end_date`, `hourly=…`,
  `wind_speed_unit=ms` (the default is km/h), `timezone=GMT` (the default), and **`models=era5`**.
- **The model must be named.** Left to choose, the service answers with ERA5 before 2017 and with
  ECMWF IFS, a different and finer model, from 2017 on. Tested live: for a week in 2010 and in 2016
  the default and `models=era5` returned identical values; for a week in 2017 and in 2023 they
  differed, and the default matched `models=ecmwf_ifs` exactly. The default also snaps to a point
  off ERA5's quarter-degree grid (41.019, −95.007 for a request at 41.0, −95.0). The downloader
  always sends `models=era5`, names its cache files by model, and refuses a reply that is off the grid.
- **Key:** none for non-commercial use.
- **Not stated on the docs page:** the rate limits and the exact licence terms. The page asks for
  a citation (Zippenfenig, P. (2023), *Open-Meteo.com Weather API*, Zenodo) and credits "Copernicus
  Climate Change Service information". Read the licence page before the site goes public.
- **Tested live:** a full year (2023) for one point returned 8,760 hours with none missing.

## What this changes in the plan

- The turbine source is a JSON API, not a CSV download.
- Farm selection gains two ready-made filters: `t_retrofit = 0` and `Respondent Frequency = M`.
- The capacity check uses the turbine database's own `p_cap` (project MW) against turbine count ×
  rating. EIA Form 860 has not been brought in.
