// The TypeScript model against answers worked out by the Python model (`energy/export.py`), and
// against the result files of the real run.
import cases from '../../../data/fixtures/energy-cases.json';
import contract from '../../../data/results/energy-contract.json';
import rose from '../../../data/results/wind-rose.json';
import { annualEnergyMwh, farmPowerKw, powerKw, thrustCoefficient, turbineSpeeds } from './index';
import type { Point, TurbineSpec } from './index';

const spec: TurbineSpec = cases.spec;
const layout: Point[] = cases.layout;

test('the fixture file holds what the plan asks for', () => {
  expect(cases.turbine).toHaveLength(20);
  expect(cases.farm).toHaveLength(20);
  expect(layout).toHaveLength(contract.farm.turbine_count);
});

test.each(cases.turbine)('one turbine at $v m/s', (c) => {
  expect(powerKw(spec, c.v)).toBeCloseTo(c.power_kw, 6);
  expect(thrustCoefficient(spec, c.v)).toBeCloseTo(c.ct, 6);
});

test.each(cases.farm)('farm at $wind_from_deg° and $v m/s', (c) => {
  const got = farmPowerKw(spec, layout, c.wind_from_deg, c.v);
  expect(Math.abs(got - c.farm_power_kw)).toBeLessThanOrEqual(0.005 * Math.max(1, c.farm_power_kw));
  const speeds = turbineSpeeds(spec, layout, c.wind_from_deg, c.v);
  speeds.forEach((s, i) => expect(s).toBeCloseTo(c.turbine_speeds[i]!, 5));
});

test('annual energy from the wind rose is within 2% of the hourly model', () => {
  const fromRose = annualEnergyMwh(spec, layout, rose, contract.calibration.factor);
  const hourly = contract.energy_mwh.p50;
  expect(Math.abs(fromRose / hourly - 1)).toBeLessThan(0.02);
});

test('dragging a turbine far away removes its wake loss', () => {
  for (const c of cases.farm) {
    const theta = (c.wind_from_deg * Math.PI) / 180;
    // 50 km along the crosswind axis, so it neither shades nor is shaded by any other turbine.
    const moved = layout.map((p, i) => (i === 0 ? { x: p.x + 50000 * Math.cos(theta), y: p.y - 50000 * Math.sin(theta) } : p));
    expect(farmPowerKw(spec, moved, c.wind_from_deg, c.v)).toBeGreaterThanOrEqual(c.farm_power_kw - 1e-6);
  }
});

test('farm power on the real layout is fast enough to run while dragging', () => {
  for (let i = 0; i < 50; i++) farmPowerKw(spec, layout, i * 7, 8); // warm up
  const calls = 200;
  const start = performance.now();
  for (let i = 0; i < calls; i++) farmPowerKw(spec, layout, (i * 37) % 360, 4 + (i % 12));
  const each = (performance.now() - start) / calls;
  expect(each).toBeLessThan(2);
});
