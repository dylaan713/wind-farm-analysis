/** One turbine model. The same fields as the Python `Turbine` in `energy/turbine.py`. */
export interface TurbineSpec {
  model: string;
  rated_kw: number;
  hub_height_m: number;
  rotor_diameter_m: number;
  /** Ascending wind speeds, m/s. */
  curve_v: number[];
  curve_kw: number[];
  /** Published thrust curve, or null when thrust is derived from the power curve. */
  curve_ct: number[] | null;
  cut_in: number;
  cut_out: number;
}

/** A turbine's place in local metres: x east, y north. */
export interface Point {
  x: number;
  y: number;
}

/** How often the wind comes from each direction at each speed; the shares sum to 1.
 * `freq[i][j]` is the share of hours from direction `i * dir_step` degrees at `j * speed_step` m/s. */
export interface WindRose {
  dir_step: number;
  speed_step: number;
  freq: number[][];
}
