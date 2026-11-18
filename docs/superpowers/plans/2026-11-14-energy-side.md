# Energy Side Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Predict a real US wind farm's energy output from public wind data, check the prediction against the farm's reported generation, quantify the uncertainty, and hand the results to the finance model and the site.

**Architecture:** A Python package in `energy/` downloads public data into a git-ignored cache, models one turbine, then the whole farm with a hand-written Jensen wake model, reports a blind prediction with losses assumed in advance, then calibrates one factor on earlier years and tests it on a held-out year, and runs a Monte Carlo for P-values. It writes small JSON result files to `data/results/`. A small TypeScript version of the turbine and wake math in `core/src/energy/` is tested against fixtures the Python writes, so the site can run it live.

**Tech Stack:** Python 3.12+ with `uv`, `numpy`, `pandas`, `openpyxl`, `requests`, `pytest` · Node 22.12+, TypeScript, `vitest` (already set up in `core/`). All free; no API keys.

**Spec:** `docs/superpowers/specs/2026-11-14-wind-farm-design.md` (sections 5 and 6)

## Global Constraints

- Free only. No paid tiers, trials needing a card, or metered API keys. **If a data source turns out to need a key or an account, stop and ask Dylan.**
- Raw downloads go in `data/raw/` (git-ignored). Only small result files in `data/results/` and `data/fixtures/` are committed; each under 200 KB.
- Tests never touch the network. They use small sample files in `energy/tests/samples/`.
- The wake model and the turbine model are written by hand. Do not install PyWake, windpowerlib, floris or similar.
- The validation error is published as measured. Never tune on the held-out year, never drop a month without listing it and the reason.
- **Say what the test is.** The wording everywhere (site, README, notes, resumes) is: "calibrated on the farm's earlier years, tested on a held-out year". Never "predicted the farm's output within X%" for the calibrated result. The blind result is the only one that may be called a prediction, and it is published beside the calibrated one even if it is much worse.
- Work on a branch, push it, open a pull request and stop. **Dylan does all merging.** Never merge, and never commit or push to `main`.
- Commit with a GitHub noreply email. The repo will be public.
- Nothing ships that Dylan cannot explain out loud without notes.
- Requests to data services carry only public coordinates and dates. No names, no email, a generic client name.
- `core/src/energy/` must reproduce the Python fixtures within 0.5%.

## Decision recorded here

The design doc named ERA5 and the WIND Toolkit as wind-data candidates. **This plan uses ERA5 through Open-Meteo's historical archive**: hourly wind at 100 m, 1940 to present, no key, free for non-commercial use with attribution (CC BY 4.0). The WIND Toolkit is dropped from the first pass because it needs a key and covers fewer years. If Task 1 finds Open-Meteo does not serve 100 m wind for the years needed, stop and ask.

## Review Focus

Conditions the spec does not spell out but real data will produce. Each has a test in the task named.

1. **Missing or blank hours in the wind data.** Count them; a month with more than 2% missing is flagged and excluded from validation, with the reason listed. Never filled silently. (Task 1, Task 6)
2. **Months where the farm reported zero or negative generation** (outage, curtailment, metering). Flagged and excluded with the reason; the count of excluded months is published. (Task 6)
3. **Wind direction at the 0°/360° wrap, and wind exactly along a row of turbines.** Direction bins wrap correctly; 359.9° and 0.1° give the same answer. (Tasks 4, 5)
4. **Wind speed outside the power curve:** below cut-in and at or above cut-out give 0, never an extrapolated or negative value. (Task 3)
5. **A farm that reports to the government once a year.** Its twelve monthly figures are the agency's estimate, not measurements. Selection rejects it, and validation refuses to run on it. (Tasks 1, 2, 6)
6. **A farm whose turbine count changed during the study years.** Selection rejects it; a check compares turbine count × rating with the reported capacity. (Task 2)
7. **A download that fails or is cut off.** Downloaders write to a temp name and rename on success, reuse the cache on the next run, and raise an error that names the URL. (Task 1)

## The model, exactly

**Coordinates.** Turbine longitude/latitude become local metres around the farm centroid (lat₀, lon₀): `x = (lon − lon₀) × 111195.08 × cos(lat₀)`, `y = (lat − lat₀) × 111195.08`. x is east, y is north.

**Wind direction** is the compass bearing the wind comes **from**, degrees clockwise from north. The air travels along the unit vector `(−sin θ, −cos θ)`.

**One turbine, one hour**
```
v_hub  = v_100 × (hub_height / 100)^alpha            alpha = 0.14 (shear exponent)
rho    = surface_pressure_Pa / (287.05 × temperature_K)
v_eq   = v_hub × (rho / 1.225)^(1/3)                 density correction
power  = power curve at v_eq, linear between points;
         0 below cut-in, 0 at or above cut-out
```

**Thrust.** If the turbine has a published thrust curve, use it. Otherwise derive it from the power curve with momentum theory:
```
Cp_grid  = P / (0.5 × 1.225 × pi × r0^2 × v^3)       from the electrical power curve
Cp_rotor = Cp_grid / 0.78                            capped at 16/27
solve Cp_rotor = 4a(1−a)^2 for a in [0, 1/3]         (bisection)
Ct = 4a(1−a)                                         capped at 0.9
```
**Why 0.78 (changed 2026-11-15, approved by Dylan).** Momentum theory describes an ideal rotor
with no losses. Used directly on the electrical power curve it treats the electricity as all the
energy the rotor took from the wind, and gives too little thrust. Measured on the 36 turbines in
the Open Energy Platform library that publish both curves, the uncorrected thrust coefficient is
about 0.53 between 5 and 9 m/s where the published one is about 0.79. Dividing by one efficiency
closes most of that gap. The value was fitted on the 24 turbines from other makers (0.78) and
tested on the 12 Vestas turbines: mean absolute error in Ct of 0.056 over 4 to 16 m/s, against
0.185 uncorrected. 0.78 is **not** a drivetrain efficiency; it stands for everything between an
ideal rotor and the grid (blade drag, tip losses, wake rotation, gearbox, generator, converter).
**Known weakness:** it still gives too little thrust in light wind (0.32 low at 4 m/s, 0.15 low
at 5 m/s), where little energy is made. Re-run with `uv run python -m energy.thrust_check`.
`core/src/energy/` (Task 8) uses the same 0.78.
**Credit and limit.** The 0.78 contains information from the Open Energy Platform wind turbine
library, © Reiner Lemoine Institut, made available under the Open Database License (ODbL) 1.0.
That licence is share-alike for the database itself, so its rows are never committed, not even
as test samples; the credit goes wherever the number is published, the site included.

**Wake of one upstream turbine on one downstream turbine** (Jensen/Park). With `x` the distance downwind and `c` the distance crosswind, both in metres, and `r0` the rotor radius:
```
if x <= 0: no effect
wake radius      Rw = r0 + k × x                      k = 0.075
deficit          d  = (1 − sqrt(1 − Ct)) / (1 + k × x / r0)^2
overlap          f  = area of the rotor disc inside the wake circle / rotor area
                      (two circles, radii r0 and Rw, centres c apart)
effect           = d × f
```
**Combining wakes:** the total deficit at a turbine is the square root of the sum of squared effects. Its wind speed is `v × (1 − total)`. Turbines are processed from most upwind to most downwind, and each one's Ct is taken at its own waked speed.

**The farm.** Build a table of farm power for each direction bin (72 bins of 5°, centred on 0, 5, …) and each speed bin (0 to 30 m/s in 0.5 m/s steps). Hourly farm power is looked up in that table with linear interpolation in speed. Gross energy ignores wakes; wake loss is `1 − waked / gross`.

**Calibration and validation.**
```
Two results are produced and both are published.

A. Blind prediction: no number is taken from the farm's own output.
   assumed_losses     = 1 − (1−0.03)(1−0.02)(1−0.02)(1−0.02)      = 0.0870
                        availability 3%, electrical 2%, turbine performance 2%, environmental 2%
                        (typical published values; cite the source in Task 6; fixed BEFORE looking at the farm's output)
   blind(month)       = modelled waked(month) × (1 − assumed_losses)
   blind_error        = (sum blind − sum reported) / sum reported      over ALL usable months

B. Calibrated on earlier years, tested on a held-out year.
   calibration_factor = sum(reported net MWh) / sum(modelled waked MWh)     over calibration months only
   net(month)         = modelled waked(month) × calibration_factor

The calibration factor is NOT a loss figure. It absorbs every reason the model runs high or low on
average: real losses (downtime, electrical, curtailment) and also any bias in the wind data, the
shear exponent and the power curve. It can be far from 0.9 and can exceed 1. Never present
(1 − calibration_factor) as "losses".
```
For B, report on the held-out year only: annual error %, monthly mean absolute % error, R² of monthly values. That test shows how well the model tracks year-to-year and month-to-month changes at this farm once its average level is set. It does not show a from-scratch prediction of total output; result A does. The held-out year is the most recent full year. All earlier usable years are calibration.

**Uncertainty.**
```
long-term series  = model run on every full year from 2000 with today's layout and calibration_factor
P50               = mean of that series
sigma_iav         = standard deviation of yearly totals / P50          (year-to-year wind)
sigma_model       = max(0.03, |held-out annual error|)                 (floor of 3%)
1-year sigma      = sqrt(sigma_iav^2 + sigma_model^2)
10-year sigma     = sqrt(sigma_iav^2 / 10 + sigma_model^2)
Monte Carlo: 20,000 draws of P50 × (1 + e_iav) × (1 + e_model), normal errors, fixed seed 20261114
P75, P90, P99     = the 25th, 10th and 1st percentiles of the draws
```

## Contract 1: what the finance model and the site receive

`data/results/energy-contract.json`:

```json
{
  "model_version": "1.0.0",
  "generated": "2026-12-01",
  "farm": { "name": "", "eia_plant_id": 0, "state": "", "capacity_mw": 0, "turbine_count": 0,
            "turbine_model": "", "hub_height_m": 0, "rotor_diameter_m": 0 },
  "energy_mwh":      { "p50": 0, "p75": 0, "p90": 0, "p99": 0 },
  "energy_mwh_10yr": { "p50": 0, "p75": 0, "p90": 0, "p99": 0 },
  "monthly_shape": [0,0,0,0,0,0,0,0,0,0,0,0],
  "wake_loss_pct": 0,
  "blind": { "assumed_losses_pct": 8.7, "error_pct": 0, "months_used": 0 },
  "calibration": { "factor": 0, "note": "absorbs real losses and model and wind-data bias; not a loss figure" },
  "uncertainty": { "sigma_iav": 0, "sigma_model": 0 },
  "validation": { "calibration_years": [], "holdout_year": 0, "annual_error_pct": 0,
                  "monthly_mape_pct": 0, "r2": 0, "excluded_months": [] },
  "assumptions": { "alpha": 0.14, "wake_k": 0.075, "wind_source": "ERA5 via Open-Meteo" }
}
```

`monthly_shape` sums to 1. `blind.error_pct` is positive when the model is above the reported total. `excluded_months` entries are `{ "month": "2021-02", "reason": "…" }`. The finance workbook's `energy_p50_mwh`, `energy_p90_mwh`, `energy_p99_mwh` and `capacity_mw` come from the 1-year block and `farm`.

## File map

| File | Job |
|---|---|
| `pyproject.toml` | Python project and dependencies (shared with `finance/`) |
| `energy/download.py` | Fetch and cache the three public data sources |
| `energy/select_farm.py` | List farms that meet the criteria |
| `energy/geometry.py` | Lon/lat to local metres; downwind and crosswind distances |
| `energy/turbine.py` | Shear, density, power curve, thrust |
| `energy/wake.py` | Jensen deficit, overlap, combination |
| `energy/farm.py` | Direction × speed table; hourly and monthly energy |
| `energy/validate.py` | Calibration, held-out metrics, excluded months |
| `energy/uncertainty.py` | Long-term series, Monte Carlo, P-values |
| `energy/export.py` | Writes every file in `data/results/` and `data/fixtures/energy-cases.json` |
| `energy/run.py` | One command: `uv run python -m energy.run` |
| `energy/tests/` | One test file per module; `samples/` holds tiny data files |
| `data/turbines/<model>.csv` | The chosen turbine's power curve, with its source in the header |
| `data/results/*.json` | `energy-contract.json`, `validation-monthly.json`, `wind-rose.json`, `layout.json`, `power-curve.json` |
| `core/src/energy/` | `types.ts`, `turbine.ts`, `wake.ts`, `farm.ts`, `index.ts` and tests |
| `docs/farm-selection.md` | The shortlist and the choice |
| `docs/notes/energy.md` | Dylan's own explanation of the method |

---

### Task 0: Python project

**Files:** Create or extend `pyproject.toml`; create `energy/__init__.py`, `energy/tests/__init__.py`

- [ ] **Step 1:** Branch `energy/setup`. If `pyproject.toml` exists (the finance side may have made it), add to it; otherwise create it: project name `wind-farm`, Python `>=3.12`, dependencies `numpy`, `pandas`, `openpyxl`, `requests`, dev dependency `pytest`, pytest `testpaths = ["energy/tests", "finance/tests"]`.
- [ ] **Step 2:** Run `uv sync`, then `uv run pytest`. Expected: no tests collected, exit code 5, no import errors.
- [ ] **Step 3:** Commit `pyproject.toml`, `uv.lock` and the two `__init__.py` files (`chore(energy): python project`).

### Task 1: Prove the data can be fetched

**Files:**
- Create: `energy/download.py`, `energy/tests/test_download.py`, `energy/tests/samples/` (three tiny files)

**Interfaces:**
- Produces:

```python
RAW = Path("data/raw")
def fetch(url: str, dest: Path, *, params: dict | None = None) -> Path      # cached, atomic
def turbines(force: bool = False) -> pd.DataFrame
    # columns: eia_id, p_name, t_state, p_year, t_manu, t_model, t_cap (kW), t_hh (m), t_rd (m), xlong, ylat
def generation(plant_id: int, years: list[int]) -> pd.DataFrame
    # columns: month (pandas Period, monthly), net_mwh (float), reported_monthly (bool)
    # reported_monthly is False when the plant filed one yearly total and the agency spread it over the months
def wind(lat: float, lon: float, start_year: int, end_year: int) -> pd.DataFrame
    # index: UTC hourly DatetimeIndex; columns: speed_100m (m/s), dir_100m (deg from), temp_k, pressure_pa
def parse_turbines(path: Path) -> pd.DataFrame
def parse_generation(path: Path, plant_id: int) -> pd.DataFrame
def parse_wind(payload: dict) -> pd.DataFrame
```

**Sources to confirm in Step 1 (do not trust these from memory):**
- US Wind Turbine Database, USGS: the CSV download of all turbines.
- EIA Form 923: one zip per year; the generation-and-fuel sheet has one row per plant and fuel with twelve monthly net-generation columns. Wind rows have fuel code `WND`.
- **How EIA Form 923 marks monthly against annual reporters.** Many smaller plants file one yearly total and the agency estimates the twelve months. The file is believed to carry a respondent-frequency column (annual or monthly) for each plant; find it in the form's own documentation, record the column name and its codes, and if no such marker exists, stop and ask, because monthly validation depends on it.
- Open-Meteo historical archive: hourly `wind_speed_100m`, `wind_direction_100m`, `temperature_2m`, `surface_pressure`, with wind in m/s and times in UTC, one request per year.

- [ ] **Step 1:** Open each source's own documentation and write the exact URLs, sheet name, header row and column names as constants at the top of `download.py`, with the date checked. If any source needs a key or account, stop and ask.
- [ ] **Step 2:** Save three tiny real samples into `energy/tests/samples/`: 20 rows of the turbine CSV, a cut-down generation sheet with three plants, one week of the wind response as JSON.
- [ ] **Step 3: Write the failing tests.**

```python
def test_parse_turbines_has_the_columns_and_types(): ...
    # 20 rows; t_cap, t_hh, t_rd, xlong, ylat are floats; eia_id is an integer type that allows missing

def test_parse_generation_returns_twelve_months_for_a_wind_plant(): ...
    # 12 rows, month 2023-01..2023-12, net_mwh floats; a plant with no WND row raises ValueError naming the plant id

def test_parse_generation_flags_annual_reporters(): ...
    # the sample sheet has one monthly and one annual reporter: reported_monthly is all True for the first, all False for the second

def test_parse_generation_keeps_zero_and_negative_months(): ...
    # values are returned as reported; excluding them is validate.py's job

def test_parse_wind_converts_units_and_keeps_gaps(): ...
    # temp_k == temp_c + 273.15; pressure_pa == hPa × 100; a null hour stays NaN; index is UTC

def test_fetch_uses_cache(tmp_path, monkeypatch): ...
    # second call with the file present makes no request

def test_fetch_is_atomic_and_names_the_url_on_failure(tmp_path, monkeypatch): ...
    # a failed request raises RuntimeError containing the URL and leaves no file at dest
```

- [ ] **Step 4:** Run `uv run pytest energy/tests/test_download.py -v`. Expected: 7 failures, module not found.
- [ ] **Step 5:** Implement `download.py`. `fetch` writes to `dest.with_suffix(dest.suffix + ".part")` and renames; sends `User-Agent: wind-farm-study`; 60-second timeout. `wind` requests one year at a time and concatenates.
- [ ] **Step 6:** Run the tests. Expected: 7 passed.
- [ ] **Step 7:** Prove live access once, by hand: `uv run python -c "from energy import download as d; print(len(d.turbines())); print(d.wind(41.0,-95.0,2023,2023).describe())"`. Expected: more than 70,000 turbines; 8,760 wind rows with mean speed between 5 and 10 m/s.
- [ ] **Step 8:** Commit (`feat(energy): cached downloaders for turbines, generation and wind`). Pull request.

### Task 2: Choose the farm — stops for Dylan

**Files:** Create `energy/select_farm.py`, `energy/tests/test_select_farm.py`, `docs/farm-selection.md`

**Interfaces:**
- Consumes: `download.turbines`, `download.generation`.
- Produces: `candidates(turbines: pd.DataFrame) -> pd.DataFrame` with one row per farm: `eia_id, p_name, t_state, p_year, n_turbines, t_model, capacity_mw, hub_height_m, rotor_diameter_m, lat, lon`.

**Criteria, from the spec, plus one found later (monthly reporting, Step 3):** one turbine model across the whole farm; 20 to 150 turbines; every turbine has the same `p_year`, and it is 2019 or earlier (so at least four full years of reports exist); `eia_id`, hub height and rotor diameter present; in a flat state (start with IA, KS, NE, OK, TX, ND, SD, MN, IL, IN).

- [ ] **Step 1: Write the failing tests** on a hand-built table:

```python
def test_mixed_models_are_rejected(): ...
def test_mixed_build_years_are_rejected(): ...
def test_size_limits(): ...            # 19 and 151 turbines rejected; 20 and 150 kept
def test_capacity_is_count_times_rating(): ...   # 40 × 2000 kW -> 80.0 MW
def test_centroid_is_the_mean_position(): ...
```

- [ ] **Step 2:** Run. Expected: failures. Implement `candidates`. Run. Expected: 5 passed.
- [ ] **Step 3:** For the 15 largest candidates, fetch generation for the years since `p_year + 1`. **Drop any farm that was not a monthly reporter in every one of those years** (`reported_monthly` False in any month): its monthly figures would be estimates. Then drop any farm where reported capacity factor in any full year is below 20% or above 60%, or where turbine count × rating differs from the plant's reported nameplate by more than 5% (the nameplate is in the same EIA file family; confirm the column in Step 1 of Task 1).
- [ ] **Step 4:** Check that the turbine model of each survivor has a published power curve you can cite. Good open sources: the manufacturer's own brochure; the Open Energy Platform turbine library. Drop farms without one.
- [ ] **Step 5:** Write `docs/farm-selection.md`: the criteria, a table of the top five survivors (name, state, turbines, model, capacity, years of data, **confirmed monthly reporter in every year**, capacity factor range, power-curve source), the number of candidates dropped for annual reporting, and a recommendation with one paragraph of reasoning.
- [ ] **Step 6:** Commit, open a pull request, and **stop. Dylan picks the farm.** Record his choice at the top of the memo.

### Task 3: One turbine

**Files:** Create `energy/turbine.py`, `energy/tests/test_turbine.py`, `data/turbines/<model>.csv`

**Interfaces:**
- Produces:

```python
@dataclass(frozen=True)
class Turbine:
    model: str; rated_kw: float; hub_height_m: float; rotor_diameter_m: float
    curve_v: np.ndarray; curve_kw: np.ndarray        # ascending speeds, m/s and kW
    cut_in: float; cut_out: float
    curve_ct: np.ndarray | None = None

def load_turbine(csv_path: Path, hub_height_m: float, rotor_diameter_m: float) -> Turbine
def hub_speed(v_100, hub_height_m: float, alpha: float = 0.14)
def air_density(pressure_pa, temp_k)
def equivalent_speed(v, rho)
def power_kw(t: Turbine, v)                           # scalar or array in, same shape out
def ct_from_cp(cp: float) -> float
def thrust_coefficient(t: Turbine, v)                 # scalar or array
```

The curve CSV has columns `v_ms,power_kw` and optionally `ct`, with `#` comment lines at the top giving the source, the page and the date retrieved.

- [ ] **Step 1: Write the failing tests.** Use a test turbine: rated 2000 kW, hub 80 m, rotor 80 m, curve points (3, 0), (8, 800), (12, 2000), (25, 2000), cut-in 3, cut-out 25.

```python
def test_shear():            assert hub_speed(8.0, 80.0) == pytest.approx(7.753943, abs=1e-6)
def test_shear_at_100m_is_unchanged():  assert hub_speed(8.0, 100.0) == pytest.approx(8.0)
def test_standard_density(): assert air_density(101325.0, 288.15) == pytest.approx(1.225012, abs=1e-6)
def test_density_correction(): assert equivalent_speed(8.0, 1.10) == pytest.approx(7.718072, abs=1e-6)
def test_power_interpolates(): assert power_kw(T, 10.0) == pytest.approx(1400.0)
def test_power_is_zero_below_cut_in():  assert power_kw(T, 2.99) == 0.0
def test_power_is_zero_at_cut_out():    assert power_kw(T, 25.0) == 0.0 and power_kw(T, 40.0) == 0.0
def test_power_never_negative_or_above_rated():   # array of 0..40 m/s: min >= 0, max <= 2000
def test_power_accepts_arrays():        # shape in == shape out
def test_ct_from_cp_known_point():      assert ct_from_cp(0.512) == pytest.approx(0.64, abs=1e-6)
def test_ct_from_cp_at_betz_limit():    assert ct_from_cp(16/27) == pytest.approx(0.888889, abs=1e-5)
def test_ct_from_cp_above_betz_is_capped():  assert ct_from_cp(0.7) == pytest.approx(0.888889, abs=1e-5)
def test_thrust_is_zero_when_not_running():  assert thrust_coefficient(T, 2.0) == 0.0 and thrust_coefficient(T, 26.0) == 0.0
def test_load_turbine_reads_the_csv_and_skips_comments(tmp_path): ...
def test_load_turbine_rejects_unsorted_speeds(tmp_path): ...   # ValueError
```

- [ ] **Step 2:** Run `uv run pytest energy/tests/test_turbine.py -v`. Expected: failures.
- [ ] **Step 3:** Implement `turbine.py` from "The model, exactly". Cut-in is the last speed with zero power before the curve rises; cut-out is the last speed in the file.
- [ ] **Step 4:** Run. Expected: 15 passed.
- [ ] **Step 5:** Transcribe the chosen turbine's published curve into `data/turbines/<model>.csv` with its source in the header. Plot it once and compare with the source by eye.
- [ ] **Step 6:** Commit (`feat(energy): single-turbine model`).

### Task 4: Geometry and the wake

**Files:** Create `energy/geometry.py`, `energy/wake.py`, tests for both

**Interfaces:**
- Produces:

```python
# geometry.py
def to_local_m(lon, lat, lon0: float, lat0: float) -> tuple[np.ndarray, np.ndarray]     # x east, y north
def along_across(x, y, wind_from_deg: float) -> tuple[np.ndarray, np.ndarray]
    # along[i, j]: how far turbine i is downwind of turbine j; across[i, j]: crosswind distance, >= 0

# wake.py
K_DEFAULT = 0.075
def deficit(ct: float, along_m: float, r0: float, k: float = K_DEFAULT) -> float
def overlap_fraction(r0: float, rw: float, across_m: float) -> float
def combine(effects) -> float
```

- [ ] **Step 1: Write the failing tests.**

```python
# test_geometry.py
def test_one_degree_of_latitude():     # (0, 1) from (0, 0) -> y == 111195.08, x == 0
def test_longitude_shrinks_with_latitude():   # 1 degree of lon at lat0 = 40 -> x == 85180.373 (abs=0.01)
def test_wind_from_west_puts_east_turbine_downwind():
    # turbines at (0,0) and (500,0), wind_from 270 -> along[1,0] == 500, along[0,1] == -500, across == 0
def test_wind_from_north_puts_south_turbine_downwind():
    # turbines at (0,0) and (0,-500), wind_from 0 -> along[1,0] == 500
def test_direction_wraps():            # along_across at 359.9 and at -0.1 are equal; 360 equals 0

# test_wake.py
def test_deficit_known_value():        assert deficit(0.8, 400.0, 40.0) == pytest.approx(0.180502, abs=1e-6)
def test_no_deficit_upwind():          assert deficit(0.8, -10.0, 40.0) == 0.0 and deficit(0.8, 0.0, 40.0) == 0.0
def test_deficit_falls_with_distance():   # 200 m > 400 m > 800 m
def test_overlap_full_when_centred():  assert overlap_fraction(40, 70, 0) == 1.0
def test_overlap_none_when_clear():    assert overlap_fraction(40, 70, 110) == 0.0 and overlap_fraction(40, 70, 200) == 0.0
def test_overlap_full_when_rotor_inside_wake():  assert overlap_fraction(40, 70, 30) == 1.0
def test_overlap_equal_circles():      assert overlap_fraction(40, 40, 40) == pytest.approx(0.391002, abs=1e-6)
def test_overlap_partial():            assert overlap_fraction(40, 70, 60) == pytest.approx(0.595167, abs=1e-6)
def test_combine_is_root_sum_square(): assert combine([0.18, 0.10]) == pytest.approx(0.205913, abs=1e-6)
def test_combine_of_nothing_is_zero(): assert combine([]) == 0.0
```

- [ ] **Step 2:** Run. Expected: failures.
- [ ] **Step 3:** Implement both modules. `overlap_fraction` is the standard two-circle lens area divided by `pi × r0²`.
- [ ] **Step 4:** Run. Expected: 15 passed.
- [ ] **Step 5:** Commit (`feat(energy): geometry and Jensen wake`).

### Task 5: The farm

**Files:** Create `energy/farm.py`, `energy/tests/test_farm.py`

**Interfaces:**
- Consumes: `Turbine`, `power_kw`, `thrust_coefficient`, `along_across`, `deficit`, `overlap_fraction`, `combine`.
- Produces:

```python
DIR_STEP = 5.0                                   # 72 bins centred on 0, 5, ..., 355
SPEEDS = np.arange(0.0, 30.5, 0.5)               # 61 speeds

def turbine_speeds(t: Turbine, x, y, wind_from_deg: float, v: float, k: float = 0.075) -> np.ndarray
def farm_power_kw(t: Turbine, x, y, wind_from_deg: float, v: float, k: float = 0.075) -> float
def power_table(t: Turbine, x, y, k: float = 0.075) -> np.ndarray          # shape (72, 61), kW
def gross_table(t: Turbine, n_turbines: int) -> np.ndarray                 # shape (61,), kW
def hourly_power_kw(table: np.ndarray, wind_from_deg, v_eq) -> np.ndarray  # nearest direction bin, linear in speed
def monthly_mwh(hourly_kw: pd.Series) -> pd.Series                         # NaN hours are skipped, not zero
def coverage(hourly_kw: pd.Series) -> pd.Series                            # share of non-missing hours per month
```

- [ ] **Step 1: Write the failing tests.** `T` is the test turbine from Task 3.

```python
def test_single_turbine_has_no_wake():        # farm_power_kw == power_kw at every direction
def test_two_aligned_turbines():
    # at (0,0) and (400,0), wind from 270, v = 10: front turbine sees 10.0;
    # back sees 10 × (1 − deficit(thrust_coefficient(T,10), 400, 40)); power is the sum
def test_two_turbines_crosswind_have_no_wake():   # same layout, wind from 0 or 180: 2 × single
def test_reversing_the_wind_swaps_the_roles():    # wind from 90: total equals the wind-from-270 total
def test_three_in_a_row_uses_each_ones_own_ct():  # third turbine's speed < second's < first's
def test_far_apart_turbines_lose_almost_nothing():  # 20 km spacing: total > 0.995 × gross
def test_farm_never_exceeds_gross():             # random 12-turbine layout, all 72 dirs × all speeds
def test_power_table_shape_and_zero_rows():      # (72, 61); column for v = 0 and v >= 25 is all zero
def test_direction_bin_wrap():                   # hourly lookup at 359.9 and 0.1 both use bin 0; 357.4 uses bin 355; 357.6 uses bin 0
def test_hourly_lookup_interpolates_speed():     # v = 9.75 is halfway between the 9.5 and 10.0 entries
def test_monthly_mwh_skips_missing_hours():      # a NaN hour adds nothing and lowers coverage, it is not counted as zero
def test_monthly_mwh_units():                    # 1000 kW for 744 hours -> 744.0 MWh
```

- [ ] **Step 2:** Run. Expected: failures.
- [ ] **Step 3:** Implement `farm.py`. In `turbine_speeds`, sort turbines by position along the wind and walk downwind.
- [ ] **Step 4:** Run. Expected: 12 passed. Building the real farm's table must take under 60 seconds; if not, vectorise the inner loop before going on.
- [ ] **Step 5:** Commit (`feat(energy): farm power table and hourly energy`). Pull request for Tasks 3 to 5.

### Task 6: Calibrate, then test on a year the model has not seen

**Files:** Create `energy/validate.py`, `energy/tests/test_validate.py`

**Interfaces:**
- Produces:

```python
@dataclass(frozen=True)
class Validation:
    calibration_factor: float; calibration_years: list[int]; holdout_year: int
    blind_error_pct: float; blind_months: int; assumed_losses: float
    annual_error_pct: float; monthly_mape_pct: float; r2: float
    excluded_months: list[dict]            # {"month": "2021-02", "reason": "..."}
    table: pd.DataFrame                    # month, modelled_mwh, reported_mwh, used_for ("calibration" | "holdout" | "excluded")

def usable_months(modelled: pd.Series, reported: pd.Series, coverage: pd.Series) -> tuple[pd.Index, list[dict]]
def validate(modelled: pd.Series, reported: pd.Series, coverage: pd.Series, holdout_year: int, reported_monthly: pd.Series) -> Validation
```

`validate` first checks the `reported_monthly` flag and raises `ValueError` if any month in the study years is from an annual filing; such a farm should never have reached this step.

Exclusion rules, in this order, each with its reason text: wind coverage below 0.98 ("wind data missing"); reported generation ≤ 0 ("reported zero or negative"); reported generation above nameplate × hours ("reported above nameplate"). Nothing else is ever excluded.

- [ ] **Step 1: Write the failing tests** on synthetic series:

```python
def test_calibration_factor_is_recovered(): # reported = 0.85 × modelled exactly -> calibration_factor == 0.85, holdout error == 0
def test_holdout_is_not_used_for_calibration():
    # holdout year reported = 0.70 × modelled, others 0.85 -> calibration_factor stays 0.85, annual_error_pct == pytest.approx(21.43, abs=0.01)
def test_error_sign():                      # model above reported gives a positive error
def test_assumed_losses_value():            assert ASSUMED_LOSSES == pytest.approx(0.087044, abs=1e-6)
def test_blind_error_uses_no_farm_output_for_tuning():
    # reported = 0.85 × modelled in every month -> blind_error_pct == pytest.approx(7.407, abs=0.01)   ((1−0.087044)/0.85 − 1)
    # and it is the same whichever year is held out
def test_blind_error_covers_all_usable_months():   # blind_months == calibration months + holdout months
def test_calibration_factor_may_exceed_one(): # reported = 1.10 × modelled -> factor == 1.10, no error raised
def test_zero_month_is_excluded_with_reason():
def test_low_coverage_month_is_excluded_with_reason():
def test_above_nameplate_month_is_excluded_with_reason():   # needs nameplate_mw argument; add it to both functions
def test_excluded_months_are_in_the_table_and_marked():
def test_annual_reporter_is_refused():                      # any reported_monthly False -> ValueError naming the first such month
def test_holdout_needs_at_least_ten_usable_months():        # otherwise ValueError
def test_calibration_needs_at_least_two_years():            # otherwise ValueError
```

Add `nameplate_mw: float` to `usable_months` and `validate` as the test requires.

- [ ] **Step 2:** Run. Expected: failures. Implement, with `ASSUMED_LOSSES` as a module constant built from the four named parts. Run. Expected: 14 passed.
- [ ] **Step 3:** Before running the real farm, find a citable source for typical wind-farm loss percentages, adjust the four parts of `ASSUMED_LOSSES` to it if needed (update the test value to match), and commit that **first, in its own commit**, so the history shows the assumption was fixed before the farm's output was seen.
- [ ] **Step 3b:** Run the real farm: download wind and generation, build the table, validate. Write the blind error, the calibration factor, the three held-out numbers and the excluded months into the pull request description **exactly as they come out**.
- [ ] **Step 4:** If the blind error is above 25% or the held-out annual error is above 15%, do not adjust anything yet. Check, in order: the farm's coordinates and turbine count; the direction convention (a model that is right in total but wrong by season often has it reversed); units; the power curve transcription. Fix what is actually wrong, re-run, and record what was found. If nothing is wrong, the error stands and gets published.
- [ ] **Step 5:** Commit (`feat(energy): calibration and held-out validation`). Pull request.

### Task 7: Uncertainty and the result files

**Files:** Create `energy/uncertainty.py`, `energy/export.py`, `energy/run.py`, tests for the first two

**Interfaces:**
- Produces:

```python
# uncertainty.py
SEED = 20261114; DRAWS = 20_000
@dataclass(frozen=True)
class PValues: p50: float; p75: float; p90: float; p99: float
def sigmas(yearly_mwh: pd.Series, holdout_error_pct: float) -> tuple[float, float]      # (sigma_iav, sigma_model)
def p_values(p50: float, sigma_iav: float, sigma_model: float, years: int = 1) -> PValues

# export.py
def contract(...) -> dict                       # the shape in "Contract 1"
def wind_rose(wind: pd.DataFrame) -> dict       # {"dir_step": 5, "speed_step": 1, "freq": 72 × 31 shares summing to 1}
def energy_cases(t: Turbine, x, y) -> dict      # fixtures for the TypeScript port
def write_all(out_dir: Path = Path("data/results")) -> None
```

- [ ] **Step 1: Write the failing tests.**

```python
def test_sigma_model_has_a_floor():        # holdout error 1.0% -> sigma_model == 0.03; 8.0% -> 0.08
def test_sigma_iav_is_relative():          # yearly totals with mean 100 and std 6 -> 0.06
def test_p_values_are_ordered():           # p50 > p75 > p90 > p99
def test_p_values_match_the_normal_case():
    # p50 100000, sigma_iav 0.06, sigma_model 0.05 -> p90 within 1% of 100000 × (1 − 1.281552 × 0.078102)
def test_ten_year_is_tighter():            # 10-year p99 > 1-year p99; p50 unchanged within 0.5%
def test_seed_makes_it_repeatable():       # two calls give identical results
def test_contract_has_every_key():         # exactly the keys in "Contract 1", nested ones included
def test_monthly_shape_sums_to_one():
def test_wind_rose_sums_to_one_and_skips_missing_hours():
def test_result_files_are_small(tmp_path): # every file write_all produces is under 200_000 bytes
```

- [ ] **Step 2:** Run. Expected: failures. Implement. Run. Expected: 10 passed.
- [ ] **Step 3:** `energy_cases` writes `data/fixtures/energy-cases.json`: the turbine curve, the real layout in local metres, and 40 cases — 20 of `{v, power_kw, ct}` for one turbine across 0 to 30 m/s, and 20 of `{wind_from_deg, v, farm_power_kw, turbine_speeds}` across directions and speeds, including directions 0, 359.9 and one aligned with a turbine row.
- [ ] **Step 4:** Implement `run.py` so that `uv run python -m energy.run` goes from downloads to every result file and prints the validation summary and the P-values.
- [ ] **Step 5:** Run it. Check `data/results/energy-contract.json` by eye against the validation numbers from Task 6. Tell the finance partner the contract is ready (finance plan, Task 9 Step 4).
- [ ] **Step 6:** Commit code, results and fixtures (`feat(energy): uncertainty, P-values and result files`). Pull request.

### Task 8: The live version in TypeScript

**Files:** Create `core/src/energy/types.ts`, `turbine.ts`, `wake.ts`, `farm.ts`, `index.ts`, and `turbine.test.ts`, `wake.test.ts`, `farm.test.ts`, `cases.test.ts`

**Interfaces:**
- Produces:

```ts
export interface TurbineSpec { model: string; rated_kw: number; hub_height_m: number; rotor_diameter_m: number;
  curve_v: number[]; curve_kw: number[]; curve_ct: number[] | null; cut_in: number; cut_out: number }
export interface Point { x: number; y: number }                       // local metres, x east, y north
export function powerKw(t: TurbineSpec, v: number): number;
export function ctFromCp(cp: number): number;
export function thrustCoefficient(t: TurbineSpec, v: number): number;
export function deficit(ct: number, alongM: number, r0: number, k?: number): number;
export function overlapFraction(r0: number, rw: number, acrossM: number): number;
export function combine(effects: number[]): number;
export function turbineSpeeds(t: TurbineSpec, layout: Point[], windFromDeg: number, v: number, k?: number): number[];
export function farmPowerKw(t: TurbineSpec, layout: Point[], windFromDeg: number, v: number, k?: number): number;
export function annualEnergyMwh(t: TurbineSpec, layout: Point[], rose: { dir_step: number; speed_step: number; freq: number[][] }, calibrationFactor: number): number;
```

- [ ] **Step 1: Write the failing tests.** Repeat the known-value tests from Tasks 3 and 4 in TypeScript with the same numbers (`powerKw` at 10 m/s is 1400; `ctFromCp(0.512)` is 0.64; `deficit(0.8, 400, 40)` is 0.180502; `overlapFraction(40, 40, 40)` is 0.391002; `overlapFraction(40, 70, 60)` is 0.595167; `combine([0.18, 0.10])` is 0.205913), then the match test:

```ts
// cases.test.ts
import cases from '../../../data/fixtures/energy-cases.json';
test.each(cases.turbine)('one turbine at $v m/s', c => {
  expect(powerKw(cases.spec, c.v)).toBeCloseTo(c.power_kw, 6);
});
test.each(cases.farm)('farm at $wind_from_deg° and $v m/s', c => {
  const got = farmPowerKw(cases.spec, cases.layout, c.wind_from_deg, c.v);
  expect(Math.abs(got - c.farm_power_kw)).toBeLessThanOrEqual(0.005 * Math.max(1, c.farm_power_kw));
});
test('annual energy from the wind rose is within 2% of the hourly model', () => {
  // rose from data/results/wind-rose.json, calibration factor and p50 from energy-contract.json
});
test('dragging a turbine far away removes its wake loss', () => {
  // move one turbine 50 km crosswind: farm power rises or stays equal at every case direction
});
```

- [ ] **Step 2:** Run `npm test` in `core/`. Expected: failures.
- [ ] **Step 3:** Implement the four files as direct ports of the Python. No DOM code. Export from `core/src/energy/index.ts`.
- [ ] **Step 4:** Run `npm test` and `npm run check`. Expected: all pass, 0 type errors. `farmPowerKw` on the real layout must run in under 2 ms so dragging stays smooth; measure it in a test with `performance.now()` over 200 calls.
- [ ] **Step 5:** Commit (`feat(energy): live turbine and wake model in core`). Pull request.

### Task 9: Explain it

**Files:** Create `docs/notes/energy.md`; add an "Energy" section to `README.md`

- [ ] **Step 1:** In your own words, one short section each: why wind is scaled to hub height and what the exponent means; why air density changes output; what a power curve is and where this one came from; how the Jensen wake works and what `k` controls; how thrust was obtained; the difference between the blind prediction and the calibrated result, what the calibration factor absorbs, and why it was set on some years and tested on another; what P50, P90 and P99 mean and what the two uncertainty terms are; every simplification and how a professional energy assessment differs.
- [ ] **Step 2:** Have the finance partner ask five questions with the notes closed. Anything you cannot answer goes back into the notes or comes out of the site.
- [ ] **Step 3:** README section: the data sources with attribution (including "Weather data by Open-Meteo.com", CC BY 4.0), the one command to run, how to run the tests.
- [ ] **Step 4:** Commit (`docs(energy): study notes and README section`). Pull request.

## Commands

```bash
uv run pytest energy -v                  # all energy tests, no network
uv run python -m energy.run              # downloads (cached) -> validation -> results
cd core && npm test && npm run check     # live version matches the Python
```
