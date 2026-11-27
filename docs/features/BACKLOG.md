# Backlog: where kopiyka stands

A snapshot so work can pick up in any tool (Claude Code or Copilot) without the chat history.
Update it when a brief ships, is planned or is dropped.

Snapshot: 2026-11-27, `main` at v1.23.16 (`3899b99`, after PR #177: brief 105e is done).

## In progress

### 110 · One source for the skills and agents (in review, branch `chore/one-source-for-skills`, no version)

Brief and plan: `docs/features/110-one-source-for-skills/`. `yarn skills:build` generates Copilot's `kopiyka-*`
skills and agents from `.claude`, and CI's `yarn skills:check` fails when they differ. Brief 111 comes next. From now
on, skills-sync's commits to `.claude/skills/kopiyka-*` or `.claude/agents` need `yarn skills:build` too.

### 116 · Scroll areas end above the tab bar (in review, branch `fix/scroll-above-tab-bar`, v1.26.2)

Brief and plan: `docs/features/116-scroll-above-tab-bar/`. Every page with the floating tab bar ends its scroll view
16pt above the bar, or above the Undo bar while it shows, so no row scrolls behind it. Follow-up:
`docs/design/design-system.md`'s `TabBar` component row still describes the round "+" removed in a465e421.

## Recently finished

### 115 · Chip tile inset (done: #184, v1.26.1, live with v1.26.2)

Brief and plan: `docs/features/115-flush-chip-tile/`. A chip with a leading tile or icon has a 3pt inset on both
sides, so the tile sits concentric with the pill's round end; chips without one keep 8pt on both sides. Built flush
first, changed to the 3pt inset after review. iPhone, large-text and Light-mode checks not done yet.

### 114 · Category icons (done: #182 API, v1.25.0; the app's PR, v1.26.0)

Brief and plan: `docs/features/114-category-icons/`. A category can hold one of 101 icons copied from Lucide 1.81.0
(ISC/MIT, licence beside `apps/mobile/src/components/categoryIcons.ts`), picked in the category form and stored on the
category, so every member sees it in every month. No icon shows the letter. Shipped as two PRs: the API, then the app.

### 113 · Round category tile (done: #181, v1.24.2)

Brief and plan: `docs/features/113-round-category-tile/`. The category tile is a circle everywhere, so it follows the
chip's round ends. Its centre sits 5pt in from the chip's end because of the chip's left padding; accepted at plan
approval.

### The tab bar's "+" removed (no brief)

The round "+" beside the tab bar (brief 106) is gone: each page already has its own way to add an expense, income
or budget. The pill now spans the bar's full width.

### 106 · The floating tab bar and its "+" (done: #178, v1.24.0)

Brief and plan: `docs/features/106-floating-tab-bar/`. A floating pill tab bar and a round "+" on every page with
tabs, one component for both kinds of page; "+" opens the add-expense form on the category last used on this device.

### 105e · The header, the toast, inputs, menus and sheets (done: #177, v1.23.16)

Brief and plan: `docs/features/105e-one-look-header/`. One header shape (a round Back or Home, a centred title, one
action), the Undo bar and menus on `shadow.float` (a `hairline` ring in dark), inputs in `fill` with an edge only on
focus, and `borderStrong` gone.

### 105d · One look per button, chip and icon button (done: #176, v1.23.15)

Brief and plan: `docs/features/105d-one-look-controls/`. Filled buttons are one 48pt pill and text buttons 44pt, all
dimming to 0.4; danger is the doc's grey with a red label; chips are a 32pt pill in a 44pt touch area; icon buttons
are round.

### 105c · Borderless cards and one card per row (done: #175, v1.23.14)

Brief and plan: `docs/features/105c-borderless-cards/`. Cards lost their edge for the doc's shadow in light, lists
put each row on its own card 8pt apart, and the few edges left are a faint `hairline`.

### 105b · Inter and the type mapping (done: #174, v1.23.13)

Brief and plan: `docs/features/105b-inter-type/`. Inter (four faces, one per weight) replaced Bricolage Grotesque
and IBM Plex Sans; every role and `Text` pair takes the doc's weight, with no `fontWeight`.

### 105 · The fresh look, part 1 (done: #173, v1.23.12)

Brief and plan: `docs/features/105-fresh-look/`. The palettes, violet bars, the "€X left" caution label, and light by
default. At Gate A the brief was split into 105, 105b, 105c and 105d, each its own brief, PR and patch bump; the later
parts' outlines are in its plan under "Later parts". The fresh look is complete: 105–105e (#173–#177).

### 104 · Shared components (done: 104–104h, #156–#171, v1.23.11)

Brief and plan: `docs/features/104-shared-components/`. At Gate A the brief was split into six sequential briefs,
each branched from `main` after the previous one merges, each a patch bump. Each part's brief was written from
the plan's "Later parts", and 104f's Gate A split it into 104f–104h.

| Part | What                                                                             | State                   |
| ---- | -------------------------------------------------------------------------------- | ----------------------- |
| 104  | `Card` (all 17 cards) and `ProgressBar`; nothing moves                           | merged (#156), v1.23.1  |
| 104b | `Button`, filled (accent, danger): 11 buttons, incl. the actual End form's Save  | merged (#160), v1.23.3  |
| 104c | `Button`, outlined and text; `outlinedDanger*` and `dangerText` leave `theme.ts` | merged (#161), v1.23.4  |
| 104d | `IconButton` and `Chip`                                                          | merged (#163), v1.23.6  |
| 104e | `ScreenHeader` (`modal`, `month`, `page`), incl. the actual End form's header    | merged (#166), v1.23.8  |
| 104f | `Text`, and every shared component's and the demo strip's text through it        | merged (#169), v1.23.9  |
| 104g | `Text` on Home, Budget, Income, Expenses, Statistics, the category page          | merged (#170), v1.23.10 |
| 104h | `Text` on Settings, Members, the form screens, login, no-ledger                  | merged (#171), v1.23.11 |

- **Gate A decisions (2026-11-24):**
  - six parts, Card and ProgressBar first
  - ProgressBar extracted now, with one caller
  - Card takes a required `padding` (`padded`, `list`, `group` or `none`), with layout in `style`
  - hosts that can't be a plain View (Pressable, Animated.View, ReorderList) use `useCardStyle(padding)`
- **"Nothing moves" is proved with layout snapshots, not screenshots.** The exact script (104f's columns) is
  written out in `docs/features/104h-text-other-screens/plan.md`, under Visual check. Take the before set on `main`
  before the first code slice.
- **Differences the later parts keep as they are**, because unifying them would move things more than 2pt (105
  unifies them):
  - filled buttons at 56, 48 or 44pt, radius 20, pill or 14, and disabled opacity 0.6, 0.5 or 0.4
  - the form screens' 8pt top padding and 52pt header spacer
  - chips at 48pt
  - the Undo button's 56pt height
- **Result:** only `Text.tsx`, `theme.ts` and the listed exceptions (`TextInput` styles, DateField's value,
  CategoryTile's letter, TabBar's badge) style text directly.
- **Optional follow-ups, not briefed:** a lint rule against `text` role spreads and `fontFamily` outside `Text.tsx`
  and `theme.ts` (exceptions allowlisted); a line in conventions §5 pointing new code at the 104 components.

- **109 · Remove the Notion sync and import code**: two patch PRs, app first, so open web tabs never called a removed
  route (the brief's "plain 404" would have shown "Couldn't check Notion sync."). #158 (Home panel, v1.23.2,
  deployed 2026-11-25), then the API, scripts, settings and docs (v1.23.3). Imported data and the four `notion_*`
  tables stay. After it ships, revoke the Notion integration token and delete the laptop's `NOTION_*` keys.
- **102 · Month balance in the app**: all 4 PRs are merged (#144, #152, #153 v1.22.0, #155 v1.23.0). Its AC7 iPhone
  check (Expo Go: the Budget tab's Start → End line and the actual End form) was left for the user with PR 4.
- **108 · Expense name suggestions**: #148 (with #150) merged, v1.20.0.
- **Releases:** the newest tag is v1.20.0. Versions 1.20.1–1.23.0 are merged but untagged. Tag a version only once it's
  deployed (conventions §8b).

## Planned: design-system roll-out (`docs/design/design-system.md`)

103, 103b, 103c and 103d (tokens) are merged (#145, #147, #149, #151), and 104 (shared components) is done. The
rest, in order:

| Brief | Draft                                           | What                                                                                |
| ----- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| 104   | `docs/features/104-shared-components/brief.md`  | Shared components, split into 104–104h: done, see Recently finished                 |
| 105   | `docs/features/105-fresh-look/brief.md`         | Part 1: the palettes, violet bars, the caution label, light by default (done, #173) |
| 105b  | `docs/features/105b-inter-type/brief.md`        | Inter and the type mapping, the weight fixes, DateField's hidden input (done, #174) |
| 105c  | `docs/features/105c-borderless-cards/brief.md`  | Borderless cards with shadows, one card per row (done, #175)                        |
| 105d  | `docs/features/105d-one-look-controls/brief.md` | One look each for buttons, chips and icon buttons (done, #176)                      |
| 105e  | `docs/features/105e-one-look-header/brief.md`   | The header, the toast, inputs, menus and sheets (done, #177)                        |
| 106   | `docs/features/106-floating-tab-bar/brief.md`   | Floating pill tab bar with a round "+" (add expense) button (done, #178)            |

Each 105 part's brief is written from the plan's "Later parts" after the previous part merges. 107 (budget polish,
#146) already brought forward one 105 item: the same caution yellow in both themes.

## Planned: repo tooling

Drafted on 2026-11-25, after PR #167 turned Copilot's identical copies of the skills into symlinks. Run 110 before
111, because 111 edits `kopiyka-hos`, which 110 makes single-source. Neither changes the app or API.

| Brief | Draft                                              | What                                                                                         |
| ----- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 110   | `docs/features/110-one-source-for-skills/brief.md` | Generate Copilot's `kopiyka-*` skills and agents from `.claude`, with a CI check (in review) |
| 111   | `docs/features/111-plan-outcomes/brief.md`         | Replace shipped plans with short outcomes, as an after-merge flow step                       |

Item 3 of the same review, finishing the design system with 104f and 105, is already planned above.

## Planned: small fixes

| Brief | Draft                                              | What                                                                           |
| ----- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| 112   | `docs/features/112-summary-figures-order/brief.md` | Expenses card in Budget's order: Spent · Budgeted · Remaining (label included) |

## Not briefed yet

### Refactor roadmap (project scan, 2026-11-27)

`docs/features/refactor-roadmap-2026-11.md`: 17 behaviour-preserving PRs, R1–R17, each its own brief and a patch bump,
run in order through `/kopiyka-hos-refactoring`, then a deploy. It replaces the 2026-11-21 roadmap's D (data hooks →
R7, R13), E (button actions → R9, R11), F (UI pieces → R10, R16, R17) and H (split `members.tsx` and `expense.tsx`:
`expense.tsx` → R14; splitting `members.tsx` is left alone). A, C and G merged (#138, #140, #143); B was dropped with
brief 109.

| PRs    | Area           | State       |
| ------ | -------------- | ----------- |
| R1–R5  | API, connector | not started |
| R6–R17 | App            | not started |

### Named in earlier briefs and plans as "its own brief"

- **Drop the four `notion_*` tables** (`notion_grocery_rows`, `notion_syncs`, `notion_total_adds`,
  `notion_counted_expenses`) once brief 109's release has run fine (109, Out of scope).
- **One modal-form kit** for `income-item.tsx`, `category-form.tsx` and `actual-end.tsx` (102 follow-up): roadmap R12.
- **Statistics' category list follows the member's order** as a tie-break, if wanted (092 follow-up).
- **Chips that are silent on web**: `aria-selected` isn't valid on `role="button"`, so the category and date chips
  may not say "selected" on web. Pick `aria-pressed` or a radio group as in `AppearancePicker` (095 follow-up).
- **API-wide single-letter names** (100 follow-up): roadmap R1.
- **`categories/routes.ts` passed 200 lines** (092 follow-up): the 2026-11-27 scan left it alone; its logic is already in
  `monthLists.ts` and `order.ts`, and the extra lines are DTOs and schemas.

### Small follow-ups (no brief needed until one is picked)

- The expense form's Back stays enabled while a save is in flight; pressing it during an edit's save may go back
  twice when the save ends (read in the code, not reproduced). Pass `disabled` up as the other forms do (104e).
- `find-short-names.sh` misses a typed single-letter parameter on a line of its own, such as `  q: Db |`. Could also
  match `^\s+[a-z]: ` (100).
- "Remaining" means income − budgeted on Budget and budgeted − spent on Expenses. The brief accepted it; worth a
  second look when 104/105 restyle both strips (107).
- Conventions §5 could say "states via `aria-*` props (react-native-web ignores `accessibilityState`)" (095).
- Laptop data: July and August both hold `0.00 → -377.00`, and August's opening isn't July's closing. It came from
  brief 085's import. The importer is gone (109), so fix it by hand with an actual End on the Budget tab (090).
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
- Local QA data doesn't travel either: the dev database, its QA users and their TOTP secrets exist
  only on the old laptop.
  - On a new laptop, create a fresh user per brief with `yarn api create-user`, using `--username claude-qa-<NNN>`
    and `--email claude-qa-<NNN>@example.test`. Keep its secret out of the repo, and delete the user when the brief
    is done.
  - For the 104 snapshot views, seed November data with at least one bar under plan, one near it and one over it.

## Plans with unticked boxes

These older plans still have `- [ ]` slices: 052 (11), 058 (10), 059 (3), 068 (9), 071 (1). Later briefs built on
them, so most are probably stale ticks rather than missing work. Check the code before treating any as open.
