# How the energy model works

> **Status: draft.** Written by Claude at Dylan's request on 2026-11-16, from the code, the energy
> plan and the run of that date. Dylan has not yet checked it the way the plan asks (Task 9 Step 2:
> the finance partner asks five questions with these notes closed). Anything Dylan cannot answer
> goes back into these notes or comes out of the site. Numbers are from
> `uv run python -m energy.run` on 2026-11-16 and are in `data/results/`.

This is an educational model. It is not investment, tax or engineering advice.

Sources are numbered in square brackets and listed at the end, with a note on how each was checked.

## In one paragraph

The model takes 26 years of hourly wind at one point near Black Oak Getty, a 39-turbine, 78 MW
wind farm in Minnesota, and works out what the farm should have produced each hour: wind at hub
height, corrected for air density, through the turbine's power curve, less the wind each turbine
loses to the ones upwind of it. Summed by month, that is compared with what the farm reported to
the US government. Unscaled, and with a standard set of losses taken off, the model came out
**24.92% below** the farm's real output. Scaled by one factor fitted on 2018 to 2024, it came
within **1.46%** of the held-out year 2025. Both results are published. Only the first is a
prediction.

## 1. Wind at hub height

The wind data gives the speed 100 m above the ground. The turbines' hubs are at 80 m. Wind is
slower near the ground because the ground drags on it, so the 100 m speed is scaled down:

```
v_hub = v_100 × (hub_height / 100)^alpha        alpha = 0.14
```

`alpha` is the shear exponent: how quickly the wind picks up with height. 0 would mean the same
speed at every height; a bigger number means a bigger difference between low and high. 0.14 (about
one seventh) is the usual textbook value for open, flat land in neutral conditions [1]. It is a
general figure, not one measured at this site. In reality it changes with the time of day, the
season and the ground: it is larger on calm nights and smaller on sunny afternoons.

Here the step is small: 80 m is close to 100 m, so the speed drops by 3.1% (a factor of 0.969).
That is one reason this farm was chosen. Removing the correction altogether would raise the
modelled energy by about 6%.

## 2. Air density

A turbine turns the moving air's energy into electricity, and the energy in moving air depends on
how much air there is: cold, dense air pushes harder than warm, thin air at the same speed. Power
in the wind is proportional to density × speed³.

Power curves are published for one standard density, 1.225 kg/m³. To use the curve on a day with a
different density, the model finds the speed that would carry the same power at standard density:

```
rho  = surface_pressure / (287.05 × temperature)        pressure in Pa, temperature in K
v_eq = v_hub × (rho / 1.225)^(1/3)
```

The cube root is there because power goes with the cube of speed. This is the standard way to
adjust for density when working with power curves [2]. The farm's average density over 2018 to 2025
is 1.207 kg/m³, a little under standard, with denser air in winter.

**Simplification:** the temperature is the one 2 m above the ground and the pressure is at the
surface, not at hub height. Air 80 m up is very slightly thinner. The effect is under 1%.

## 3. The power curve

A power curve is a table: for each wind speed, how much electricity the turbine makes. It has four
parts. Below the **cut-in** speed (3 m/s here) the turbine makes nothing. Above it, output climbs
steeply, roughly with the cube of the speed. At about 11 m/s it reaches its **rating**, 2,000 kW,
and holds there. At the **cut-out** speed it shuts down to protect itself.

The farm's turbine is the Vestas V110-2.0: a 110 m rotor on a 2 MW generator, a large rotor for
its rating, which is why it does well in moderate wind. The curve in
`data/turbines/vestas-v110-2.0.csv` is one row of the turbine library that ships with the System
Advisor Model (SAM) [3], copied unchanged with its licence notice. The model reads between the
table's points in straight lines, gives 0 below cut-in and at or above cut-out, and never gives
more than the rating.

What is known and not known about this curve (details in `docs/farm-selection.md`):

- The library does not say where its curve came from. Its speeds are not round numbers, which is
  what a curve traced from a printed graph looks like.
- Against the maker's brochure, the curve gives about 2 to 3% less yearly energy. The brochure's
  figures were read off a chart by eye, so that comparison is rough.
- The library's curve ends at 19.98 m/s and the model stops the turbine there. Today's brochure
  says 21 m/s. Hours that windy are rare.

## 4. Wakes: the Jensen model

A turbine takes energy out of the wind, so the air behind it is slower. A turbine standing in that
slower air, the **wake**, makes less. The model uses the Jensen wake model, also called the Park
model [4][5], which is the simplest one in common use.

Picture the wake as a cone behind the rotor. It starts the size of the rotor and widens in a
straight line as it goes downwind. As it widens it mixes with the faster air around it, so the
slowdown fades. For a turbine a distance `x` downwind, with rotor radius `r0`:

```
wake radius    Rw = r0 + k × x                              k = 0.075
slowdown       d  = (1 − sqrt(1 − Ct)) / (1 + k × x / r0)²
```

`Ct` is the upwind turbine's thrust coefficient: how hard it is pushing back on the wind (next
section). **`k` controls how fast the wake widens.** A bigger `k` means the wake spreads and fades
sooner, so turbines behind lose less. 0.075 is the standard value for farms on land [6]; offshore,
where the air is smoother and wakes last longer, a smaller value is used.

Three more rules finish the model:

- **Partial cover.** If the wake only covers part of the downwind rotor, the slowdown is multiplied
  by the share of the rotor's disc that lies inside the wake's circle.
- **Several wakes.** A turbine behind several others gets the square root of the sum of the
  squared slowdowns, not their plain sum [5].
- **Order.** Turbines are worked through from the most upwind to the most downwind, and each one's
  thrust is taken at the speed it actually sees.

Running this for every hour would be slow, so the model builds a table once: farm power for each
of 72 wind directions (every 5°) and 61 wind speeds (every 0.5 m/s). Each hour is then looked up in
the table.

At this farm the wake loss is **5.59%** of energy over 2000 to 2025. The turbines are well spread:
39 of them over about 8 km by 7 km.

**Simplifications:** the wake has a flat profile (the same slowdown everywhere inside the cone)
when a real one is deepest in the middle; the wake does not bend or wander; the air's own
turbulence, which changes how fast a wake fades by time of day, is not used; and every turbine is
given the same free wind, from one data point.

## 5. Thrust

The wake model needs each turbine's thrust coefficient at each wind speed. Some makers publish a
thrust curve. This turbine's is not in the library, so it is worked out from the power curve.

The starting point is momentum theory [7]: an ideal rotor that slows the wind by a fraction `a`
takes out a share `Cp = 4a(1−a)²` of the wind's power and pushes back with `Ct = 4a(1−a)`. So
from the power, one can solve for `a` and get the thrust. No rotor can take more than 16/27 of the
wind's power (the Betz limit).

Used directly on the electrical power curve, this gives too little thrust, because it treats the
electricity as all the energy the rotor took from the wind. Real rotors lose some to blade drag,
tip losses and the spin they put into the wake, and more in the gearbox and generator. The model
therefore divides the electrical power by 0.78 before applying the theory:

```
Cp_grid  = P / (0.5 × 1.225 × pi × r0² × v³)
Cp_rotor = Cp_grid / 0.78                       capped at 16/27
solve Cp_rotor = 4a(1−a)² for a
Ct = 4a(1−a)                                    capped at 0.9
```

The 0.78 was measured, not assumed. On 36 turbines that publish both a power and a thrust curve
[8], the uncorrected method averaged a thrust coefficient of 0.53 between 5 and 9 m/s where the
published one was 0.79. The 0.78 was fitted on the 24 turbines from other makers and tested on the
12 Vestas ones: the average error in `Ct` fell from 0.185 to 0.056. `uv run python -m
energy.thrust_check` repeats this.

Two things to be clear about. 0.78 is **not** a drivetrain efficiency; it stands for everything
between an ideal rotor and the grid. And the method is still too low in light wind (about 0.3 low
at 4 m/s), where little energy is made.

Contains information from the Open Energy Platform wind turbine library, © Reiner Lemoine
Institut, made available under the Open Database License (ODbL) 1.0 [8]. Only the fitted number is
taken from it; none of its rows are in this repository.

## 6. Two results: blind and calibrated

The farm reports its net generation every month on EIA Form 923 [9]. The model's monthly totals
are compared with those reports for 2018 to 2025: 96 months, none excluded.

### A. The blind prediction

This uses no number from the farm's own output. The modelled energy has a fixed set of losses
taken off, chosen **before** the farm's output was looked at (the commit history shows the order):

| Loss | Share | What it covers |
|---|---|---|
| Availability | 5.50% | turbines, the rest of the plant and the grid being out of service |
| Electrical | 2.01% | cables and transformers, and the farm's own use |
| Turbine performance | 3.95% | turbines running below their published curve |
| Environmental | 2.40% | icing, blade wear, weather shutdowns |
| **Together** | **13.19%** | applied one after another, not added |

These are the default loss values in SAM's wind inputs [10]. They are a tool's general defaults,
not figures for this farm. SAM's fifth group, curtailment (2.80%), is left out. For scale, a review
of published studies found predicted total losses, wakes included, between 9.5% and 22.5% [11];
this model's 13.19% with its 5.59% wake loss comes to about 18%.

**Result: −24.92%.** Over the 96 months the blind model is a quarter below what the farm actually
made. This is the only result that may be called a prediction, and it is a poor one.

### B. Calibrated on earlier years, tested on a held-out year

Here the model is allowed one number from the farm:

```
calibration factor = reported energy / modelled energy,   summed over 2018 to 2024
                   = 1.1583
```

Every modelled month is multiplied by that factor. The factor is then tested on 2025, a year it
never saw:

| Held-out year 2025 | Result |
|---|---|
| Annual error | +1.46% (model above the farm) |
| Average monthly error, ignoring sign | 5.53% |
| R² of the twelve monthly values | 0.913 |

**What the calibration factor absorbs.** It is not a loss figure. It soaks up every reason the
model runs high or low on average: real losses, and also any bias in the wind data, the shear
exponent and the power curve. Here it is above 1, which means the model runs low even before any
losses: 13.5% below the farm. A real farm cannot have negative losses, so something in the model's
inputs is too low.

**Why fit on some years and test on another.** A factor fitted and tested on the same years would
show nothing: it would match by construction. Holding 2025 back shows whether the factor still
works on a year it was not fitted to. What that test shows is narrow: once the model's average
level is set from the farm's own record, it follows the month-to-month and year-to-year ups and
downs well. It does **not** show that the model could have predicted the farm's output from
scratch. Result A is the answer to that question.

The wording used everywhere is: *calibrated on the farm's earlier years, tested on a held-out
year.* Never "predicted within 1.5%".

### Why the model runs low

This was looked into on 2026-11-16 without changing the model. Each change below was tried alone:

| Change | Model against the farm, before losses |
|---|---|
| As built | −13.5% |
| No wakes at all | −8.5% |
| No shear correction | −8.0% |
| Wind direction reversed | −13.5% |
| Wind speed 8% higher (about 0.5 m/s) | +0.2% |

Wakes and shear cannot close the gap even if removed entirely. A modest shortfall in the wind
speed can. The shortfall is also seasonal: the farm made 24 to 26% more than the model in May to
July, and 9 to 10% more in December and January. The most likely cause is that the ERA5 wind reads
low at this site. One published comparison found ERA5 about 1 m/s too low at a site in Oklahoma
and at one offshore [12]. Nothing has been measured for this site, so this is the likely cause, not
an established one. The wind is also taken from the nearest point on ERA5's grid, 11 km north of
the farm's centre, and each point stands for a patch roughly 20 km by 28 km.

The gap was not tuned away. The blind result stays as measured.

## 7. P50, P90 and P99

The farm does not make the same energy every year. These three numbers say how much it can be
relied on to make:

- **P50** is the middle case: in half of years the farm makes more, in half less.
- **P90** is beaten in 9 years out of 10.
- **P99** is beaten in 99 years out of 100.

Lenders size loans on the low cases, because debt has to be paid in bad years too.

| MWh a year | P50 | P75 | P90 | P99 |
|---|---|---|---|---|
| Any one year | 298,292 | 285,340 | 273,674 | 253,298 |
| Average over ten years | 298,662 | 290,268 | 282,739 | 269,617 |

P50 comes from running the calibrated model over every year from 2000 to 2025 with today's
layout, and taking the average year. How far the others sit below it depends on two spreads:

- **Year-to-year wind, 5.43%.** The standard deviation of those 26 yearly totals, as a share of
  the average. Some years are simply windier.
- **Model error, 3.83%.** The calibrated model's worst yearly error across the eight years it was
  compared with the farm (2023), and never taken as less than 3%. The plan first used the held-out
  year alone, which would have given the 3% floor. That was widened on 2026-11-16 because one good
  year only shows the scaling held that once.

The two are combined by drawing 20,000 made-up years: each is P50 × (1 + a wind error) × (1 + a
model error), both errors drawn from bell curves with those spreads. P90 is the value that 90% of
the draws beat. The random seed is fixed, so the same inputs always give the same numbers.

The ten-year figures are closer to P50 because good and bad wind years average out over ten years.
The model's error does not average out: if the model is 3% high, it is 3% high every year.

**The limit on these numbers.** They describe this farm *given its own operating record*. P50 sits
at the farm's own average because the model was scaled to it. The 3.83% measures how well the
scaled model tracks the farm; seven of the eight years it comes from were used to fit the factor,
which flatters it. It says nothing about the unscaled model, which was 24.92% off. Before the farm
was built there would have been no record to scale to, and an honest uncertainty would have been
far wider. There is also a drift: relative to the model, the farm has made a little less each year
(the yearly error runs from −2.89% in 2018 to +3.83% in 2023), so a P50 set on 2018 to 2024 may be
slightly high for the years ahead.

## 8. Simplifications, and how a professional assessment differs

What this model leaves out or simplifies:

1. **Wind from one reanalysis point.** One ERA5 grid point, 11 km away, stands for the whole farm.
   No measurement at the site.
2. **A fixed shear exponent** of 0.14 at all hours, and a fixed step from 100 m to 80 m.
3. **Density from ground-level** temperature and pressure.
4. **A power curve of unknown origin**, probably traced from a graph, used as if every turbine
   performs exactly to it.
5. **Thrust derived** from the power curve with one fitted efficiency.
6. **The simplest wake model**, with one fixed `k`, flat wake profiles and no effect of turbulence
   or terrain.
7. **Direction and speed in bins**: 5° and 0.5 m/s.
8. **Generic losses** for the blind result, with curtailment left out.
9. **Months compared across a time-zone seam.** The wind hours are in UTC; the farm's months are
   presumably local calendar months, five or six hours behind. The effect on a monthly total is small.
10. **Today's layout for every year** of the long-term series, and no allowance for the turbines
    ageing.
11. **Bell-curve errors** for the P-values, with spreads set by simple rules.

A professional energy assessment, of the kind a lender relies on, differs mainly in where its wind
comes from. It starts with a year or more of measurements at the site, from a mast or a lidar at or
near hub height, and stretches that short record to the long term by relating it to a long
reference series. It models how the wind varies across the site with a flow model, uses the
maker's warranted power curve for the site's own air density and turbulence, and checks more than
one wake model. Losses are estimated category by category for the actual project: its contracts,
its grid connection, its climate. Uncertainty is built up the same way, category by category, and
combined [11]. For a farm that is already running, like this one, an assessment leans on the
farm's own production record, which is what the calibrated result here does in a simple way.

This model does the same job in outline with free public data. Its blind result shows the cost of
that: without a measurement at the site, it was a quarter off.

## Sources

How each was checked matters, so it is stated. "Read" means the source's own page or file was
read on the date given. "Not re-read" means it is a standard reference cited from general
knowledge of the field and should be checked against a copy before the site launches.

| # | Source | Used for | How checked |
|---|---|---|---|
| 1 | Manwell, J. F., McGowan, J. G. and Rogers, A. L., *Wind Energy Explained: Theory, Design and Application*, 2nd ed., Wiley, 2009. | The power-law wind profile and the one-seventh exponent | Not re-read. |
| 2 | International Electrotechnical Commission, IEC 61400-12-1:2017, *Wind energy generation systems – Part 12-1: Power performance measurements of electricity producing wind turbines*, section 9.1.5, "Air density normalisation". | The density correction | The section title was seen in the standard's published table of contents on 2026-11-16. The standard is sold, not free; its text was not read. |
| 3 | System Advisor Model (SAM), wind turbine library, `deploy/libraries/Wind Turbines.csv`, row "Vestas V110-2.0", commit `784177b`, `github.com/NREL/SAM`. BSD 3-Clause, Copyright (c) 2017, 2022 Alliance for Energy Innovation, LLC. | The power curve | Read 2026-11-15. Notice kept in `data/turbines/NOTICE.md`. |
| 4 | Jensen, N. O., *A note on wind generator interaction*, Risø-M-2411, Risø National Laboratory, Roskilde, 1983. | The wake model | Catalogue entry on DTU's research site seen 2026-11-16; the report itself not re-read. |
| 5 | Katić, I., Højstrup, J. and Jensen, N. O., "A simple model for cluster efficiency", *European Wind Energy Association Conference and Exhibition*, Rome, October 1986, pp. 407–410. | The wake model for a whole farm, and combining wakes by sum of squares | Catalogue entry seen 2026-11-16; the paper itself not re-read. |
| 6 | DTU Wind and Energy Systems, WAsP documentation, "Wake effect model", `https://wasp.dtu.dk/software/wasp/wake-effect-model`. | `k` = 0.075 on land | Read 2026-11-16: "The wake effect decay constant has the default value k = 0.075 which according to our experience is adequate in most land-cases." |
| 7 | Burton, T., Jenkins, N., Sharpe, D. and Bossanyi, E., *Wind Energy Handbook*, 2nd ed., Wiley, 2011. | Momentum theory and the Betz limit | Not re-read. |
| 8 | Open Energy Platform, wind turbine library, © Reiner Lemoine Institut, Open Database License (ODbL) 1.0. | Fitting and testing the 0.78 | Read 2026-11-15. Its rows are never committed. |
| 9 | U.S. Energy Information Administration, Form EIA-923, "Power Plant Operations Report", years 2018 to 2025, `https://www.eia.gov/electricity/data/eia923/`. Public domain. | The farm's reported monthly generation | Downloaded 2026-11-14. |
| 10 | System Advisor Model (SAM), default wind inputs, `deploy/runtime/defaults/Wind Power_Single Owner.json`, commit `e6935c1`, `github.com/NREL/SAM`. BSD 3-Clause. | The assumed losses | Read 2026-11-16. |
| 11 | Lee, J. C. Y. and Fields, M. J., "An overview of wind-energy-production prediction bias, losses, and uncertainties", *Wind Energy Science*, 6, 311–365, 2021, `https://doi.org/10.5194/wes-6-311-2021`. CC BY 4.0. | The range of total losses; how assessments build up losses and uncertainty | Read 2026-11-16 (text only; its loss table is an image and was not read). |
| 12 | Pronk, V., Bodini, N., Optis, M., Lundquist, J. K., Moriarty, P., Draxl, C., Purkayastha, A. and Young, E., "Can reanalysis products outperform mesoscale numerical weather prediction models in modeling the wind resource in simple terrain?", *Wind Energy Science*, 7, 487–504, 2022, `https://doi.org/10.5194/wes-7-487-2022`. CC BY 4.0. | ERA5 reading low | Abstract read 2026-11-16: "ERA-5 shows a significant negative bias (∼ −1 m s⁻¹) at both locations, with a larger bias at the land-based site." The sites are in Oklahoma and off New Jersey, not Minnesota. |
| 13 | Hoen, B. D., Diffendorfer, J. E., Rand, J. T., Kramer, L. A., Garrity, C. P. and Hunt, H. E., *United States Wind Turbine Database*, U.S. Geological Survey, American Clean Power Association and Lawrence Berkeley National Laboratory data release, `https://doi.org/10.5066/F7TX3DN0`. Public domain. | Turbine positions, model, hub height and rotor size | Downloaded 2026-11-14. The author list is from memory and the version used is not recorded; the exact acknowledgment wording is on a page that refuses automated readers and must be copied in a browser. |
| 14 | Hersbach, H. et al., *ERA5 hourly data on single levels from 1940 to present*, Copernicus Climate Change Service (C3S) Climate Data Store, 2023, `https://doi.org/10.24381/cds.adbb2d47`. CC BY 4.0. Generated using Copernicus Climate Change Service information. | Hourly wind, temperature and pressure | Reached through Open-Meteo. The credit wording is to be confirmed on the dataset's own page before launch. |
| 15 | Zippenfenig, P., *Open-Meteo.com Weather API*, Zenodo, 2023. Weather data by Open-Meteo.com, `https://open-meteo.com/`, CC BY 4.0. | The service the wind data was downloaded from | Read 2026-11-15. The data was changed here: scaled to hub height and corrected for density. |

Licences and what each obliges are recorded in `docs/data-sources.md`.
