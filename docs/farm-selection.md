# Choosing the farm

Energy plan, Task 2. Run on 2026-11-14 from the live data. **Dylan picks; his choice goes at the top
of this file.**

> **Choice:** _not made yet._

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

**Not yet done:** neither library's licence terms have been read, and no curve has been compared
with the manufacturer's own published figures. Both are to do before a curve is committed to the repo.

## To reproduce

`uv run pytest energy` covers the rules (`energy/select_farm.py`). The numbers above came from
running those rules on `download.turbines()` and `download.wind_plants(year)` for 2018 to 2025.
