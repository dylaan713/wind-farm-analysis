import type { TurbineSpec } from './types';

/** The made-up test turbine from the energy plan, Task 3. Used only by the tests. */
export const T: TurbineSpec = {
  model: 'test 2 MW', rated_kw: 2000, hub_height_m: 80, rotor_diameter_m: 80,
  curve_v: [3, 8, 12, 25], curve_kw: [0, 800, 2000, 2000], curve_ct: null, cut_in: 3, cut_out: 25,
};
