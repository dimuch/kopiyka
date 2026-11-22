# Plan: Budget figure labels: Budgeted and Remaining

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/budget-figure-labels
Base: origin/main

## Approach

Change three strings in `IncomeFigures` (`apps/mobile/src/app/(tabs)/budget.tsx`): the labels `'Planned'` →
`'Budgeted'` and `'Left to plan'` → `'Remaining'`, and the strip's `accessibilityLabel` to
`` `Income ${income}, budgeted ${planned}, remaining ${leftText}` ``. Its one-line JSDoc says "planned total and what's
left to plan", so it gets the same words to stay true. Amounts, the `over: left < 0` danger colour and all identifiers
stay as they are. The demo re-exports this screen (`src/demo-app/(tabs)/budget.tsx`), so it picks up the change with no
edit.
Alternative considered: also renaming identifiers (`planned`, `left`, `leftText`) to match. The brief puts that out of
scope, and it would add a mechanical diff with no user-visible effect.

Strings checked on the Base: no test, demo data, `buildCheck` banned text, README, `AGENTS.md` or `deploy/README.md`
asserts "Planned" or "Left to plan" from this strip. The other hits are out of scope by the brief: the MCP `month_summary`
description ("what is left to plan", `apps/mcp/src/mcp/tools.ts:271`), a comment in `src/demo/sampleData.ts:6`, the
Statistics tab's `'Planned'` row, and past briefs/plans in `docs/features/`.

## Contracts

- DB: none
- API: none
- App: none (no props, types or routes change; `IncomeFigures` keeps `{ incomeCents, plannedCents }`)
- Reuses: `eur` from `@/format` and the existing `figures` array, unchanged
- New dependencies: none

## Version

Bump: patch — 1.15.3 → 1.15.4
Why: §8b `patch` row, "copy": the shipped app's labels and screen-reader text change, with no new capability.

## Slices

- [ ] 0. Bump version to 1.15.4
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.15.4
- [ ] 1. Label the Budget figures Budgeted and Remaining (~4 lines)
  - Files: apps/mobile/src/app/(tabs)/budget.tsx
  - Change: in `IncomeFigures`, labels `'Planned'` → `'Budgeted'`, `'Left to plan'` → `'Remaining'`; the
    `accessibilityLabel` → `Income …, budgeted …, remaining …`; the JSDoc to "The month's income, budgeted total and
    what remains; below zero reads in the danger colour."
  - Tests: none (copy only, no logic; no existing test asserts these strings). Gates: format, lint, typecheck, test.
  - Verify (launch configs `api` + `web`, phone width ~390px):
    - a month with income and listed categories (e.g. November 2026) shows "Income", "Budgeted", "Remaining" with the
      same three amounts as before the change (note them on `main` first);
    - a month with income below its planned total shows the negative Remaining (e.g. "−€50") in the danger colour.
      November and later refuse that (`over_income`), so use a month before `INCOME_RULE_START` (`2026-11`), e.g.
      October 2026, set up in the dev DB with income below planned (add or lower an `income_items` row by SQL — a temporary dev-DB change, undone right after the check);
    - the strip's accessible name, read in the browser's accessibility tree (or VoiceOver on iPhone), is
      "Income €X, budgeted €Y, remaining €Z";
    - the demo (`web-demo`) Budget tab shows the new labels too (sample data: Income €1,750, Budgeted €1,400,
      Remaining €350).

## AC → evidence

| AC                                                                   | Evidence                                                  |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| Strip shows "Income", "Budgeted", "Remaining" with unchanged amounts | Slice 1 Verify, first and last bullets (web, phone width) |
| Income below planned → "Remaining" negative in the danger colour     | Slice 1 Verify, second bullet (October 2026, seeded)      |
| Accessibility label reads "Income …, budgeted …, remaining …"        | Slice 1 Verify, third bullet (accessibility tree)         |

## Not doing (YAGNI)

- Renaming identifiers (`plannedCents`, `planned`, `left`, `leftText`) — out of scope by the brief.
- The "€X planned" Categories caption, category row text and hint, "Planned amount" field, Expenses and Statistics
  tabs, "Planned would exceed income" error, MCP `month_summary` wording, API — out of scope by the brief.
- The "left to plan" comment in `src/demo/sampleData.ts` — not user-visible; the brief keeps other "planned" uses.
- A render test for the strip — the app has no component test setup (conventions §6: UI is verified in the browser).

## Risks

- "Remaining" or "Budgeted" is wider than the old label and wraps at phone width — disproven by slice 1 Verify at
  ~390px (both are shorter than "Left to plan", so unlikely).

## Open questions

- no — The brief gives the JSDoc no wording; I assumed it should follow the new labels so the comment stays true.

## Follow-ups

None.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a: CONSOLIDATE line, each reuse/extract, each LEAVE + reason>
