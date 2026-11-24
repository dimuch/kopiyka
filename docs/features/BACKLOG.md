# Backlog: where kopiyka stands

A snapshot so work can pick up in any tool (Claude Code or Copilot) without the chat history.
Update it when a brief ships, is planned or is dropped.

Snapshot: 2026-11-24, `main` at v1.23.1 (`6b547bc`, after PR #156, 104 part 1).

## In progress

### 104 · Shared components (part 1 of 6 merged)

Brief and plan: `docs/features/104-shared-components/`. At Gate A the brief was split into six sequential briefs,
each branched from `main` after the previous one merges, each a patch bump. The plan's "Later parts" outlines
104b–104f with their call sites. Write each brief from it (in the format of `brief.md`), then run `/kopiyka-hos` on it.

| Part | What                                                                              | State                       |
| ---- | --------------------------------------------------------------------------------- | --------------------------- |
| 104  | `Card` (all 17 cards) and `ProgressBar`; nothing moves                            | merged (#156), v1.23.1      |
| 104b | `Button`, filled (accent, danger): 12 buttons, incl. the actual End form's Save   | **next**; brief not written |
| 104c | `Button`, outlined and text; `outlinedDanger*` and `dangerText` leave `theme.ts`  | not started                 |
| 104d | `IconButton` and `Chip`                                                           | not started                 |
| 104e | `ScreenHeader` (`modal`, `month`, `page`), incl. the actual End form's header     | not started                 |
| 104f | `Text` at every remaining site; name the recurring role + face combinations in it | not started                 |

- **Gate A decisions (2026-11-24):**
  - six parts, Card and ProgressBar first
  - ProgressBar extracted now, with one caller
  - Card takes a required `padding` (`padded`, `list`, `group` or `none`), with layout in `style`
  - hosts that can't be a plain View (Pressable, Animated.View, ReorderList) use `useCardStyle(padding)`
- **"Nothing moves" is proved with layout snapshots, not screenshots.** The script and how to use it are in the 104
  plan, under "Snapshot script". Take the before set on `main` before the first code slice.
- **Differences the later parts keep as they are**, because unifying them would move things more than 2pt (105
  unifies them):
  - filled buttons at 56, 48 or 44pt, radius 20, pill or 14, and disabled opacity 0.6, 0.5 or 0.4
  - the form screens' 8pt top padding and 52pt header spacer
  - chips at 48pt
  - NotionSync's 13pt button text
  - the Undo button's 56pt height

## Next: 109 · Remove the Notion sync and import code

Brief: `docs/features/109-remove-notion/brief.md` (2026-11-24). Run `/kopiyka-hos` on it. It removes the sync,
`notion-start` and the three importers, the `NOTION_*` settings and the Home Sync panel. It keeps all imported data,
and it leaves the four `notion_*` tables unused for a later brief to drop. Minor version: installed builds get a 404
from the old status route and already hide the panel on any error. It can run alongside 104b–104f; expect conflicts
only on Home (the Sync panel).

## Recently finished

- **102 · Month balance in the app**: all 4 PRs are merged (#144, #152, #153 v1.22.0, #155 v1.23.0). Its AC7 iPhone
  check (Expo Go: the Budget tab's Start → End line and the actual End form) was left for the user with PR 4.
- **108 · Expense name suggestions**: #148 (with #150) merged, v1.20.0.
- **Releases:** the newest tag is v1.20.0. Versions 1.20.1–1.23.0 are merged but untagged. Tag a version only once it's
  deployed (conventions §8b).

## Planned: design-system roll-out (`docs/design/design-system.md`)

103, 103b, 103c and 103d (tokens) are merged (#145, #147, #149, #151). The rest, in order (105 waits for all of 104):

| Brief | Draft                                          | What                                                                                      |
| ----- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 104   | `docs/features/104-shared-components/brief.md` | Shared components, split into 104–104f: see In progress                                   |
| 105   | `docs/features/105-fresh-look/brief.md`        | New palettes, Inter, radii, shadows, no borders, card per row, violet bars, caution label |
| 106   | `docs/features/106-floating-tab-bar/brief.md`  | Floating pill tab bar with a round "+" (add expense) button                               |

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
| B   | Shared SQL between the Notion import and the API routes | dropped: goes with 109   |
| D   | App: data hooks                                         | not briefed              |
| E   | App: button actions                                     | not briefed              |
| F   | App: UI pieces                                          | not briefed              |

B is dropped: brief 109 removes the Notion import code it would have shared.

### Named in earlier briefs and plans as "its own brief"

- **Drop the four `notion_*` tables** (`notion_grocery_rows`, `notion_syncs`, `notion_total_adds`,
  `notion_counted_expenses`) once brief 109's release has run fine (109, Out of scope).
- **One modal-form kit** for `income-item.tsx`, `category-form.tsx` and `actual-end.tsx` (102 follow-up). A refactor
  session holds it until 104b's `Button` and 104e's `ScreenHeader` are on `main`.
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

- Briefs 082 and 083 (PWA) were written in a separate checkout, `../kopiyka-pwa`, on the old laptop, as untracked
  folders `docs/features/082-installable-web-app/` and `083-launch-and-resume/`. They aren't on GitHub. Numbers
  073–078 aren't in `docs/features/` either. Copy anything still wanted into `docs/features/` before that laptop goes.
- A few untracked files in the old laptop's main checkout are kept out of the repo on purpose. Copy them across by
  hand if they're still wanted.
- Personal Claude skills (`~/.claude/skills`: `incremental-implementation`, `test-driven-development`,
  `debugging-and-error-recovery`, `security-and-hardening`, `source-driven-development`, `code-simplification`) don't
  travel with the repo. Copy them to `~/.copilot/skills/` on the new laptop if you want them (conventions §8a).
- Claude's memory for this project (`~/.claude/projects/…/memory`) stays on the old laptop. This file and the plans in
  `docs/features/` are the record to work from.
- Local QA data doesn't travel either: the dev database, its QA user `claude-qa-103b` and that user's TOTP secret exist
  only on the old laptop.
  - On a new laptop, create a fresh user per brief with `yarn api create-user`, using `--username claude-qa-<NNN>`
    and `--email claude-qa-<NNN>@example.test`. Keep its secret out of the repo, and delete the user when the brief
    is done.
  - For the 104 snapshot views, seed November data with at least one bar under plan, one near it and one over it.

## Plans with unticked boxes

These older plans still have `- [ ]` slices: 052 (11), 058 (10), 059 (3), 068 (9), 071 (1). Later briefs built on
them, so most are probably stale ticks rather than missing work. Check the code before treating any as open.
