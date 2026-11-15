export type WindCase = 'P50' | 'P90' | 'P99';
export type BindingCase = 'P50' | 'P99' | 'GEARING';

export interface FinanceInputs {
  capacity_mw: number; capex_per_kw: number; opex_per_kw_yr: number; opex_escalation: number;
  ppa_price_mwh: number; ppa_escalation: number; project_life_yrs: number; degradation: number;
  energy_p50_mwh: number; energy_p90_mwh: number; energy_p99_mwh: number; wind_case: WindCase;
  debt_rate: number; debt_tenor_yrs: number; dscr_p50: number; dscr_p99: number; max_gearing: number;
  tax_rate: number; macrs_schedule: number[]; ptc_enabled: 0 | 1; ptc_rate_mwh: number;
  ptc_years: number; discount_rate: number;
}
export interface FinanceOutputs {
  capex_total: number; debt_amount: number; equity_amount: number; binding_case: BindingCase;
  equity_irr: number | null; project_irr_pretax: number | null; lcoe_mwh: number; min_dscr: number | null;
}
export interface YearRow {
  year: number; energy_mwh: number; revenue: number; opex: number; ebitda: number;
  debt_service: number; interest: number; principal: number; debt_balance: number;
  depreciation: number; tax: number; ptc: number; equity_cf: number;
}
export interface FinanceResult { outputs: FinanceOutputs; years: YearRow[] }
export interface FixtureFile {
  model_version: string;
  scenarios: { name: string; inputs: FinanceInputs; outputs: FinanceOutputs }[];
}
