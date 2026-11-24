# Backlog: where kopiyka stands

A snapshot so work can pick up in any tool (Claude Code or Copilot) without the chat history.
Update it when a brief ships, is planned or is dropped.

Snapshot: 2026-11-24, `main` at v1.21.0 (`1caa333`, after PR #152).

## In progress

### 102 · Month balance in the app (2 of 4 PRs merged)

Brief and plan: `docs/features/102-month-balance-in-app/`. The plan holds every remaining slice with files, tests
and checks; resume with `/kopiyka-hos resume month-balance-in-app`.

| PR  | Branch                      | What                                                          | State                   |
| --- | --------------------------- | ------------------------------------------------------------- | ----------------------- |
| 1   | `feat/month-balance`        | API works out each month's Start and End                      | merged (#144)           |
| 2   | `feat/month-actual-end`     | API: set and clear a month's actual End (migration 018)       | merged (#152), v1.21.0  |
| 3   | `feat/month-balance-demo`   | Demo store follows the rule (slices 9–10)                     | **next**, not started   |
| 4   | `feat/month-actual-end-app` | Budget-tab form to set and clear an actual End (slices 11–14) | not started, after PR 3 |

- The plan's version lines (1.19.0, 1.20.0) are stale: briefs 103–108 used those numbers. Take `main`'s next minor
  (1.22.0 for PR 3) and note it under the plan's Deviations, as PR 2 did.
- AC7's iPhone check (Expo Go) is left for the user at PR 4.

## Planned: design-system roll-out (`docs/design/design-system.md`)

103, 103b, 103c and 103d (tokens) are merged (#145, #147, #149, #151). The rest, in order:

| Brief | Draft                                          | What                                                                                                                                                                                                                          |
| ----- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 104   | `docs/features/104-shared-components/brief.md` | `Text`, `Card`, `Button`, `IconButton`, `Chip`, `ScreenHeader`, `ProgressBar`; nothing visibly changes. Reviewed and split at Gate A into 104–104f: 104 is `Card` and `ProgressBar`, the plan's Later parts outline 104b–104f |
| 105   | `docs/features/105-fresh-look/brief.md`        | New palettes, Inter, radii, shadows, no borders, card per row, violet bars, caution label                                                                                                                                     |
| 106   | `docs/features/106-floating-tab-bar/brief.md`  | Floating pill tab bar with a round "+" (add expense) button                                                                                                                                                                   |

The 105 and 106 briefs are **drafts** written from the design doc and the follow-ups earlier plans handed on. Read and
correct each before running `/kopiyka-hos` on it. 107 (budget polish, #146) already brought forward one 105 item:
the same caution yellow in both themes.

## Not briefed yet

### Refactor roadmap (project scan, 2026-11-21)

Order: A → C → G → B → D, E, F. Run each through `/kopiyka-hos-refactoring`.

| PR  | What                                                    | State                    |
| --- | ------------------------------------------------------- | ------------------------ |
| A   | API month guards                                        | merged (#138, brief 096) |
| C   | Importer scripts' shared command-line code              | merged (#140, brief 098) |
| G   | Small cleanups                                          | merged (#143, brief 100) |
| B   | Shared SQL between the Notion import and the API routes | not briefed              |
| D   | App: data hooks                                         | not briefed              |
| E   | App: button actions                                     | not briefed              |
| F   | App: UI pieces                                          | not briefed              |

B may not be worth doing if the Notion code goes (next section).

### Named in earlier briefs and plans as "its own brief"

- **Remove the Notion sync and import code** (Sync to Notion, `notion-start`, `import-history`, `import-balances`,
  `import-income`). The user's decision, 2026-11-22 (brief 102, Out of scope). Do it after 102 ships.
- **Statistics' category list follows the member's order** as a tie-break, if wanted (092 follow-up).
- **Chips that are silent on web**: `aria-selected` isn't valid on `role="button"`, so the category and date chips
  may not say "selected" on web. Pick `aria-pressed` or a radio group as in `AppearancePicker` (095 follow-up).
- **API-wide single-letter names**: about 29 lines outside `apps/api/src/notion/`, plus `addMember(q, …)` in
  `ledgers/members.ts` (100 follow-up). A rename slice.
- **`categories/routes.ts` passed 200 lines**: a `service.ts` split (092 follow-up).

### Small follow-ups (no brief needed until one is picked)

- `find-short-names.sh` misses a typed single-letter parameter on a line of its own, such as `  q: Db |`. Could also
  match `^\s+[a-z]: ` (100).
- Importer CLI oddities: plural messages ("Saved 1 rows"), `--ledger` accepting `0x10` and `1e0`, `--save` keeping an
  existing file's mode, a raw ZodError when `DATABASE_URL` or `TOTP_ENC_KEY` is missing (098).
- "Remaining" means income − budgeted on Budget and budgeted − spent on Expenses. The brief accepted it; worth a
  second look when 104/105 restyle both strips (107).
- Conventions §5 could say "states via `aria-*` props (react-native-web ignores `accessibilityState`)" (095).
- Laptop data: July and August both hold `0.00 → -377.00`, and August's opening isn't July's closing. It came from
  brief 085's import; check it in Notion (090).
- Reads across several queries without a transaction (balances, Statistics) could mix snapshots under a concurrent
  write. Harmless today; matters if balances are ever exported (102).

## Outside this repo

- Briefs 082 and 083 (PWA) were written in a separate checkout, `../kopiyka-pwa`, on the old laptop. They aren't on
  GitHub. Numbers 073–078 aren't in `docs/features/` either. Copy anything still wanted into `docs/features/`
  before that laptop goes.
- Personal Claude skills (`~/.claude/skills`: `incremental-implementation`, `test-driven-development`,
  `debugging-and-error-recovery`, `security-and-hardening`, `source-driven-development`, `code-simplification`) don't
  travel with the repo. Copy them to `~/.copilot/skills/` on the new laptop if you want them (conventions §8a).

## Plans with unticked boxes

These older plans still have `- [ ]` slices: 052 (11), 058 (10), 059 (3), 068 (9), 071 (1). Later briefs built on
them, so most are probably stale ticks rather than missing work. Check the code before treating any as open.
