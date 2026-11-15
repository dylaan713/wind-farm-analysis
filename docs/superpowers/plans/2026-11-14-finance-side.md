# Finance Side Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **For the finance partner:** this is your half of the project. Tasks 2 to 5 are yours to build by
> hand in Excel; that is the part only you can do. Tasks 1 and 6 to 8 are code, which you direct
> Claude Code to write and then check against your workbook. Open this repo in Claude Code and say
> "work through docs/superpowers/plans/2026-11-14-finance-side.md, starting at Task N".

**Goal:** A wind farm project-finance model that exists as an Excel workbook (the reference) and as tested TypeScript that matches the workbook to the cent, ready for the site to run live.

**Architecture:** `finance/model.xlsx` is the source of truth and only the finance partner edits it. A Scenarios sheet holds input cases with Excel's own outputs; a small Python script turns that sheet into a JSON fixture. The TypeScript in `core/src/finance/` must reproduce every fixture row. The site imports `runFinance` from `core`.

**Tech Stack:** Excel · Python 3.12+ with `uv`, `openpyxl`, `pytest` · Node 22.12+ with TypeScript and `vitest`. All free. Use the latest stable versions at install time and commit the lockfiles.

**Spec:** `docs/superpowers/specs/2026-11-14-wind-farm-design.md` (sections 5 and 7)

## Global Constraints

- Free only. No paid tiers, trials needing a card, or metered API keys.
- Only the finance partner edits `finance/model.xlsx`. Binary files cannot be merged.
- This plan touches only: `finance/`, `core/src/finance/`, `data/fixtures/finance-*.json`, `docs/notes/finance.md`, and `core/`'s package files if they do not exist yet. Everything else is Dylan's.
- Work on a branch, open a pull request, Dylan reviews. Never commit to `main`.
- Commit with your GitHub noreply email. The repo will be public.
- Every cost and price input carries a source in the `Sources` sheet. No employer material.
- Nothing ships that you cannot explain out loud without notes.
- The model is educational: not investment or tax advice. Simplifications are listed in `Sources`.
- Match tolerances: dollars ±0.01, rates and ratios ±0.000001, LCOE ±0.0001.
- Names below (sheet names, named ranges, JSON keys, function names) are exact. The code depends on them.

## Review Focus

Conditions the spec does not spell out but a real user will hit. Each has a test in the task named.

1. **Scenario rows captured before a formula change.** Stale numbers would make the code match a model that no longer exists. Extractor must refuse and name the rows. (Task 6)
2. **Workbook saved without calculated values** (never opened in Excel after an edit by another tool). Extractor must stop with a clear message, not write blanks. (Task 6)
3. **A rate typed as 6.5 where 0.065 is meant.** Checks sheet flags it; `validateInputs` rejects it. (Tasks 5, 8)
4. **A project that never pays equity back.** Excel shows `#NUM!`; fixture stores `null`; code returns `null`; nothing crashes. (Tasks 6, 8)
5. **Loan longer than the project's life.** Checks sheet flags it; `validateInputs` rejects it. (Tasks 5, 8)
6. **A year where costs exceed revenue.** Debt service floors at zero for that year; `min_dscr` skips years with no debt service. (Tasks 3, 7)

## The model, exactly

Annual periods, end-of-year cash flows. Year 0 is construction; years 1 to `project_life_yrs` are operations. The power contract lasts the whole project life.

**Inputs** (named ranges on sheet `Inputs`; JSON keys are identical):

| Name | Meaning | Placeholder |
|---|---|---|
| `capacity_mw` | Farm size, MW | 100 |
| `capex_per_kw` | Build cost, $/kW | 1700 |
| `opex_per_kw_yr` | Running cost, $/kW per year | 45 |
| `opex_escalation` | Yearly growth in running cost | 0.025 |
| `ppa_price_mwh` | Contract power price, $/MWh | 45 |
| `ppa_escalation` | Yearly growth in power price | 0 |
| `project_life_yrs` | Operating years | 25 |
| `degradation` | Yearly loss of output | 0.005 |
| `energy_p50_mwh` | Year-1 energy, median case | 350000 |
| `energy_p90_mwh` | Year-1 energy, 1-in-10 low case | 315000 |
| `energy_p99_mwh` | Year-1 energy, 1-in-100 low case | 290000 |
| `wind_case` | Case used for returns: `P50`, `P90` or `P99` | P50 |
| `debt_rate` | Loan interest rate | 0.065 |
| `debt_tenor_yrs` | Loan length, years | 18 |
| `dscr_p50` | Required cover on the P50 case | 1.35 |
| `dscr_p99` | Required cover on the P99 case | 1.00 |
| `max_gearing` | Most debt allowed, as a share of build cost | 0.75 |
| `tax_rate` | Income tax rate | 0.21 |
| `macrs_schedule` | 6-cell range, depreciation shares for years 1 to 6 | 0.20, 0.32, 0.192, 0.1152, 0.1152, 0.0576 |
| `ptc_enabled` | 1 = production tax credit on, 0 = off | 0 |
| `ptc_rate_mwh` | Credit, $/MWh | 30 |
| `ptc_years` | Years the credit lasts | 10 |
| `discount_rate` | Rate used for LCOE | 0.07 |
| `model_version` | Text like `1.0.0`. Bump on any formula change | 1.0.0 |

Placeholders make the model run on day one. Task 5 replaces each with a cited value. The three energy numbers are later replaced by Dylan's energy results.

**Formulas** (t = operating year; c = a wind case):

```
capex_total      = capex_per_kw × capacity_mw × 1000
energy(t, c)     = energy_c_mwh × (1 − degradation)^(t−1)
revenue(t, c)    = energy(t, c) × ppa_price_mwh × (1 + ppa_escalation)^(t−1)
opex(t)          = opex_per_kw_yr × capacity_mw × 1000 × (1 + opex_escalation)^(t−1)
ebitda(t, c)     = revenue(t, c) − opex(t)

Loan sizing, run for c = P50 and c = P99:
  ds(t, c)       = max(0, ebitda(t, c)) / dscr_c      for t ≤ debt_tenor_yrs, else 0
  debt(c)        = Σ ds(t, c) / (1 + debt_rate)^t
  binding        = the case with the smaller debt(c); a tie goes to P50
  cap            = max_gearing × capex_total
  if debt(binding) > cap:  debt_amount = cap, every ds(t) is scaled by cap / debt(binding),
                           and binding_case = "GEARING"
  else:                    debt_amount = debt(binding), ds(t) = ds(t, binding)
equity_amount    = capex_total − debt_amount

Loan schedule:
  interest(t)    = balance(t−1) × debt_rate         balance(0) = debt_amount
  principal(t)   = ds(t) − interest(t)
  balance(t)     = balance(t−1) − principal(t)       balance(debt_tenor_yrs) = 0

Returns, all on c = wind_case:
  depreciation(t)= capex_total × macrs_schedule[t]   for t ≤ 6, else 0
  taxable(t)     = ebitda(t) − depreciation(t) − interest(t)
  Losses carry forward without limit and offset later profits:
    used(t)      = min(loss_balance(t−1), max(0, taxable(t)))
    loss_balance(t) = loss_balance(t−1) − used(t) + max(0, −taxable(t))
  tax(t)         = tax_rate × (max(0, taxable(t)) − used(t))
  ptc(t)         = ptc_enabled × ptc_rate_mwh × energy(t)   for t ≤ ptc_years, else 0
  equity_cf(0)   = −equity_amount
  equity_cf(t)   = ebitda(t) − ds(t) − tax(t) + ptc(t)
  equity_irr     = IRR of equity_cf, years 0..life
  project_irr_pretax = IRR of [−capex_total, ebitda(1), …, ebitda(life)]
  min_dscr       = smallest ebitda(t) / ds(t) over years where ds(t) > 0

lcoe_mwh         = (capex_total + Σ opex(t)/(1+discount_rate)^t) / Σ energy(t, P50)/(1+discount_rate)^t
```

**Stated simplifications** (list these in `Sources`): cover is tested on pre-tax cash flow; the credit is counted as cash to the owners in the year earned (real deals use a tax-equity partner); federal tax only; LCOE is pre-tax and excludes the credit; no reserve accounts, fees or construction interest.

**Outputs** (named ranges on sheet `Returns`): `capex_total`, `debt_amount`, `equity_amount`, `binding_case` (`P50`, `P99` or `GEARING`), `equity_irr`, `project_irr_pretax`, `lcoe_mwh`, `min_dscr`.

**The "flat" check case.** With these inputs the answers can be worked out by hand, so both the workbook and the code are tested against them:

`capacity_mw` 100 · `capex_per_kw` 1700 · `opex_per_kw_yr` 40 · `opex_escalation` 0 · `ppa_price_mwh` 40 · `ppa_escalation` 0 · `project_life_yrs` 25 · `degradation` 0 · all three energy inputs 350000 · `wind_case` P50 · `debt_rate` 0.06 · `debt_tenor_yrs` 18 · `dscr_p50` 1.35 · `dscr_p99` 1.00 · `max_gearing` 0.75 · `tax_rate` 0 · `ptc_enabled` 0 · `discount_rate` 0.07

| Output | Expected |
|---|---|
| `capex_total` | 170,000,000.00 |
| EBITDA, every year | 10,000,000.00 |
| Debt service, years 1 to 18 | 7,407,407.41 |
| `debt_amount` | 80,204,470.23 |
| `equity_amount` | 89,795,529.77 |
| `binding_case` | P50 |
| `equity_irr` | 0.015907 |
| `project_irr_pretax` | 0.032167 |
| `lcoe_mwh` | 53.1080 |
| `min_dscr` | 1.350000 |

## File map

| File | Job |
|---|---|
| `finance/model.xlsx` | The reference model. Sheets: `Inputs`, `CashFlow`, `Debt`, `Tax`, `Returns`, `Sensitivity`, `Scenarios`, `Checks`, `Sources` |
| `finance/extract_fixtures.py` | Reads `Scenarios` into JSON |
| `finance/tests/test_extract_fixtures.py` | Tests for the extractor |
| `data/fixtures/finance-flat.json` | The flat case, written by hand in Task 1 |
| `data/fixtures/finance-scenarios.json` | Generated from the workbook in Task 6 |
| `core/src/finance/types.ts` | Input, output and year-row types |
| `core/src/finance/operations.ts` | Energy, revenue, costs, EBITDA |
| `core/src/finance/debt.ts` | Loan sizing and schedule |
| `core/src/finance/tax.ts` | Depreciation, loss carry-forward, tax, credit |
| `core/src/finance/irr.ts` | IRR and present value |
| `core/src/finance/model.ts` | `runFinance` and `validateInputs` |
| `core/src/finance/index.ts` | Public exports |
| `docs/notes/finance.md` | Your own explanation of the method |

---

### Task 0: Get set up

- [ ] **Step 1:** Accept Dylan's invitation to the repo, then clone it and open the folder in Claude Code.
- [ ] **Step 2:** Run `node --version` (need 22.12 or higher), `python3 --version` (need 3.12 or higher) and `uv --version`. Install whichever is missing from nodejs.org, python.org and docs.astral.sh/uv. All are free.
- [ ] **Step 3:** Run `git config user.email` inside the repo. If it is not your `…@users.noreply.github.com` address, set it with `git config user.email "<your noreply address>"` (find it at GitHub → Settings → Emails).
- [ ] **Step 4:** Create your branch: `git switch -c finance/contract`.

### Task 1: The contract (do this first; it unblocks Dylan's site work)

**Files:**
- Create: `core/package.json`, `core/tsconfig.json`, `core/vitest.config.ts` (skip any that already exist)
- Create: `core/src/finance/types.ts`, `core/src/finance/index.ts`
- Create: `data/fixtures/finance-flat.json`
- Test: `core/src/finance/types.test.ts`

**Interfaces:**
- Produces: the types below and the fixture file shape, used by every later task and by the site.

```ts
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
```

- [ ] **Step 1:** If `core/package.json` is missing, create the package: name `@wind-farm/core`, `"type": "module"`, scripts `"test": "vitest run"` and `"check": "tsc --noEmit"`, dev dependencies `typescript` and `vitest`, strict TypeScript. Run `npm install` in `core/`.
- [ ] **Step 2:** Write `data/fixtures/finance-flat.json` as a `FixtureFile` with `model_version` `"hand"` and one scenario named `flat`, using the flat inputs and expected outputs from the table above (`macrs_schedule` is the six placeholder values).
- [ ] **Step 3: Write the failing test** in `core/src/finance/types.test.ts`:

```ts
import flat from '../../../data/fixtures/finance-flat.json';
import type { FixtureFile } from './types';

test('flat fixture has the contract shape', () => {
  const f = flat as FixtureFile;
  expect(f.scenarios).toHaveLength(1);
  const s = f.scenarios[0];
  expect(s.name).toBe('flat');
  expect(Object.keys(s.inputs)).toHaveLength(23);
  expect(s.inputs.macrs_schedule).toHaveLength(6);
  expect(s.outputs.debt_amount).toBeCloseTo(80204470.23, 2);
  expect(s.outputs.binding_case).toBe('P50');
});
```

- [ ] **Step 4:** Run `npm test` in `core/`. Expected: fails because `types.ts` does not exist.
- [ ] **Step 5:** Create `types.ts` with the block above and `index.ts` re-exporting it. Enable `resolveJsonModule` in `tsconfig.json`.
- [ ] **Step 6:** Run `npm test` and `npm run check` in `core/`. Expected: 1 passed, 0 type errors.
- [ ] **Step 7:** Commit (`feat(finance): contract types and flat fixture`), push, open a pull request and tell Dylan the contract is up.

### Task 2: Workbook — inputs and operating cash flow (Excel, by hand)

**Files:** Create `finance/model.xlsx`

- [ ] **Step 1:** New branch `finance/workbook`. Create the workbook with the nine sheets named exactly as in the file map.
- [ ] **Step 2:** On `Inputs`, lay out every input from the table with its placeholder, one per row, with a units column. Give each value cell its exact name (Formulas → Define Name). `macrs_schedule` is a 6-cell range. Colour input cells so they are easy to tell from formulas.
- [ ] **Step 3:** On `CashFlow`, put years 0 to 40 across the top. Build rows for energy, revenue, costs and EBITDA for each of the three wind cases using the formulas above. Years past `project_life_yrs` must show 0.
- [ ] **Step 4: Check.** Type the flat inputs into `Inputs`. EBITDA must read 10,000,000.00 in every year 1 to 25 for all three cases, and 0 from year 26.
- [ ] **Step 5:** Restore the placeholders, save, commit (`feat(finance): workbook inputs and operating cash flow`).

### Task 3: Workbook — the loan (Excel, by hand)

- [ ] **Step 1:** On `Debt`, build the debt service rows for P50 and P99, the present value of each, the binding choice, the gearing cap with its scaling, and the schedule (interest, principal, balance).
- [ ] **Step 2:** On `Returns`, add the named cells `capex_total`, `debt_amount`, `equity_amount`, `binding_case`.
- [ ] **Step 3: Check with the flat inputs.** Debt service 7,407,407.41 in years 1 to 18 and 0 after; `debt_amount` 80,204,470.23; `equity_amount` 89,795,529.77; `binding_case` P50; loan balance at year 18 within 0.01 of zero.
- [ ] **Step 4: Check the cap.** Still on flat inputs, set `max_gearing` to 0.40. `debt_amount` must read 68,000,000.00, `binding_case` GEARING, and debt service 6,280,244.76 in years 1 to 18 (7,407,407.41 × 68,000,000 ÷ 80,204,470.23).
- [ ] **Step 5: Check a loss year.** Set `ppa_price_mwh` to 10. EBITDA is negative; debt service must show 0, not a negative number.
- [ ] **Step 6:** Restore the placeholders, save, commit (`feat(finance): loan sizing and schedule`).

### Task 4: Workbook — tax, credit, returns, LCOE (Excel, by hand)

- [ ] **Step 1:** On `Tax`, build depreciation, taxable income, the loss carry-forward rows, tax and the credit, all on the `wind_case` case.
- [ ] **Step 2:** On `Returns`, build the equity cash flow row and the named cells `equity_irr`, `project_irr_pretax`, `lcoe_mwh`, `min_dscr`. Use Excel's `IRR`.
- [ ] **Step 3: Check with the flat inputs.** `equity_irr` 0.015907; `project_irr_pretax` 0.032167; `lcoe_mwh` 53.1080; `min_dscr` 1.350000.
- [ ] **Step 4: Check the tax logic by hand.** With the placeholder inputs, work out year 1 on paper (EBITDA, depreciation of 34,000,000, interest, taxable income) and confirm the sheet agrees, the first-year tax is 0, and the loss balance equals the year-1 loss.
- [ ] **Step 5: Check the credit.** With placeholders and `ptc_enabled` 1, year-1 credit must be 10,500,000.00 (30 × 350,000) and year 11 must be 0.
- [ ] **Step 6:** Restore the placeholders, save, commit (`feat(finance): tax, credit, returns and LCOE`). Open a pull request for Tasks 2 to 4.

### Task 5: Workbook — checks, real inputs, sensitivity (Excel, by hand)

- [ ] **Step 1:** On `Checks`, add one TRUE/FALSE cell per rule, plus a named cell `all_checks_pass` that is TRUE only when all are:
  - every rate (`opex_escalation`, `ppa_escalation`, `degradation`, `debt_rate`, `tax_rate`, `discount_rate`) is at least 0 and below 1
  - `max_gearing` is above 0 and at most 1
  - `dscr_p50` and `dscr_p99` are at least 1
  - `debt_tenor_yrs` is at most `project_life_yrs`, and `project_life_yrs` is at most 40
  - `macrs_schedule` sums to 1 within 0.0001
  - `energy_p99_mwh` ≤ `energy_p90_mwh` ≤ `energy_p50_mwh`
  - loan balance at the end of the tenor is within 0.01 of zero
  - `debt_amount` + `equity_amount` equals `capex_total` within 0.01
- [ ] **Step 2: Check the checks.** Type 6.5 into `debt_rate`: `all_checks_pass` must turn FALSE. Set `debt_tenor_yrs` to 30: FALSE. Restore both: TRUE.
- [ ] **Step 3:** Replace each cost, price and rate placeholder with a value you can cite. On `Sources`, list for each: the value, the publication, the table or page, the year, and the link. Starting points, all free: the Annual Technology Baseline from the National Laboratory of the Rockies (formerly NREL) for build and running costs; the Land-Based Wind Market Report from Lawrence Berkeley National Laboratory for contract prices and loan terms. Confirm the depreciation schedule and the current tax-credit rules from a primary source and note the date you checked; the rules changed in 2025 and were in court in 2026. Leave the three energy inputs as placeholders until Dylan's results arrive.
- [ ] **Step 4:** On `Sources`, list the stated simplifications from "The model, exactly".
- [ ] **Step 5:** On `Sensitivity`, build a table of `equity_irr` and `debt_amount` against `ppa_price_mwh` (±20% in 5 steps) and `wind_case`, using a Data Table.
- [ ] **Step 6:** Save, commit (`feat(finance): checks, cited inputs and sensitivity`).

### Task 6: Scenarios sheet and the fixture extractor

**Files:**
- Modify: `finance/model.xlsx` (sheet `Scenarios`)
- Create: `pyproject.toml` at the repo root if missing (dependencies `openpyxl`, `pytest`)
- Create: `finance/extract_fixtures.py`, `finance/tests/test_extract_fixtures.py`
- Create: `data/fixtures/finance-scenarios.json` (generated)

**Interfaces:**
- Consumes: the named ranges and `FixtureFile` shape from Task 1.
- Produces: `extract(workbook_path: Path) -> dict` and a command, `uv run python finance/extract_fixtures.py`, that writes `data/fixtures/finance-scenarios.json`.

**Scenarios sheet layout:** row 1 is headers: `name`, `model_version`, then the 22 scalar input names in table order, then the 8 output names each prefixed `out_`. One scenario per row from row 2. `macrs_schedule` is not a column; the extractor reads it once from its named range.

**The ten scenarios:** `flat` (the check case), `base` (your cited inputs), `base_ptc` (credit on), `wind_p90`, `wind_p99` (returns on a low-wind case), `price_high` (+25% price), `price_low` (a price low enough that `equity_irr` is `#NUM!`), `tenor_short` (10-year loan), `gearing_cap` (inputs where the cap binds), `no_tax` (`tax_rate` 0).

- [ ] **Step 1 (Excel, by hand):** For each scenario: type its inputs into `Inputs`, confirm `all_checks_pass` is TRUE, then copy the inputs and outputs into its `Scenarios` row with Paste Special → Values, and fill `model_version`. Restore your base inputs and save.
- [ ] **Step 2: Write the failing tests.** Each builds a small workbook in a temp folder with `openpyxl`:

```python
def test_reads_rows_into_fixture_shape(tmp_path): ...
    # one row named "flat" -> result["scenarios"][0]["outputs"]["debt_amount"] == 80204470.23
    # result["model_version"] == "1.0.0"; len(inputs) == 23; inputs["macrs_schedule"] has 6 values

def test_excel_error_becomes_none(tmp_path): ...
    # out_equity_irr cell holds "#NUM!" -> outputs["equity_irr"] is None

def test_stale_row_is_refused(tmp_path): ...
    # row model_version "0.9.0", workbook model_version "1.0.0"
    # -> raises StaleScenarioError whose message contains the row's name

def test_uncalculated_workbook_is_refused(tmp_path): ...
    # a named output cell reads None -> raises UncalculatedWorkbookError,
    # message says: open the workbook in Excel and save it

def test_failed_checks_are_refused(tmp_path): ...
    # all_checks_pass is False -> raises ChecksFailedError

def test_missing_column_is_refused(tmp_path): ...
    # header row lacks "out_lcoe_mwh" -> raises ValueError naming the column
```

- [ ] **Step 3:** Run `uv run pytest finance -v`. Expected: 6 failures, module not found.
- [ ] **Step 4:** Implement `extract(workbook_path: Path) -> dict` and a `main()` in `finance/extract_fixtures.py`. Open with `openpyxl.load_workbook(path, data_only=True)`. Integers stay numbers; `ptc_enabled` is 0 or 1; `wind_case` and `binding_case` are strings. `main()` writes JSON with 2-space indent and exits non-zero with the error message on any refusal.
- [ ] **Step 5:** Run `uv run pytest finance -v`. Expected: 6 passed.
- [ ] **Step 6:** Run `uv run python finance/extract_fixtures.py`. Expected: `wrote 10 scenarios (model 1.0.0)`. Open the JSON and confirm `flat` matches the expected table and `price_low` has `"equity_irr": null`.
- [ ] **Step 7:** Commit workbook, script, tests and the JSON (`feat(finance): scenarios and fixture extractor`). Pull request.

### Task 7: Code — operations and the loan

**Files:**
- Create: `core/src/finance/operations.ts`, `core/src/finance/debt.ts`
- Test: `core/src/finance/operations.test.ts`, `core/src/finance/debt.test.ts`

**Interfaces:**
- Consumes: `FinanceInputs`, `WindCase`, `BindingCase` from Task 1.
- Produces:

```ts
// operations.ts — arrays are indexed by year, index 0 unused (0), length project_life_yrs + 1
export function energy(i: FinanceInputs, c: WindCase): number[];
export function revenue(i: FinanceInputs, c: WindCase): number[];
export function opex(i: FinanceInputs): number[];
export function ebitda(i: FinanceInputs, c: WindCase): number[];
export function capexTotal(i: FinanceInputs): number;

// debt.ts
export interface DebtResult {
  debt_amount: number; binding_case: BindingCase;
  debt_service: number[]; interest: number[]; principal: number[]; balance: number[];
}
export function sizeDebt(i: FinanceInputs): DebtResult;
```

- [ ] **Step 1: Write the failing tests.** Load the `flat` inputs from `data/fixtures/finance-flat.json` as `flat`.

```ts
// operations.test.ts
test('flat case: EBITDA is 10,000,000 every year', () => {
  const e = ebitda(flat, 'P50');
  expect(e).toHaveLength(26);
  for (let t = 1; t <= 25; t++) expect(e[t]).toBeCloseTo(10_000_000, 2);
});
test('degradation and escalation compound from year 1', () => {
  const i = { ...flat, degradation: 0.01, opex_escalation: 0.02 };
  expect(energy(i, 'P50')[1]).toBeCloseTo(350_000, 6);
  expect(energy(i, 'P50')[3]).toBeCloseTo(350_000 * 0.99 ** 2, 6);
  expect(opex(i)[3]).toBeCloseTo(4_000_000 * 1.02 ** 2, 2);
});

// debt.test.ts
test('flat case matches the hand calculation', () => {
  const d = sizeDebt(flat);
  expect(d.debt_amount).toBeCloseTo(80_204_470.23, 2);
  expect(d.binding_case).toBe('P50');
  expect(d.debt_service[1]).toBeCloseTo(7_407_407.41, 2);
  expect(d.debt_service[19]).toBe(0);
  expect(Math.abs(d.balance[18])).toBeLessThan(0.01);
});
test('gearing cap scales debt service', () => {
  const d = sizeDebt({ ...flat, max_gearing: 0.4 });
  expect(d.debt_amount).toBeCloseTo(68_000_000, 2);
  expect(d.binding_case).toBe('GEARING');
  expect(d.debt_service[1]).toBeCloseTo(6_280_244.76, 2);
});
test('P99 binds when its debt is smaller', () => {
  const d = sizeDebt({ ...flat, energy_p99_mwh: 200_000 });
  expect(d.binding_case).toBe('P99');
});
test('a loss year gets zero debt service', () => {
  const d = sizeDebt({ ...flat, ppa_price_mwh: 10 });
  expect(d.debt_service[1]).toBe(0);
  expect(d.debt_amount).toBe(0);
});
```

- [ ] **Step 2:** Run `npm test` in `core/`. Expected: failures, modules not found.
- [ ] **Step 3:** Implement both files from the formulas in "The model, exactly". Pure functions, no rounding inside the math.
- [ ] **Step 4:** Run `npm test` and `npm run check`. Expected: all pass, 0 type errors.
- [ ] **Step 5:** Commit (`feat(finance): operations and loan sizing in code`).

### Task 8: Code — tax, returns, the full model, and the match test

**Files:**
- Create: `core/src/finance/tax.ts`, `core/src/finance/irr.ts`, `core/src/finance/model.ts`
- Modify: `core/src/finance/index.ts` (export `runFinance`, `validateInputs`)
- Test: `core/src/finance/irr.test.ts`, `core/src/finance/tax.test.ts`, `core/src/finance/model.test.ts`, `core/src/finance/scenarios.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1 and 7.
- Produces:

```ts
// irr.ts
export function presentValue(rate: number, flows: number[]): number;   // flows[0] is year 0
export function irr(flows: number[]): number | null;                    // null if flows never change sign
// tax.ts
export interface TaxResult { depreciation: number[]; tax: number[]; ptc: number[] }
export function taxAndCredit(i: FinanceInputs, ebitdaByYear: number[], interest: number[], energyByYear: number[]): TaxResult;
// model.ts
export function validateInputs(i: FinanceInputs): string[];             // empty when valid
export function runFinance(i: FinanceInputs): FinanceResult;            // throws Error listing validateInputs messages
```

`irr` uses bisection between −0.99 and 10 to a tolerance of 1e-10, and returns `null` when there is no root in that range.

- [ ] **Step 1: Write the failing tests.**

```ts
// irr.test.ts
test('known IRR', () => expect(irr([-100, 110])!).toBeCloseTo(0.1, 9));
test('no sign change gives null', () => expect(irr([-100, -5, -5])).toBeNull());
test('present value', () => expect(presentValue(0.1, [0, 110])).toBeCloseTo(100, 9));

// tax.test.ts
test('losses carry forward and offset later profit', () => {
  // ebitda 100 for years 1..3, depreciation 250 in year 1 (capex 250, schedule [1,0,0,0,0,0]),
  // no interest, tax_rate 0.2: taxable = -150, 100, 100 -> tax = 0, 0, 10
});
test('credit stops after ptc_years', () => {
  // ptc_enabled 1, ptc_rate_mwh 30, ptc_years 10, energy 350000 flat
  // -> ptc[1] = 10_500_000, ptc[10] = 10_500_000, ptc[11] = 0
});
test('credit is zero when disabled', () => { /* ptc_enabled 0 -> every ptc[t] is 0 */ });

// model.test.ts
test('flat case end to end', () => {
  const { outputs, years } = runFinance(flat);
  expect(outputs.equity_irr!).toBeCloseTo(0.015907, 6);
  expect(outputs.project_irr_pretax!).toBeCloseTo(0.032167, 6);
  expect(outputs.lcoe_mwh).toBeCloseTo(53.108, 4);
  expect(outputs.min_dscr!).toBeCloseTo(1.35, 6);
  expect(years).toHaveLength(25);
  expect(years[0].year).toBe(1);
});
test('no payback gives null IRR, not a crash', () => {
  expect(runFinance({ ...flat, ppa_price_mwh: 10 }).outputs.equity_irr).toBeNull();
});
test('min_dscr is null when there is no debt', () => {
  expect(runFinance({ ...flat, ppa_price_mwh: 10 }).outputs.min_dscr).toBeNull();
});
test.each([
  [{ debt_rate: 6.5 }, 'debt_rate'],
  [{ debt_tenor_yrs: 30 }, 'debt_tenor_yrs'],
  [{ dscr_p50: 0.9 }, 'dscr_p50'],
  [{ max_gearing: 0 }, 'max_gearing'],
  [{ energy_p99_mwh: 400_000 }, 'energy_p99_mwh'],
  [{ macrs_schedule: [0.5, 0.2, 0, 0, 0, 0] }, 'macrs_schedule'],
  [{ project_life_yrs: 41 }, 'project_life_yrs'],
])('validateInputs rejects %o', (patch, field) => {
  expect(validateInputs({ ...flat, ...patch }).join(' ')).toContain(field);
});
test('runFinance throws on invalid inputs', () => {
  expect(() => runFinance({ ...flat, debt_rate: 6.5 })).toThrow(/debt_rate/);
});

// scenarios.test.ts — the match test
import fixture from '../../../data/fixtures/finance-scenarios.json';
test.each((fixture as FixtureFile).scenarios)('matches the workbook: $name', ({ inputs, outputs }) => {
  const got = runFinance(inputs).outputs;
  for (const k of ['capex_total', 'debt_amount', 'equity_amount'] as const)
    expect(Math.abs(got[k] - outputs[k])).toBeLessThanOrEqual(0.01);
  expect(got.binding_case).toBe(outputs.binding_case);
  for (const k of ['equity_irr', 'project_irr_pretax', 'min_dscr'] as const) {
    if (outputs[k] === null) expect(got[k]).toBeNull();
    else expect(Math.abs(got[k]! - outputs[k]!)).toBeLessThanOrEqual(1e-6);
  }
  expect(Math.abs(got.lcoe_mwh - outputs.lcoe_mwh)).toBeLessThanOrEqual(1e-4);
});
```

Fill in the three sketched `tax.test.ts` bodies with the numbers in their comments.

- [ ] **Step 2:** Run `npm test`. Expected: failures, modules not found.
- [ ] **Step 3:** Implement `irr.ts`, `tax.ts` and `model.ts`. `validateInputs` enforces the same rules as the `Checks` sheet in Task 5 Step 1 (the input rules, not the two balance checks) and names the offending field in each message. `years` holds rows for years 1 to `project_life_yrs` on the `wind_case` case.
- [ ] **Step 4:** Run `npm test` and `npm run check`. Expected: all pass, including 10 `matches the workbook` cases, 0 type errors.
- [ ] **Step 5:** If a scenario does not match: do not adjust the code until it passes. Find the year where the two first differ (compare `years` with the workbook row by row), decide which side is wrong, and fix that side. If the workbook was wrong, fix it, bump `model_version`, redo Task 6 Step 1 and re-run the extractor.
- [ ] **Step 6:** Commit (`feat(finance): full model in code, matching the workbook`). Pull request.

### Task 9: Explain it, and hand over

**Files:** Create `docs/notes/finance.md`

- [ ] **Step 1:** In your own words, not Claude's, write one short section each on: how the loan is sized and why lenders use low-wind cases; what the cover ratio means; how depreciation and loss carry-forward change the tax bill; what the credit does to returns; what LCOE is and what it leaves out; each simplification and how a real deal differs.
- [ ] **Step 2:** Have Dylan ask you five questions about the model with the notes closed. Anything you cannot answer goes back into the notes, or comes out of the model.
- [ ] **Step 3:** Add a "Finance" section to the repo `README.md`: what the workbook is, how to regenerate the fixture, how to run the tests.
- [ ] **Step 4:** When Dylan's energy results arrive, replace the three energy placeholders and `capacity_mw`, bump `model_version`, redo the scenarios, re-run the extractor and the tests.
- [ ] **Step 5:** Commit (`docs(finance): study notes and README section`). Pull request.

## Commands

```bash
uv run pytest finance -v                         # extractor tests
uv run python finance/extract_fixtures.py        # workbook -> JSON
cd core && npm test && npm run check             # code tests and type check
```
