# Backlog: where kopiyka stands

A snapshot so work can pick up in any tool (Claude Code or Copilot) without the chat history.
Update it when a brief ships, is planned or is dropped.

Snapshot: 2026-11-28, `main` at v1.27.0 (`060a593f`, after PR #206: brief 134 is done).

## In progress

### 111 · Replace shipped plans with short outcomes (building, branch `chore/plan-outcomes`, no version)

Brief and plan: `docs/features/111-plan-outcomes/`. Once a brief's last PR merges, a short `outcome.md` (from
`docs/features/_outcome-template.md`) replaces its `plan.md`, as an after-merge step in `/kopiyka-hos` and
`/kopiyka-hos-refactoring`. One pass does it for every brief that has already shipped.

## Recently finished

### 134 · Statistics: Chart / Table switch, with a category bar chart (done: #206, v1.27.0)

Brief and plan: `docs/features/134-statistics-chart-view/`. Statistics opens on a Chart view: the totals, then the
period's spending per category as bars in each category's tile colour (the summary now sends `techName`). Two icon
buttons beside the period switcher pick Chart or Table (today's lists). Left: the iPhone check with VoiceOver. Next
steps towards more charts (pie, stacked) are not briefed yet. Merged while 111 was being built, so its plan stays until
its own after-merge step.

### 110 · One source for the skills and agents (done: #187, no version)

Brief and outcome: `docs/features/110-one-source-for-skills/`. `yarn skills:build` generates Copilot's `kopiyka-*`
skills and agents from `.claude`, and CI's `yarn skills:check` fails when they differ. Skills-sync's commits to
`.claude/skills/kopiyka-*` or `.claude/agents` need `yarn skills:build` too.

### 116 · Scroll areas end above the tab bar (done: #185, v1.26.2)

Brief and outcome: `docs/features/116-scroll-above-tab-bar/`. Every page with the floating tab bar ends its scroll view
16pt above the bar, or above the Undo bar while it shows, so no row scrolls behind it. Follow-up:
`docs/design/design-system.md`'s `TabBar` component row still describes the round "+" removed in a465e421.

### 112 · Expenses card in Budget's order (done: #179, v1.24.1)

Brief and outcome: `docs/features/112-summary-figures-order/`. The Expenses card shows Spent · Budgeted · Remaining, in
Budget's order, label included.

### 115 · Chip tile inset (done: #184, v1.26.1, live with v1.26.2)

Brief and outcome: `docs/features/115-flush-chip-tile/`. A chip with a leading tile or icon has a 3pt inset on both
sides, so the tile sits concentric with the pill's round end; chips without one keep 8pt on both sides. Built flush
first, changed to the 3pt inset after review. iPhone, large-text and Light-mode checks not done yet.

### 114 · Category icons (done: #182 API, v1.25.0; the app's PR, v1.26.0)

Brief and outcome: `docs/features/114-category-icons/`. A category can hold one of 101 icons copied from Lucide 1.81.0
(ISC/MIT, licence beside `apps/mobile/src/components/categoryIcons.ts`), picked in the category form and stored on the
category, so every member sees it in every month. No icon shows the letter. Shipped as two PRs: the API, then the app.

### 113 · Round category tile (done: #181, v1.24.2)

Brief and outcome: `docs/features/113-round-category-tile/`. The category tile is a circle everywhere, so it follows the
chip's round ends. Its centre sits 5pt in from the chip's end because of the chip's left padding; accepted at plan
approval.

### The tab bar's "+" removed (no brief)

The round "+" beside the tab bar (brief 106) is gone: each page already has its own way to add an expense, income
or budget. The pill now spans the bar's full width.

### 106 · The floating tab bar and its "+" (done: #178, v1.24.0)

Brief and outcome: `docs/features/106-floating-tab-bar/`. A floating pill tab bar and a round "+" on every page with
tabs, one component for both kinds of page; "+" opens the add-expense form on the category last used on this device.

### 105e · The header, the toast, inputs, menus and sheets (done: #177, v1.23.16)

Brief and outcome: `docs/features/105e-one-look-header/`. One header shape (a round Back or Home, a centred title, one
action), the Undo bar and menus on `shadow.float` (a `hairline` ring in dark), inputs in `fill` with an edge only on
focus, and `borderStrong` gone.

### 105d · One look per button, chip and icon button (done: #176, v1.23.15)

Brief and outcome: `docs/features/105d-one-look-controls/`. Filled buttons are one 48pt pill and text buttons 44pt, all
dimming to 0.4; danger is the doc's grey with a red label; chips are a 32pt pill in a 44pt touch area; icon buttons
are round.

### 105c · Borderless cards and one card per row (done: #175, v1.23.14)

Brief and outcome: `docs/features/105c-borderless-cards/`. Cards lost their edge for the doc's shadow in light, lists
put each row on its own card 8pt apart, and the few edges left are a faint `hairline`.

### 105b · Inter and the type mapping (done: #174, v1.23.13)

Brief and outcome: `docs/features/105b-inter-type/`. Inter (four faces, one per weight) replaced Bricolage Grotesque
and IBM Plex Sans; every role and `Text` pair takes the doc's weight, with no `fontWeight`.

### 105 · The fresh look, part 1 (done: #173, v1.23.12)

Brief and outcome: `docs/features/105-fresh-look/`. The palettes, violet bars, the "€X left" caution label, and light by
default. At Gate A the brief was split into 105, 105b, 105c and 105d, each its own brief, PR and patch bump; the later
parts' outlines are in its plan under "Later parts". The fresh look is complete: 105–105e (#173–#177).

### 104 · Shared components (done: 104–104h, #156–#171, v1.23.11)

Brief and outcome: `docs/features/104-shared-components/`. At Gate A the brief was split into six sequential briefs,
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
  written out in `docs/design/layout-snapshots.md`. Take the before set on `main`
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
- **Releases:** the tags after v1.20.0 are v1.26.2 and v1.26.19, the versions that were deployed. The versions between
  them were merged but never deployed on their own, so they get no tag (conventions §8b).

## Design-system roll-out, done (`docs/design/design-system.md`)

103, 103b, 103c and 103d (tokens) are merged (#145, #147, #149, #151). Every brief of the roll-out has shipped:

| Brief | Draft                                           | What                                                                                |
| ----- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| 104   | `docs/features/104-shared-components/brief.md`  | Shared components, split into 104–104h: done, see Recently finished                 |
| 105   | `docs/features/105-fresh-look/brief.md`         | Part 1: the palettes, violet bars, the caution label, light by default (done, #173) |
| 105b  | `docs/features/105b-inter-type/brief.md`        | Inter and the type mapping, the weight fixes, DateField's hidden input (done, #174) |
| 105c  | `docs/features/105c-borderless-cards/brief.md`  | Borderless cards with shadows, one card per row (done, #175)                        |
| 105d  | `docs/features/105d-one-look-controls/brief.md` | One look each for buttons, chips and icon buttons (done, #176)                      |
| 105e  | `docs/features/105e-one-look-header/brief.md`   | The header, the toast, inputs, menus and sheets (done, #177)                        |
| 106   | `docs/features/106-floating-tab-bar/brief.md`   | Floating pill tab bar with a round "+" (add expense) button (done, #178)            |

Each 105 part's brief was written from the 105 plan's "Later parts" after the previous part merged. 107 (budget
polish, #146) brought forward one 105 item: the same caution yellow in both themes.

## Not briefed yet

### Refactor roadmap (project scan, 2026-11-27)

`docs/features/refactor-roadmap-2026-11.md`: 17 behaviour-preserving PRs, R1–R17, each its own brief and a patch bump,
run in order through `/kopiyka-hos-refactoring`, then a deploy. It replaces the 2026-11-21 roadmap's D (data hooks →
R7, R13), E (button actions → R9, R11), F (UI pieces → R10, R16, R17) and H (split `members.tsx` and `expense.tsx`:
`expense.tsx` → R14; splitting `members.tsx` is left alone). A, C and G merged (#138, #140, #143); B was dropped with
brief 109. R16 (brief 132) covers five screens: the category screen keeps its own load state, since its refresh line sits
inside its scroll view.

| Row | Slug                      | Brief | State       |
| --- | ------------------------- | ----- | ----------- |
| R1  | api-descriptive-names     | 117   | done (#189) |
| R2  | api-extract-long-handlers | 118   | done (#190) |
| R3  | throttle-attempt-steps    | 119   | done (#191) |
| R4  | api-small-structure       | 120   | done (#192) |
| R5  | mcp-tools-layout          | 121   | done (#193) |
| R6  | demo-store-helpers        | 122   | done (#194) |
| R7  | app-focus-load-hook       | 123   | done (#195) |
| R8  | app-short-names           | 124   | done (#196) |
| R9  | app-back-fallback         | 125   | done (#197) |
| R10 | app-field-style           | 126   | done (#198) |
| R11 | app-announced-errors      | 127   | done (#199) |
| R12 | modal-form-kit            | 128   | done (#200) |
| R13 | copy-previous-hook        | 129   | done (#201) |
| R14 | expense-form-split        | 130   | done (#202) |
| R15 | statistics-sections       | 131   | done (#203) |
| R16 | load-state                | 132   | done (#204) |
| R17 | figure-row                | 133   | done (#205) |

Each row's outcome is in its brief's folder, `docs/features/<brief>-<slug>/outcome.md`.

### Named in earlier briefs and plans as "its own brief"

- **Drop the four `notion_*` tables** (`notion_grocery_rows`, `notion_syncs`, `notion_total_adds`,
  `notion_counted_expenses`) once brief 109's release has run fine (109, Out of scope).
- **One modal-form kit** for `income-item.tsx`, `category-form.tsx` and `actual-end.tsx` (102 follow-up): roadmap R12,
  brief 128 (`ModalFormScreen`), done (#200).
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
  match `^\s+[a-z]: ` (100). It also misses destructured single letters, such as `const { y, height } = …` (124).
- Conventions §5 could say "states via `aria-*` props (react-native-web ignores `accessibilityState`)" (095).
- Laptop data: July and August both hold `0.00 → -377.00`, and August's opening isn't July's closing. It came from
  brief 085's import. The importer is gone (109), so fix it by hand with an actual End on the Budget tab (090).
- Reads across several queries without a transaction (balances, Statistics) could mix snapshots under a concurrent
  write. Harmless today; matters if balances are ever exported (102).
- With `CORS_ORIGINS` set (dev only), an `OPTIONS` request without preflight headers gets a plain-text 400, not
  JSON (002).
- Expense POST (201) and restore (200) return `loadExpense(...)` unchecked, so a delete landing in between answers
  `null` (002).
- `INSERT IGNORE INTO exchange_rates` (`rates/service.ts`) silently clamps an out-of-range rate;
  `ON DUPLICATE KEY UPDATE rate_date = rate_date` would ignore only duplicates (002).
- `createUserWithLedger` in `admin.ts` runs its own `beginTransaction`; it could use `withTransaction` (013).
- Deploy: add `shellcheck deploy/*.sh` to `ci.yml` (016).
- Deploy: build on the GitHub runner and ship artifacts, to spare the droplet and keep build-time dependency code off
  it (016).
- Deploy: database backups and uptime monitoring (016).
- Deploy: move the deploy key to a root-owned `AuthorizedKeysFile` (sshd `Match User kopiyka`) (016).
- After a delete-category opened from a web link, browser Back from Home reached "Category not found." Not
  reproduced since the screen changed to remove from one month; check before fixing (018).
- Drop `categories.deleted_at` and its filters in a migration; nothing has set it since 032 (028).
- `MONTH_RE` accepts `9999-12`, so a crafted month most likely ends in a 500; add a year cap (029).
- `apps/mobile/src/linkParams.ts` says `MONTH_RE` mirrors `apps/api/src/expenses/routes.ts`; it lives in
  `apps/api/src/dates.ts` (030).
- `CompactTotal`'s JSDoc says "the budget part appears once budgets exist", but its only caller passes `null` (034).
- `createUserWithLedger`'s own rollback isn't guarded like `withTransaction`'s, so a lost connection could hide the
  first error (051).
- Settings still shows "Coming soon." from `PlaceholderPage` above the real settings (052).
- Conventions §3 could state: from 2026-11, a write that raises a month's planned total or lowers its income checks
  `checkIncome` under `lockLedger`; and list income among what an ended month refuses (058, 060).
- Fold `incomeCents`, `sumCents` and `plannedCents` in `data/monthSummary.ts` into one helper (059, 061).
- Connector: support CIMD (`client_id_metadata_document_supported`) with an allowlist of client hosts, once Claude or
  the spec drops DCR (063).
- Conventions §2 could get an `apps/mcp` row group: route modules, `seal.ts`, `limits.ts`, the boundary rule (063).
- Build the app's device id with a cryptographic random source (`crypto.getRandomValues` or `expo-crypto`) instead of
  `Math.random()` in `api/client.ts`; 072 deferred it to its own brief (064).
- Conventions §5 could say new UI uses `@/components/Pressable` and `TextField`, perhaps with a lint rule against
  React Native's own (066).
- A failed `/api/ledgers` at launch signs the screen out whatever the reason (`AuthProvider`'s catch), so a 429 or a
  network error shows login over a valid session; 072 deferred it as app behaviour (067).
- `errForLog` drops `cause`, so an NBU connection failure logs only "fetch failed" without the root reason (069).
- Connector: a `restore_expense` tool, adding the expense restore route to `WRITE_TOKEN_ROUTES`; the owner's decision
  of 2026-11-08 made it a future feature (070).
- Droplet: hide the other sites' world-readable files from both services; needs the droplet's layout (072).
- Demo: a test that each name shared code imports from the three swapped modules exists on the demo's version (080).
- Demo: put the droplet's measured export and build-check times and peak memory in `deploy.sh`'s "Measured peaks"
  comment; only macOS figures are there (081).
- Web: `/_sitemap` lists the route file names to anyone in production; `sitemap: false` in the expo-router plugin
  would close it (084).
- The root `package.json`'s `engines` is `>=24`, which allows Node 24.0–24.2 and 25, which SDK 58 doesn't support
  (084).
- `MonthSwitcher`'s arrows move with the month name's width, so fast taps can miss; a fixed label width would fix it.
  Budget and Income still use it (089).
- A missing `DATABASE_URL` or `TOTP_ENC_KEY` prints a raw ZodError stack instead of a usage line; `create-user` still
  goes through `loadConfig` (098).
- A text lint guard (104's follow-up) could also ban `fontWeight` in `apps/mobile/src` (105b).
- Web: move the fonts to WOFF2 or a subset if the first web load proves slow (105b).
- The tab screens' gutter is 20pt (`space.xl`) against the design doc's 16 (105c).
- LedgerPicker's options sit 20pt in, against the cards' 12 (105c).
- Light mode: the category tiles' initials are under 4.5:1 on `fill` (3.30:1) and on white (3.72:1) (105d).
- Statistics' header could become a `ScreenHeader` with a centred "Statistics"; this moves its title (105e).
- iOS scroll indicators run under the tab bar; `scrollIndicatorInsets={{ bottom: room }}` would lift them (106).
- Skills-sync's commits to `.claude/skills/kopiyka-*` or `.claude/agents` need `yarn skills:build` too;
  `.claude/skills-sync.json` doesn't say so yet (110).
- `categories/monthLists.ts` is 410 lines, past the ~200-line split point; split it along with 092's `routes.ts`
  (114).
- `find-short-names.sh --diff` skips `apps/mcp/src` and `apps/mcp/test` (`app_dirs`), so connector briefs can't use it
  as a gate; add them, then run `yarn skills:build` (121).
- The demo store never checks `expenseDate`'s shape, unlike the API's Zod schema. A note, not a bug the app can hit
  (122).
- `apps/mobile/test` still uses single-letter names, for example `format.test.ts`'s `d` (124).
- `closeToBudget.ts` now also holds the general `backOr`; it could be renamed, for example to `backOr.ts` (125).
- Sign-in's error has the alert role but no VoiceOver announcement, unlike every other form (`login.tsx`) (127).
- The `body` style (`gap lg`, `paddingTop lg`, `paddingBottom huge`) is copied in `ModalFormScreen`, `actual-end` and
  `income-item` (128).
- The category form's bad-link and loading lines sit 16px higher than income's and actual End's. Lining them up
  changes the look, so it needs its own brief (128).
- `CategoryForm` could take `& Saving` for its `busy`/`setBusy` props instead of declaring its own (128).
- `remove()` in `expense.tsx` could call `saveErrorText` for its `month_ended` line; a refactor brief (130).

## Outside this repo

- Briefs 082 and 083 (PWA) were written in a separate checkout, `../kopiyka-pwa`, on the old laptop, as untracked
  folders `docs/features/082-installable-web-app/` and `083-launch-and-resume/`. They aren't on GitHub. Numbers
  073–078 aren't in `docs/features/` either. Copy anything still wanted into `docs/features/` before that laptop goes.
- A few untracked files in the old laptop's main checkout are kept out of the repo on purpose. Copy them across by
  hand if they're still wanted.
- Personal Claude skills (`~/.claude/skills`: `incremental-implementation`, `test-driven-development`,
  `debugging-and-error-recovery`, `security-and-hardening`, `source-driven-development`, `code-simplification`) don't
  travel with the repo. Copy them to `~/.copilot/skills/` on the new laptop if you want them (conventions §8a).
- Claude's memory for this project (`~/.claude/projects/…/memory`) stays on the old laptop. This file and the briefs and
  outcomes in `docs/features/` are the record to work from.
- Local QA data doesn't travel either: the dev database, its QA users and their TOTP secrets exist
  only on the old laptop.
  - On a new laptop, create a fresh user per brief with `yarn api create-user`, using `--username claude-qa-<NNN>`
    and `--email claude-qa-<NNN>@example.test`. Keep its secret out of the repo, and delete the user when the brief
    is done.
  - For the 104 snapshot views, seed November data with at least one bar under plan, one near it and one over it.
