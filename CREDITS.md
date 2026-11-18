# Data credits

This project uses public data. The credits below cover every branch of this repository, including
the sample files under `energy/tests/samples/` and the result files under `data/`. What each licence
obliges is set out in `docs/data-sources.md` on the energy branches.

- **Wind:** [Weather data by Open-Meteo.com](https://open-meteo.com/), offered under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The sample file
  `energy/tests/samples/wind-week.json` is an unmodified archive response. Elsewhere the data was
  changed: scaled to hub height and corrected for air density.
- **Reanalysis behind the wind data (ERA5):** Hersbach et al. (2023), ERA5 hourly data on single
  levels from 1940 to present, Copernicus Climate Change Service (C3S) Climate Data Store,
  <https://doi.org/10.24381/cds.adbb2d47>, CC BY 4.0. Generated using Copernicus Climate Change
  Service information 2026. Where the data was changed: contains modified Copernicus Climate Change
  Service information 2026. Neither the European Commission nor ECMWF is responsible for any use
  that may be made of the Copernicus information or data it contains.
- **Turbines:** United States Wind Turbine Database, U.S. Geological Survey, American Clean Power
  Association and Lawrence Berkeley National Laboratory, <https://doi.org/10.5066/F7TX3DN0>. Public
  domain.
- **Reported generation:** Source: U.S. Energy Information Administration, Form EIA-923. Public
  domain.
- **Power curve and assumed losses:** System Advisor Model (SAM), <https://github.com/NREL/SAM>,
  BSD 3-Clause. The copyright notice travels with the copied row in `data/turbines/NOTICE.md`. This
  project is not endorsed by the laboratory or by any turbine manufacturer.

This is an educational model. It has no affiliation with the owner of the farm it studies.
