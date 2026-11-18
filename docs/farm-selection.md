# Choosing the farm

Energy plan, Task 2. Run on 2026-11-14 from the live data. **Dylan picks; his choice goes at the top
of this file.**

> **Choice: Black Oak Getty, MN (EIA 58692).** Picked by Dylan on 2026-11-15.

## How the list was cut down

| Step | Farms left | Rule |
|---|---|---|
| Turbine database, grouped by EIA plant | 1,348 | every plant with an EIA id |
| Suits a clean model | 234 | 20 to 150 turbines; one model, one rating, one hub height; all built in one year, 2019 or earlier; never repowered; onshore; in IA, KS, NE, OK, TX, ND, SD, MN, IL or IN; one named project per plant |
| Reported record usable, 2018 to 2025 | 81 | dropped: **132 annual reporters** (their monthly figures would be estimates), 11 with a year's capacity factor outside 20 to 60%, 4 with missing months, 6 not in EIA's wind rows every year |
| Turbine has a power curve that can be cited | 33 | see "Power curves" below |
| No other farm's turbines within 10 km | 6 | neighbours' wakes are not in the model |

"Annual reporter" means EIA's `Respondent Frequency` was anything other than `M` in any year. EIA
does not define the codes in the file, so `AM` is treated as not measured monthly. That one rule
removed more farms than every other rule together.

"Flat" is judged by state only. Nobody has looked at the terrain of the farms below.

## The five

All five: one turbine model, built once, monthly reporter every year, no neighbour within 10 km,
turbine count × rating equal to the database's project capacity.

| | Farm | State | Built | Turbines | Model | MW | Hub | Full years | Capacity factor by year | Power curve |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Black Oak Getty** (EIA 58692) | MN | 2016 | 39 | Vestas V110-2.0 | 78.0 | 80 m | 8 (2018–2025) | 41, 42, 44, 42, 49, 40, 44, 45% | SAM library; thrust derived |
| 2 | Sunflower (EIA 60088) | ND | 2016 | 52 | Vestas V100-2.0 | 104.0 | 80 m | 8 | 47, 48, 51, 44, 50, 44, 47, 47% | SAM library; thrust derived |
| 3 | Blue Cloud I (EIA 60270) | TX | 2018 | 43 | Vestas V126-3.45 | 148.35 | 87 m | 7 (2019–2025) | 46, 47, 43, 43, 41, 46, 43% | OEP library, with thrust |
| 4 | New Frontier (EIA 59903) | ND | 2018 | 29 | Vestas V126-3.45 | 100.05 | 87 m | 7 | 44, 49, 47, 50, 43, 43, 44% | OEP library, with thrust |
| 5 | Courtenay (EIA 58658) | ND | 2016 | 100 | Vestas V100-2.0 | 200.0 | 80 m | 8 | 41, 41, 40, 43, 47, 40, 42, **24%** | SAM library; thrust derived |

Neighbours within 20 km: none for Black Oak Getty, Blue Cloud I and Courtenay; 16 turbines for
Sunflower; 8 for New Frontier. The sixth isolated farm, Cactus Flats (TX, 43 × V126-3.45), is left
out for a lower and more variable record (33 to 40%).

## Recommendation: Black Oak Getty

- **Eight full years**, the most available, which gives seven to calibrate on and one to test on.
- **The steadiest record of the five**, 40 to 49% with no odd year. The held-out year is the newest
  one, 2025, and here it is ordinary (45%).
- **Nothing else within 20 km**, so no outside wakes.
- **39 turbines**: enough for wakes to matter, few enough that the site's drag-the-turbines tool
  stays fast and readable on a phone.
- **80 m hub height**, close to the 100 m the wind data is given at, so the height correction is small.
- **Minnesota** has had less forced curtailment than West Texas, which matters because curtailment
  looks exactly like the model over-predicting.
- **Thrust has to be derived** from the power curve by momentum theory, because the SAM library
  gives power only. That is extra work, and it is mechanical engineering worth showing.

Why not the others:
- **Courtenay:** 2025 came in at 24% against 40 to 47% in every other year. Something happened
  (an outage or curtailment), and 2025 is the year the model would be tested on.
- **Blue Cloud I:** the cleanest turbine data (published thrust curve), but seven years not eight,
  and West Texas curtailment is a known risk to the comparison. A good second choice.
- **Sunflower, New Frontier:** fine records, but each has another farm between 10 and 20 km away.

## Power curves

Two public sources, both checked for these models on 2026-11-14:

- **SAM wind turbine library** (System Advisor Model, from the lab formerly called NREL):
  `Vestas V110-2.0`, `Vestas V100-2.0`, `Siemens SWT-2.3MW-108m`, `Gamesa G87 2.0 MW`, `GE 1.5sle`
  and others. Power only, no thrust.
- **Open Energy Platform turbine library:** `Vestas V126/3450`, `V117/3300` and others, with thrust.
  Each row names its own source.

The Open Energy Platform library is under the Open Database License 1.0 (read from its own
metadata on 2026-11-15). None of its rows are in this repo; it is used only to check the thrust
method, and is credited in `docs/data-sources.md`.

## The chosen turbine's curve, checked on 2026-11-15

`data/turbines/vestas-v110-2.0.csv` is the SAM library's row "Vestas V110-2.0", numbers unchanged
(19 points, 2 to 19.98 m/s), taken from `deploy/libraries/Wind Turbines.csv` at commit `784177b` of
`github.com/NREL/SAM`.

- **Licence:** the SAM repository is BSD 3-Clause, which allows copying with the copyright notice
  kept. The notice and full licence text are in `data/turbines/NOTICE.md`.
- **Where the library got the curve is not stated.** The speeds are not round numbers (2.9999,
  3.9946, 5.0039 …), which is what a curve traced from a printed graph looks like. Treat it as a
  traced curve, not the maker's own table.
- **Against the maker's brochure** (Vestas 2 MW platform brochure, 03/2024, read from vestas.com;
  not copied into this repo). The brochure has no power-curve table. What it does give:

  | | Brochure | Library curve |
  |---|---|---|
  | Rated power | 2,000 kW | 2,000 kW |
  | Rotor diameter | 110 m | 110 m |
  | Cut-in | 3 m/s | first power at 3.0 m/s (27.7 kW); zero at 2 m/s |
  | Cut-out | **21 m/s** | **last point 19.98 m/s** |
  | Yearly energy at 6.0 m/s average | about 6.6 GWh | 6.43 GWh |
  | Yearly energy at 7.5 m/s average | about 9.1 GWh | 8.89 GWh |

  The yearly-energy figures use the brochure's own conditions (one turbine, no losses, Rayleigh
  wind, 1.225 kg/m3). The brochure's values were **read off a printed chart by eye**, good to
  roughly ±0.15 GWh, so this shows the library curve is about 2 to 3% under the brochure and no
  more precisely than that.
- **Cut-out differs by 1 m/s.** The model stops the turbine at 19.98 m/s, the library's last point;
  today's brochure says 21. The farm was built in 2016 and the turbine's setting then is not known.
  Hours that windy are rare, and how many there are at this farm is not yet measured.
- **Peak efficiency** of the curve is 0.455 near 7.5 m/s, under the 0.593 physical limit. A test
  holds that.
- **Thrust is derived**, not published. Plain momentum theory gave 0.54 at 8 m/s, which is too
  low: on 36 turbines that publish both curves it averages 0.53 between 5 and 9 m/s where the
  published figure is 0.79. The model now divides by a rotor-to-grid efficiency of 0.78, fitted on
  24 turbines from other makers and tested on 12 Vestas turbines (mean absolute error 0.056,
  against 0.185 uncorrected). The chosen turbine's thrust at 8 m/s is now 0.81. It is still too
  low in light wind (about 0.3 low at 4 m/s). Details in the energy plan under "Thrust";
  `uv run python -m energy.thrust_check` repeats the measurement.

## To reproduce

`uv run pytest energy` covers the rules (`energy/select_farm.py`). The numbers above came from
running those rules on `download.turbines()` and `download.wind_plants(year)` for 2018 to 2025.
