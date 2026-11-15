# Test samples

Small pieces of the real public data, cut down on 2026-11-14 so the tests never touch the network.

- `turbines.json`: 20 turbines from the US Wind Turbine Database API (12 from one farm, 7 others, 1 with no EIA id).
- `f923_sample.xlsx`: EIA Form 923, 2024 final, sheet "Page 1 Generation and Fuel Data" with its six
  real header rows and three real plants: Solano Wind (7526, wind, monthly reporter `M`),
  Snake River (90, wind, `AM`), and Barry (3, natural gas).
- `wind-week.json`: Open-Meteo archive response, `models=era5`, for 41.0 N, 95.0 W, 1 to 7 January 2023.
