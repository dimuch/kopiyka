# Plan: Notion sync, part 5: "Sync to Notion" button on Home

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/notion-sync-button
Base: origin/main (133922c, which has 021–023 and the 025 theme toggle)

## Approach

This is an app-only change. A full-width Notion panel goes under Home's card grid. It shows a status line next to a
**Sync to Notion** button, and after a press it shows the result. There's no API change, as the brief requires.

- **Pure texts.** All wording is built in a pure module, `apps/mobile/src/data/notionSync.ts`: the status line, the
  result summary, the failure reasons and the refusal messages. It's unit-tested with Vitest, like
  `data/monthSummary.ts`.
- **Hook.** A data hook, `data/useNotionSync.ts`, loads the status on focus and runs the sync. It's built like
  `useMonth`.
- **Component.** `components/NotionSyncPanel.tsx` is presentational and themed with `useThemedStyles(makeStyles)`.
- **Hiding.** The panel is hidden while the status loads and whenever the API answers 404 `notion_not_configured`,
  whether to the status call or to the sync call.

Alternative considered: show the result in `Alert.alert`. It lost because react-native-web's `Alert` does nothing, so
the web build would show no result. An inline result also stays visible next to the status it changed.

## Contracts

- DB: none.
- API: none. These are the consumed endpoints, exactly as on Base (`apps/api/src/notion/routes.ts`, plans 021–023):
  - `GET /api/ledgers/:id/notion/status` → 200 `{ unsent: number; lastSyncedAt: string | null }`.
    - `lastSyncedAt` is ISO UTC, and null before the first clean sync.
    - `unsent` counts grocery changes plus uncounted non-grocery expenses.
    - Errors: 401 `unauthorized`, 404 `not_found` (non-member) and 404 `notion_not_configured` (no scope, or another
      ledger).
  - `POST /api/ledgers/:id/notion/sync` (no body) → 200:
    `{ groceries: { created, updated, trashed: number; failed: Array<{ expenseId: number; name: string; date: string; error: string }> }; totals: { added: number; failed: Array<{ category: string; month: string; error: string }> } | null }`.
    - `date` is `YYYY-MM-DD`, `category` is a tech_name and `month` is `YYYY-MM`.
    - `totals` is null when the Expenses table isn't configured.
    - Errors:
      - 401 `unauthorized`.
      - 404 `not_found`.
      - 404 `notion_not_configured`: no scope, another ledger, or no Notion token. The last one is possible even when
        status answered 200.
      - 409 `totals_not_started`.
      - 409 `sync_in_progress`.
    - Item `error` codes:
      - Groceries: `page_taken`, `sent_in_other_year`, `notion_unreachable`, `internal`, or a Notion code such as
        `rate_limited`, `object_not_found` or `validation_error`.
      - Totals: `no_netto_page`, `duplicate_rows`, `actual_amount_changed`, the same Notion codes, `notion_unreachable`
        and `internal`. 022's `no_row` is gone since 023.
- App:
  - `apps/mobile/src/api/types.ts` (slice 1): `NotionStatus { unsent: number; lastSyncedAt: string | null }` and
    `NotionSyncResult` mirroring the 200 body above. `NotionSyncResult` has these named parts:
    - `GroceryFailure { expenseId: number; name: string; date: string; error: string }`
    - `TotalsFailure { category: string; month: string; error: string }`
  - `apps/mobile/src/format.ts` (slice 1). Both are built from one-field Kyiv formatters (the existing `kyivFormat`):
    - `kyivDayTime(iso: string): string` gives `'10 Oct, 14:02'` in Europe/Kyiv, 24-hour, with minutes padded. The hour
      is taken `% 24` so an engine answering `'24'` at midnight still shows `00`.
    - `shortMonthLabel(month: string): string` turns `'2027-01'` into `'Jan 2027'`.
  - `apps/mobile/src/data/notionSync.ts` (pure, no I/O):
    - `statusText(status: NotionStatus): string` (slice 1):
      - `unsent > 0` with a time gives `'5 new · last synced 10 Oct, 14:02'`.
      - `unsent > 0` with `null` gives `'5 new · not synced yet'`.
      - `unsent === 0` gives `'Up to date'`.
    - `syncReport(result: NotionSyncResult): SyncReport` (slice 2; slice 4 adds `reasons`):
      ```ts
      interface SyncReport {
        /** 'Added 3 groceries, updated 1, removed 1 · added to 2 categories'; 'Nothing new to sync' when nothing
         *  changed and nothing failed; null when nothing changed but something failed. */
        done: string | null;
        /** '2 couldn’t sync' (count of groceries.failed + totals.failed entries), or null. */
        failed: string | null;
        /** Slice 4: one line per reason, at most 5 plus 'and N more' (N counts reason lines after grouping). */
        reasons: string[];
      }
      ```
      - **Groceries part.** It lists the non-zero counts in the order added, updated, removed. The noun goes on the
        first count: "Added 3 groceries, updated 1", "Updated 1 grocery", "Removed 2 groceries".
      - **Totals part.** It shows "added to N categories" (or "1 category") when `totals.added > 0`.
      - **Joining.** The two parts are joined with `' · '`, and the first letter is capitalised.
    - `syncErrorText(code: string): string` (slice 2) covers a sync that was refused or never reached the API:
      - `sync_in_progress` → "A sync is already running. Try again in a moment."
      - `totals_not_started` → "Category totals aren’t set up yet. Run yarn api notion-start --totals on the server
        first."
      - `network` → "Couldn’t reach the server. Check your connection and try again."
      - Anything else → "Couldn’t sync. Try again."
    - Reasons (slice 4) keep the API's order: groceries first, then totals.
      - A grocery gives `'<name>, <shortDate(date)>: <reason>'`.
      - `no_netto_page` gives one line per month, at the month's first entry: `'No Netto page for Jan 2027'`.
      - Other totals failures give `'<tech_name with spaces, first letter capitalised>, <shortMonthLabel>: <reason>'`.
      - Reason per code:
        - `page_taken` → "its Notion row belongs to another expense"
        - `sent_in_other_year` → "still in another year’s Notion table"
        - `duplicate_rows` → "two rows for it in Notion"
        - `actual_amount_changed` → "Actual Amount was changed in Notion, check it"
        - `notion_unreachable` → "Notion couldn’t be reached"
        - `rate_limited` → "Notion is busy, try again later"
        - `internal` → "something went wrong"
        - any other code → `Notion refused it (<code>)`
  - `apps/mobile/src/data/useNotionSync.ts` (slice 3):
    ```ts
    export type NotionSyncState =
      | { status: 'loading' }
      | { status: 'unconfigured' }
      | { status: 'failed' }
      | { status: 'ready'; notion: NotionStatus };
    export type SyncOutcome = { kind: 'result'; result: NotionSyncResult } | { kind: 'refused'; code: string };
    export function useNotionSync(ledgerId: number): {
      state: NotionSyncState;
      syncing: boolean;
      outcome: SyncOutcome | null;
      sync: () => void;
      reload: () => void;
    };
    ```
    - **Status load.** Status loads in `useFocusEffect` with the `let live` guard and `useMonth`'s tagged-state
      pattern. A refetch keeps the last `ready` state, so the panel doesn't flicker on focus. 404
      `notion_not_configured` → `unconfigured`; any other failure → `failed`.
    - **`sync()`.** It returns at once if a sync is already in flight. A `useRef` flag, set synchronously, guards
      against a fast double tap landing before the `syncing` re-render. Otherwise it sets the flag and `syncing`, then
      POSTs.
      - A 200 → `{ kind: 'result' }`.
      - An `ApiError` 404 `notion_not_configured` → state `unconfigured`.
      - Any other `ApiError` → `{ kind: 'refused', code }`.
      - A non-`ApiError` throw → `{ kind: 'refused', code: 'network' }`.
      - 401 is already handled by `api()`'s sign-out handler.
      - It then clears the flag and `syncing`. After a 404 `notion_not_configured`, the hook stays `unconfigured` for
        as long as it's mounted, so later status loads don't override it, and it doesn't reload. In every other case it
        reloads the status.
    - **`outcome`** stays until the next press. It isn't cleared on refocus, so the last result stays readable next to
      the refreshed status.
  - `apps/mobile/src/components/NotionSyncPanel.tsx` (slice 3; slice 4 adds the reasons list):
    - Props: `{ status: NotionStatus; syncing: boolean; outcome: SyncOutcome | null; onSync: () => void }`.
    - **Row.** A full-width surface card. One row holds `statusText` (flex 1, muted) and the button.
    - **Button.** It has `accessibilityRole="button"`, the label "Sync to Notion" and a touch target ≥ 44pt. Its
      `accessibilityState` is `{ disabled: syncing, busy: syncing }`. It shows "Syncing…" and is disabled while a sync
      runs.
    - **Result.** Under the row it shows the result:
      - `done` in `colors.text`.
      - `failed` in `colors.danger`, followed by a "Retry" `Pressable` (accent, ≥ 44pt) that calls `onSync`. Retry is
        disabled with `accessibilityState={{ disabled: syncing }}` while `syncing`, like the button.
      - Or `syncErrorText(code)` for a refusal.
    - **Announcement.** The result text has `accessibilityRole="alert"`, which is the live region on web. It's also
      announced with `AccessibilityInfo.announceForAccessibility` for VoiceOver. Both are as in `LoadError`.
  - `apps/mobile/src/app/(tabs)/index.tsx` (slice 3) renders the panel under the grid, depending on the state:
    - `ready` → `<NotionSyncPanel …/>`.
    - `failed` → `<LoadError message="Couldn’t check Notion sync." onRetry={reload} />`.
    - `loading` and `unconfigured` → nothing.
- New dependencies: none.

## Slices

- [x] 1. Add the Notion sync DTOs and the status line text (~100 lines)
  - Files: `apps/mobile/src/api/types.ts`, `apps/mobile/src/format.ts`, `apps/mobile/src/data/notionSync.ts`,
    `apps/mobile/test/format.test.ts`, `apps/mobile/test/notionSync.test.ts`
  - Change: `NotionStatus`/`NotionSyncResult` mirrors, `kyivDayTime`, `shortMonthLabel` and `statusText`, as in
    Contracts.
  - Tests:
    - `format.test.ts` "formats a sync time as Kyiv day and clock". These were checked with Node in a non-Kyiv TZ:
      - `'2026-10-10T11:02:00.000Z'` → `'10 Oct, 14:02'` (UTC+3).
      - `'2026-01-05T08:07:00.000Z'` → `'5 Jan, 10:07'` (UTC+2, minute padded).
      - `'2026-12-31T22:05:00.000Z'` → `'1 Jan, 00:05'` (the day turns at Kyiv midnight).
      - `'2026-10-10T21:00:00.000Z'` → `'11 Oct, 00:00'`.
    - `format.test.ts` "short month labels": `'2027-01'` → `'Jan 2027'`, `'2026-09'` → `'Sep 2026'`.
    - `notionSync.test.ts` "status line": a table of `{5, '2026-10-10T11:02:00.000Z'}` →
      `'5 new · last synced 10 Oct, 14:02'`, `{1, null}` → `'1 new · not synced yet'`, `{0, null}` and
      `{0, <time>}` → `'Up to date'`.
- [x] 2. Add the Notion sync result and refusal texts (~90 lines)
  - Files: `apps/mobile/src/data/notionSync.ts`, `apps/mobile/test/notionSync.test.ts`
  - Change: `syncReport` (`done`, `failed`; `reasons` is always `[]` until slice 4) and `syncErrorText`, as in
    Contracts.
  - Tests (`notionSync.test.ts`, as a table):
    - `{3,1,1,[]}` + `{added:2}` → done `'Added 3 groceries, updated 1, removed 1 · added to 2 categories'`, failed
      `null`.
    - `{0,1,0}` + `null` → `'Updated 1 grocery'`.
    - `{0,0,2}` + `{added:0}` → `'Removed 2 groceries'`.
    - zeros + `{added:1}` → `'Added to 1 category'`.
    - all zeros, nothing failed → `'Nothing new to sync'`.
    - all zeros with 1 grocery failure → done `null`, failed `'1 couldn’t sync'`.
    - `{1,0,0}` with 1 grocery and 2 totals failures → `'Added 1 grocery'` and `'3 couldn’t sync'`.
    - `syncErrorText`: `sync_in_progress`, `totals_not_started`, `network` and an unknown `'internal'` each give the
      exact texts above.
- [x] 3. Show the Notion sync status and a Sync to Notion button on Home (~160 lines)
  - Files: `apps/mobile/src/data/useNotionSync.ts`, `apps/mobile/src/components/NotionSyncPanel.tsx`,
    `apps/mobile/src/app/(tabs)/index.tsx`
  - Change: the hook, the panel (status line, button, Syncing… state, the `done`/`failed` + Retry line, and refusal
    text) and the Home wiring, as in Contracts. Styles come from `makeStyles(colors)` + `useThemedStyles`, with no raw
    colours.
  - Verify: run `yarn typecheck`, `yarn lint` (including the `react-hooks/*` rules) and `yarn mobile test`. Then, in the
    in-app browser at 390×844 (launch configs `api` + `web`, or worktree Metro on `http://127.0.0.1:8084`), check:
    1. Sign in as a fresh `claude-qa-024` user, whose ledger isn't the synced one. The real API answers 404
       `notion_not_configured`, so there's no panel, and Home is otherwise unchanged.
    2. Use a console fetch-stub (scratch only, never in the repo). It wraps `window.fetch` so `…/notion/status` and
       `…/notion/sync` return canned answers:
       - status `{unsent:5,lastSyncedAt:'2026-10-10T11:02:00.000Z'}` → "5 new · last synced 10 Oct, 14:02" next to
         the button;
       - a sync delayed 3 s → "Syncing…", disabled, and a second click does nothing, and a Retry left over from an
         earlier failed result is disabled too;
       - a clean result → "Added 3 groceries, updated 1, removed 1 · added to 2 categories". The status refetches
         ("Up to date" when the stub says `unsent: 0`).
       - a result with failures → "2 couldn’t sync" + Retry, and Retry calls sync again;
       - 409 `sync_in_progress` → "A sync is already running…";
       - 409 `totals_not_started` → its text;
       - a rejected fetch → the connection text;
       - sync 404 `notion_not_configured` → the panel disappears;
       - status 500 → "Couldn’t check Notion sync." + Retry.
    3. Check it in both Light and Dark, with VoiceOver-style labels by DOM inspection (role button, label "Sync to
       Notion").
- [x] 4. List what couldn’t sync on Home, including missing Netto pages (~120 lines)
  - Files: `apps/mobile/src/data/notionSync.ts`, `apps/mobile/test/notionSync.test.ts`,
    `apps/mobile/src/components/NotionSyncPanel.tsx`
  - Change: `syncReport().reasons` (reason map, grouping `no_netto_page` by month, at most 5 lines plus 'and N more'),
    rendered as muted lines under the `failed` line.
  - Tests (`notionSync.test.ts`):
    - groceries `[{name:'Milk', date:'2026-10-06', error:'notion_unreachable'}]` and totals
      `[{fun,'2027-01',no_netto_page}, {car_parking,'2027-01',no_netto_page}, {fun,'2026-11',duplicate_rows}]` →
      failed `'4 couldn’t sync'` and reasons
      `['Milk, 6 Oct 2026: Notion couldn’t be reached', 'No Netto page for Jan 2027', 'Fun, Nov 2026: two rows for it in Notion']`.
    - `page_taken`, `sent_in_other_year`, `actual_amount_changed`, `rate_limited` and `internal` each give their exact
      reason. An unknown `validation_error` → `'Notion refused it (validation_error)'`.
    - 8 grocery failures → 5 reason lines + `'and 3 more'`. Exactly 5 failures → 5 lines and no "more" line.
    - "and N more" counts reason lines after grouping. 4 grocery failures plus `no_netto_page` for 3 categories in
      each of `'2027-01'` and `'2027-02'` is 10 entries and 6 reason lines. That gives `'10 couldn’t sync'`, 5 lines
      and `'and 1 more'`.
  - Verify: stub a sync answer with the failures above, plus 8-failure and `no_netto_page`-for-two-months answers, at
    390×844. All reasons are readable, nothing is clipped under the tab bar, and Retry is still reachable. Check Light
    and Dark. Then the iPhone checks (Expo Go), done by the user at Gate B:
    - the panel is hidden as `claude-qa-024`;
    - as `dimuch`, the status line shows the real count and a correct Kyiv time;
    - press Sync only when it says "Up to date", which makes no Notion writes, or with the user's explicit OK. That
      gives "Nothing new to sync".

## AC → evidence

| AC                                                                                      | Evidence                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [6c] Unconfigured or non-synced ledger hides the button                                 | Slice 3 web check 1: real API, `claude-qa-024` ledger, no panel. Check 2: a stubbed sync 404 `notion_not_configured` hides it. iPhone check as `claude-qa-024` (slice 4).                                                         |
| [10] Button and status on Home                                                          | `notionSync.test.ts` "status line" and `format.test.ts` "formats a sync time as Kyiv day and clock" (slice 1); slice 3 web check at 390×844 in Light and Dark; iPhone check as `dimuch` (slice 4).                                |
| [10] Result text ("Added 3 groceries, … · added to 2 categories")                       | `notionSync.test.ts` `syncReport` done cases (slice 2); slice 3 stubbed clean result.                                                                                                                                             |
| [10] Errors: "2 couldn’t sync · Retry" with reasons, incl. "No Netto page for Jan 2027" | `notionSync.test.ts` failed count (slice 2) and reasons (slice 4); slice 3 Retry check and slice 4 reasons check (stubs).                                                                                                         |
| [10] A second press is refused and the app says a sync is running                       | `syncErrorText('sync_in_progress')` test (slice 2). Slice 3: stubbed 409 shows the text, and a delayed sync shows "Syncing…" with the button disabled. The API's refusal itself is already covered by `notion.int.test.ts` (021). |
| Token only in the API                                                                   | No app change touches it. The app calls only `/api/…` through `api()`, and `rg -n -i "notion_token\|ntn_" apps/mobile` is empty (checked at review).                                                                              |
| [11] Gates                                                                              | `yarn format:check && yarn lint && yarn typecheck && yarn test` green on every slice; recorded in the PR test plan.                                                                                                               |

## Not doing (YAGNI)

- No API, migration or env change (brief: out of scope). The `notion_not_configured` for a missing token is handled in
  the app by hiding the panel.
- No automatic or scheduled sync, and no sync on focus. Focus only refreshes the status.
- No category display names in totals reasons. The API sends tech_names, and looking up the categories just for this
  isn't needed.
- No ScrollView around Home. The reasons are capped at 5 lines instead.
- No README change. The README's Notion section stays true, since it describes the endpoints the button calls.
- No shared Notion types package. The DTOs are mirrored by hand (conventions §1).
- No unmount guard around `sync()`'s state updates. React 19 ignores them harmlessly, and Home stays mounted in the tab
  navigator. The status load does keep the `live` guard.

## Risks

- **Hermes `Intl` on iPhone** could ignore `hourCycle` or the `Europe/Kyiv` zone and show a wrong "last synced" time.
  `kyivFormat` already falls back to `Europe/Kiev`, and the hour is taken `% 24`. Slice 4's iPhone check of a real
  `lastSyncedAt` proves or disproves it.
- **Long syncs vs a proxy timeout.** The sync answers only when the run is done. In production, nginx (config not in
  the repo) may cut a long first sync with a 504. The app would then say "Couldn’t sync. Try again." The items Notion
  accepted are recorded, so a retry continues. It's not provable locally. Listed under Follow-ups.
- **React Compiler lint** could reject the hook's state handling. Slice 3 copies `useMonth`'s tagged-state pattern, and
  slice 3's `yarn lint` proves it.
- **Home overflow at 390×844.** Home has no ScrollView, so a result with many reasons could be clipped under the tab
  bar. Slice 4's 8-failure stub check proves the cap is enough.
- **Status 200 but sync 404.** With a scope but no token, status answers 200 and sync answers 404, so the panel would
  appear and then hide on press. Slice 3's stub check proves the hide. That configuration is a half-done setup, not a
  normal one.

## Open questions

- **No.** The plan is about 470 lines, over the ~400 target, and more than half of that is tests. I'm not proposing a
  split. Shipping the reasons (slice 4) as a separate PR would leave Home with a "couldn’t sync" count and no reasons,
  and AC [10] asks for both. Each slice still ships alone. Assumed one PR. The PR body states the size and this
  reason.
- **No.** Times are shown in Kyiv time, like every date in the app (conventions §3), not in the device's zone.
  Assumed so.
- **No.** "Up to date" is shown whenever `unsent` is 0, without the last-sync time, as in the brief's example. With
  `unsent > 0` and no sync yet, it shows "5 new · not synced yet". Assumed so.
- **No.** "added to N categories" uses `totals.added`, which counts category-month adds. A category with new expenses
  in two months counts twice. It keeps the brief's wording. Assumed so.
- **No.** "N couldn’t sync" counts the API's failed entries. A month without a Netto page that holds 3 categories
  counts 3, but shows one reason line. Assumed so.
- **Decided (user, 2026-10-13, Gate A).** If the status can't be loaded, Home shows "Couldn’t check Notion sync."
  with Retry, for every ledger. The app can't tell a configured ledger from an unconfigured one without an answer
  (conventions §5: error with retry). Hiding the panel silently was the alternative.
- **No.** `actual_amount_changed` is listed among the "couldn’t sync" items, as the API reports it, even though that add
  isn't retried. Assumed so.
- **No.** Verification uses fetch stubs on web for the configured states. The local `apps/api/.env` points ledger 1 at
  the real Budget ’26 page, so a real press as `dimuch` is done only when the status says "Up to date" (no Notion
  writes) or with the user's explicit OK.

## Follow-ups

- Production proxy timeout for long syncs (see Risks). Check `proxy_read_timeout` on the droplet before the first big
  real sync.

## Deviations

<filled by the developer during build>

## Revision 1

The skeptic's verdict was APPROVE WITH EDITS, with no blockers.

Required edits:

- **#10:** after a sync 404 `notion_not_configured`, the hook stays `unconfigured` while mounted and doesn't reload.
  With a scope but no token, status answers 200, so a reload would bring the panel back.
- **#1:** Retry is disabled while `syncing`, like the button. The slice 3 delayed-sync check covers it.

Suggestions, all five applied:

- a `useRef` in-flight guard in `sync()` against a fast double tap;
- "and N more" counts reason lines after grouping, with a slice 4 test case for it;
- `accessibilityRole="alert"` on the result text as the web live region;
- `outcome` stays until the next press and isn't cleared on refocus;
- the PR body states the ~470-line size.
