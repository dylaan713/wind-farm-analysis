# wind-farm

A wind farm analysis from the wind to the money, built by two people: an energy model checked
against a real farm's reported output, a project-finance model built in Excel and matched in
tested code, and an interactive site. **Read `HANDOFF.md` first.**

- Design: `docs/superpowers/specs/2026-11-14-wind-farm-design.md`
- Finance plan: `docs/superpowers/plans/2026-11-14-finance-side.md`
- Energy plan: `docs/superpowers/plans/2026-11-14-energy-side.md`
- Site design: `docs/superpowers/specs/2026-11-14-site-design.md` (mockup: `docs/design/first-screen-mockup-colour.html`)
- Site plan, part 1: `docs/superpowers/plans/2026-11-14-site-foundation-and-first-screen.md`

Status 2026-11-14: planning. No code, no test gate and no build exist yet. Add the commands here
when they do.

## Hard rules
- Free only. No paid tiers, trials needing a card, or metered API keys.
- **Dylan manages this repo and does all merging.** Everyone else, and any agent working for them,
  works on a branch, pushes it, opens a pull request and stops there. Never merge a pull request,
  never push or commit to `main`, never force-push, never delete a branch you did not create, and
  never change repo settings. If something is blocked waiting on a merge, say so in the pull
  request and wait. (Dylan, 2026-11-14. GitHub does not enforce this while the repo is private,
  so it is on each person and agent to keep it.)
- Pull requests get a review from the other person before Dylan merges.
- Only the finance partner edits `finance/model.xlsx`.
- The repo will be public. Commit with a GitHub noreply email. No secrets; `.env` stays untracked.
- Nothing is published that its owner cannot explain, and no skill is credited to someone who
  did not use it. The validation error is published as measured, and described as "calibrated
  on earlier years, tested on a held-out year" — never as a from-scratch prediction.
- Educational model: not investment, tax or engineering advice.

## Capability
Six project-scoped skills in `.claude/skills/` (Python, TypeScript, accessibility, Playwright,
verification). The site's quality bar is Dylan's global `web-design-craft` skill, not copied here.
The installed set, the deferred set and the rejected set with reasons are in `.claude/CAPABILITY.md`.
