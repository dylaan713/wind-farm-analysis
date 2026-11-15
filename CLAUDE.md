# wind-farm

A wind farm analysis from the wind to the money, built by two people: an energy model checked
against a real farm's reported output, a project-finance model built in Excel and matched in
tested code, and an interactive site. **Read `HANDOFF.md` first.**

- Design: `docs/superpowers/specs/2026-11-14-wind-farm-design.md`
- Finance plan: `docs/superpowers/plans/2026-11-14-finance-side.md`

Status 2026-11-14: planning. No code, no test gate and no build exist yet. Add the commands here
when they do.

## Hard rules
- Free only. No paid tiers, trials needing a card, or metered API keys.
- Work on a branch and open a pull request; the other person reviews. Never commit to `main`.
  (Agreed by both, 2026-11-14. GitHub does not enforce it while the repo is private.)
- Only the finance partner edits `finance/model.xlsx`.
- The repo will be public. Commit with a GitHub noreply email. No secrets; `.env` stays untracked.
- Nothing is published that its owner cannot explain, and no skill is credited to someone who
  did not use it. The validation error is published as measured.
- Educational model: not investment, tax or engineering advice.

## Capability
Seven project-scoped skills in `.claude/skills/` (Python, TypeScript, accessibility, Playwright,
verification, and `web-design-craft` as the site's quality bar). The installed set, the deferred
set and the rejected set with reasons are in `.claude/CAPABILITY.md`.
