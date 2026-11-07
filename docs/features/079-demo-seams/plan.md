# Plan: Keep production-only logic out of the shared screens

Status: approved
Brief: ./brief.md
Branch: chore/demo-seams
Base: origin/main (a70dd47)

## Approach

Four moves in `apps/mobile/src`, no behaviour change: `ApiError` gets its own file; a new tab items module is the only
thing `TabBar` and the tabs layout read; the Home card grid becomes a component that takes its cards as props; the app
shell becomes one component. Characterization tests go first, then moves, then extractions. No demo code, flavour check
or build setting.

`readTabs` is the awkward part. It needs the tab names, `tabs.ts` lists all six (with the text `Statistics`, which brief
080 bans from the demo bundle), and `test/tabs.test.ts` calls it with two arguments, which brief 079's first AC protects.
So the logic moves to `tabRoutes.ts` as `readTabRoutes(routes, fallback, tabNames)`, holding no list, and `tabs.ts` keeps
a two-argument `readTabs` bound to its own list. `data/tabItems` exports `readTabs`, so a swap of that one module replaces
the list, the reader's names and the invites together. `tabs.ts` and `data/invites` then drop out of the shared graph.

`ApiError`: no re-export from `api/client`. Every importer changes its import, and `test/client.test.ts` gets the same
one-line change, which the AC allows. A re-export would be a second path with no production caller, and each swapped
client would have to repeat it.

`AppShell` and `HomeCards` have one caller until 080. The brief asks for both by name, so they stay.

`tabRoutes.ts` also has one caller until 080. The brief doesn't name it; it serves the Why line '`tabs.ts` lists all six tabs', since otherwise the demo's module must copy the reader or pull in `Statistics`.

Alternatives considered:

- Add a `tabNames` argument to `readTabs` itself: smaller, but it edits six test calls, which breaks the first AC.
- Leave the reader split (slice 4) to 080: saves ~86 lines here, but puts a behaviour-preserving move inside a feature
  PR, or leaves the demo's module with a copy of the reader. Kept here, where the proof belongs.
- Make `tabs.ts` itself the swapped module: it would import invites, so `test/tabs.test.ts` could no longer load it in
  Node without new mocks.

Every slice below was built in a scratch copy on the Base (not in the repo). `tsc`, `eslint src test`, Prettier and the
app's Vitest all passed, and the line counts are from that copy.

## Contracts

- DB: none
- API: none
- App:
  - `src/api/apiError.ts`: `ApiError`, moved word for word. `api/client.ts` imports it and no longer exports it.
  - `src/data/notionSync.ts`: gains `export type SyncOutcome`, moved from `data/useNotionSync.ts`.
  - `src/tabRoutes.ts` (new; no tab list, no invites): `type StackRoutes` and
    `readTabRoutes<Name extends string>(routes: StackRoutes, fallback: Name, tabNames: readonly Name[]): { active: Name; params: Partial<Record<Name, Record<string, string>>> }`.
  - `src/tabs.ts`: keeps `TabName`, `TABS`, `tabBadge` and `readTabs(routes, fallback)` with today's signature.
    `StackRoutes` moves out.
  - `src/data/tabItems.ts` (new; the swap target): `useTabItems(): { tabs: TabItem[]; onTabFocus: () => void }`,
    `type TabItem = (typeof TABS)[number] & { badge: number | undefined; label: string }`, and
    `export { readTabs, type TabName } from '@/tabs'`. The only tab-side importer of `data/invites`. `onTabFocus` is the
    same `reload` reference the layout passes today.
  - `src/components/HomeCards.tsx` (new): `HomeCards({ cards }: { cards: readonly HomeCard[] })`, with
    `HomeCard = { title: string; href: Href; icon: IconName; figure: string | null; failed: boolean }`.
  - `src/components/AppShell.tsx` (new): `AppShell({ children }: { children: ReactNode })`.
  - What 080 swaps, one module each: `@/api/client`, `@/auth/AuthContext`, `@/data/tabItems`. The session swap needs no
    change here: shared screens import only `useSession` from it.
- Reuses: `tabBadge`, `TABS`, `useInvites`, `PhoneColumn`, `FocusStyles`, `AppearanceProvider`, `Pressable`, `Icon`
- New dependencies: none

## Version

Bump: patch — 1.2.0 → 1.2.1
Why: conventions §8b, "a refactor that touches shipped code is `patch`, never `none`". Every slice is a behaviour-preserving
change to the shipped app, with no new capability and no API, schema or MCP change.

## Slices

Sizes are insertions + deletions. Every slice ends with `yarn format:check && yarn lint && yarn typecheck && yarn test`
green, run on their own (not piped), with the test count the same or higher, and
`.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh --diff origin/main` clean.

**Web check setup** (slices 2, 5, 7, 8). Launch configs `api` and `web`; confirm each server's cwd is this worktree with
`lsof -a -p <pid> -d cwd`. Only `web` must run from this worktree. The API is unchanged here, so reuse the main checkout's, or start it with `--env-file=<main checkout>/apps/api/.env`. Run `yarn api create-user --username claude-qa-079a --email claude-qa-079a@example.test` the same way (C adds `--join claude-qa-079a`). Export `DATABASE_URL_TEST` from that file before `yarn test`, or the integration tests skip. Window 390×844, with
`document.hasFocus()` true. Create `claude-qa-079a`, `claude-qa-079b` and `claude-qa-079c --join claude-qa-079a` with
`yarn api create-user`, give B's ledger this month's income, a category and an expense, and delete all three afterwards.
**Before slice 2, run every check on the Base and note the labels and figures**, so "as before" means something to
compare with.

Fetch stub: load `/budget`, so Home isn't mounted yet, replace `window.fetch` in the console to answer the named paths,
then tap Home. A reload clears it. **Don't set `NOTION_LEDGER_ID` on the API to bring the panel up**: the main checkout's
`apps/api/.env` holds a real `NOTION_TOKEN`, so a Sync press would send QA data to the real Notion tables. The panel is
checked through the stub only.

- [x] 0. Bump version to 1.2.1
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.2.1
- [x] 1. Pin the tab list and what ApiError carries (58 lines)
  - Files: apps/mobile/test/tabList.test.ts, apps/mobile/test/apiError.test.ts (both new)
  - Change: characterization tests only, passing on the Base. New files, so no existing test is touched.
  - Tests: `tabList.test.ts`, describe `TABS`: "lists the six tabs in bar order, with their titles, icons and links";
    "reads %s as a tab" for all six names; "puts the invite count on Settings alone". `apiError.test.ts`, through `api()`
    with stubbed `fetch` (mocks as in `client.test.ts`): "carries the status, the code and the whole body, which
    over_income reads" (409, `overEur`, message `409 over_income`); "reads a body that is not JSON as code unknown" (502,
    `body: {}`). +10 tests.
  - Proof they bite, each tried and failing in the scratch copy; restore after each so `git diff` shows only tests:
    drop the `statistics` row; change `'settings'` in `tabBadge` to `'budget'`; make `isTab` true only for `index`; drop
    the third argument of `throw new ApiError(...)`; change `super(...)` to `super(code)`; change `?? 'unknown'`.
  - Home, `TabBar`, both layouts: no test possible (Node-only, no component tests), so their proof is the web checks.
- [x] 2. Move ApiError to its own file (52 lines, mechanical, 15 files)
  - Files: new `src/api/apiError.ts`; `src/api/client.ts`; `src/data/invites.tsx`, `src/data/useNotionSync.ts` (split the
    import); one-line import change in `src/app/{delete-category,login,members,income-item,expense}.tsx`,
    `src/app/(tabs)/{income,budget}.tsx`, `src/components/{CategoryForm,CategoryInMonth}.tsx`;
    `test/client.test.ts`, `test/apiError.test.ts` (import lines only).
  - Change: move the class with its comment; nothing else.
  - Tests: `client.test.ts` "rejects with its code, so a screen shows its load error" (same class on both sides of
    `instanceof`); `apiError.test.ts` both cases.
  - Verify (web): sign in with a wrong code → "Wrong username or password."; on Budget, add a category with a name the
    month already has → the same name refusal as the Base, not "Couldn’t save. Check your connection and try again."
- [x] 3. Keep the Notion outcome type with the Notion text (8 lines, mechanical)
  - Files: `src/data/notionSync.ts`, `src/data/useNotionSync.ts`, `src/components/NotionSyncPanel.tsx`
  - Change: move `SyncOutcome`, so `components/` has no import of `useNotionSync`, even a type-only one.
  - Tests: `notionSync.test.ts` unchanged. Type-only, nothing reaches the bundle; `yarn typecheck` is the proof.
- [x] 4. Read the tab routes without the tab list (86 lines, extract)
  - Files: new `src/tabRoutes.ts`; `src/tabs.ts`; `test/tabs.test.ts` (import line for `StackRoutes` only)
  - Change: move `StackRoutes` and the reader with its doc comment; `isTab` becomes a local closure over `tabNames`;
    `tabs.ts` keeps `readTabs(routes, fallback)` calling `readTabRoutes` with `TABS`' names.
  - Tests: every `describe('readTabs')` case in `tabs.test.ts`, unedited; `tabList.test.ts` "reads %s as a tab".
  - Verify: no web check; `TabBar` still calls the same `readTabs`, and slice 5 walks it.
- [x] 5. Give the tab bars one module for their tabs and badges (70 lines, extract)
  - Files: new `src/data/tabItems.ts`; `src/components/TabBar.tsx`; `src/app/(tabs)/_layout.tsx`; new
    `test/tabItems.test.ts`
  - Change: add `useTabItems`. In both consumers `TABS.map` becomes `tabs.map` with `tab` kept as the name,
    `const { badge, label } = tab`, and `TABS.length` becomes `tabs.length`, so the hunks stay small.
    `screenListeners={{ focus: onTabFocus }}`. The "Every tab tap…" comment moves with `reload` to `data/tabItems.ts`.
  - Tests: `tabItems.test.ts`, with `@/data/invites` mocked (`useTabItems` calls no React hook of its own, so it runs as a
    plain function in Node): "with invites %s, keeps the six tabs and puts the badge on Settings" for not loaded, none,
    one, two; "runs the invites reload itself when a tab gains focus". +5 tests. Both bite in the scratch copy: wrapping
    `reload` and changing `?? 0` each fail one.
  - Verify (web), signed in as B:
    - Six tabs in order Home, Income, Budget, Expenses, Statistics, Settings, each opening its page; no badge at 0 invites.
    - From A's Members page invite B. Tap any tab as B, with no reload: `GET /api/invites` fires and Settings shows `1`,
      with aria-label `Settings, 1 invite`.
    - Return from a pushed page also fires `GET /api/invites`.
    - Budget, go to last month, then open the Expenses tab and a category: the pushed-page bar shows the same six tabs and the same badge; Expenses is active (`aria-selected`); tapping Budget returns on last month. Open the same page by URL: `expenses` is active.
    - Decline the invite on Home: the badge goes at once, and Settings' list empties.
    - Console has no errors.
- [x] 6. Name Home's card variable (16 lines, rename only)
  - Files: `src/app/(tabs)/index.tsx`
  - Change: `(c)` → `(card)` in the grid, ahead of the move, so the extract is a pure move and adds no single-letter name.
  - Tests: typecheck and lint; `find-short-names.sh 'apps/mobile/src/app/(tabs)/index.tsx'` exits 0.
- [x] 7. Make Home's card grid a component (101 lines, extract)
  - Files: new `src/components/HomeCards.tsx`; `src/app/(tabs)/index.tsx`
  - Change: move the grid JSX and its `grid`, `card`, `cardTitle`, `figure` styles (comment included) as they are. Home
    keeps the `cards` array, invites, Notion panel and Undo toast, and renders `<HomeCards cards={cards} />` in the same
    place. Drops `useColors`, `router`, `Href`, `Icon` and `Pressable` from Home.
  - Tests: none reach it; typecheck proves the props.
  - Verify (web), signed in as B:
    - Five cards, two per row, the last one full width; figures match the Base. Aria-labels are `Income, <figure>`,
      `Budget, <figure>`, `Expenses, <figure>`, `Statistics, <n expenses>`, `Settings, claude-qa-079b`. Each card opens its
      page.
    - With the fetch stub answering `/categories?month=` with `{ "categories": [] }` and `/income` with `{ "items": [] }`: `Not set` on Income and Budget.
    - Failed, with the fetch stub rejecting `/expenses?month=`, `/categories?month=` and `/income`: `—` in muted colour and
      labels `Income, not available` and so on, Settings still with its username.
    - Loading, with the stub never resolving those paths: `—` and labels `Income, loading`.
    - Pending invite card shows above the grid, and Accept and Decline work.
    - Notion, with the stub answering `/notion/status` with `{ "unsent": 5, "lastSyncedAt": null }`: the panel shows below
      the grid with `5 new · not synced yet`. With `/notion/sync` answering 409 `{ "error": "sync_in_progress" }`, Sync
      shows the same refusal as the Base. With `/notion/status` answering 500: `Couldn’t check Notion sync.` and Retry.
      With no stub (404 `notion_not_configured`): no panel.
    - Open `/expense?expenseId=<id>` by URL and press Delete: it lands on Home, the Undo toast shows, and Undo updates the figures.
    - Light and Dark (Settings): card colours follow with no reload.
- [x] 8. Put the app shell in one component (99 lines, extract)
  - Files: new `src/components/AppShell.tsx`; `src/app/_layout.tsx`
  - Change: move `Root` as it is (name included), and add `AppShell` as `AppearanceProvider` around it, with `children`
    where `AuthProvider` was. `RootLayout` becomes `AppShell` > `AuthProvider` > `InvitesProvider` > `Screens`; `Screens`
    and its comment don't change. `StatusBar` goes first in `PhoneColumn`, just outside `AuthProvider`, the one position
    change in the plan.
  - Tests: none reach it; typecheck.
  - Verify (web):
    - Signed out: `/` lands on login, in the right fonts. Sign in as B: Home, spinner in between.
    - Sign out from Settings: back on login; a pushed-page URL while signed out also lands on login.
    - Sign in as C, and have A remove C on Members: C's next request lands on no-ledger, with Sign out working.
    - Window at 1280 wide: the column stays centred at phone width, the page background fills the sides.
    - Keyboard Tab shows the focus ring (`FocusStyles`). Light and Dark both apply, also after a reload.
    - Console has no errors.
  - Verify (iPhone, for the user to confirm, not claimable from web): status bar text follows Light and Dark, safe areas
    are unchanged, and VoiceOver reads `Settings, 1 invite, tab, 6 of 6` on a pushed page.

## AC → evidence

| AC                                                       | Evidence                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gates pass, no test changed apart from import paths      | Gates on every slice. `git diff origin/main -- apps/mobile/test/client.test.ts apps/mobile/test/tabs.test.ts` shows only `import` lines. App tests go 217 → 232, API tests stay as on the Base; integration tests must have run                                                                                    |
| Home, tabs, badge, Notion panel, sign in/out as before   | Web checks in slices 5, 7, 8 against the notes taken on the Base; iPhone check in slice 8                                                                                                                                                                                                                          |
| No imports left in `components/` and shared screens      | `rg -n "data/invites" apps/mobile/src` lists only `data/tabItems.ts`, `app/(tabs)/index.tsx`, and the three in the first open question. `rg -n "from '@/data/useNotionSync'" apps/mobile/src` lists only `app/(tabs)/index.tsx`. `rg -n "api/client" apps/mobile/src/components apps/mobile/src/app` lists nothing |
| Home cards as props                                      | Slice 7: `HomeCards` takes `cards`; Home keeps its cards, invites and Notion panel                                                                                                                                                                                                                                 |
| One tab items module; `TabBar` and layout read only it   | Slice 5: `rg -n "@/tabs'" apps/mobile/src` lists only `data/tabItems.ts`; `tabItems.test.ts`                                                                                                                                                                                                                       |
| Tab reader free of the list                              | Slice 4: `rg -n "TABS\|Statistics" apps/mobile/src/tabRoutes.ts` lists nothing; `tabs.test.ts` unedited apart from its import.                                                                                                                                                                                     |
| App shell is one component; sign-in stays in root layout | Slice 8: `Screens` diff is empty; web checks                                                                                                                                                                                                                                                                       |
| `ApiError` in its own file                               | Slice 2: `rg -n "ApiError.*api/client" apps/mobile` lists nothing; `apiError.test.ts`                                                                                                                                                                                                                              |
| Behaviour unchanged (refactoring §6)                     | Slice 1 tests pass on the Base and after every slice; the per-slice proofs                                                                                                                                                                                                                                         |

## Not doing (YAGNI)

- Anything for the demo: no `src/demo/`, `app.config.js`, `metro.config.js`, flavour check or launch config.
- A re-export of `ApiError` or `StackRoutes` for old import paths.
- Moving Home's card figures out of the screen; they don't move here, so 080 extracts them if it repeats them.
- Removing `useInvites` from Settings, no-ledger or the root layout; each really needs it.
- Replacing the remaining `api` imports in `data/`. They're meant to stay: 080 swaps that specifier.
- Other cleanups in these files, including single-letter names in `data/useMonth.ts` and `data/useNotionSync.ts`.
- A component test setup.

## Risks

- `StatusBar` moves out of `AuthProvider`. Low: `AuthProvider` always renders its children and `StatusBar` renders `null`
  on web, so no DOM changes — disproven on web by slice 8; native is the iPhone check in the same slice.
- Home or shell regressions have no automated test, so the web checks are the only guard. That's why the Base is walked
  first and the moves stay word for word; review with `git diff --color-moved`.
- The generic reader might not fit `TabName`, or React Compiler lint might refuse the hook — disproven by the scratch
  build; slices 4 and 5 confirm it on the branch.
- A shared screen might still reach production-only code some other way — disproven by slice 5. A static import walk of
  the eight shared screens plus `TabBar` in the scratch copy, stopping at the three swaps, reached no invites, Notion,
  members, `LedgerPicker` or `tabs.ts` module, and no `Statistics`, `notion` or `/api/auth/login` text. On the Base the
  only leaks were `TabBar` → `data/invites` and `tabs.ts`. This was a regex walk, not a build; 080's export is the real
  test.
- The shared test DB can fail on a migration race when two runs overlap, as in the baseline. Check `ps` for vitest and
  rerun; a real failure repeats.

## Open questions

- Blocking: no — AC3 and "Invites are imported only by that module" read literally would also cover
  `app/(tabs)/settings.tsx`, `app/no-ledger.tsx` and `app/_layout.tsx`, which keep importing `data/invites`. Settings and
  no-ledger list the invites and the root layout holds their provider, so they can't drop it without a change in behaviour
  or a pointless wrapper. Assumption: "shared screens" means the ones 080 re-exports, and these three are production-only
  (080 gives them no route or its own layout).
- Blocking: no — the PR is ~470 changed lines by diffstat (+310/−162), over the ~400 target. About 120 of the deletions
  are the old side of moves, so ~350 lines are new to read, and no slice is over 101. Assumption: one PR, since splitting
  would cost a second bump and review for code that only makes sense together. Slice 4 could go to 080 if you'd rather
  be under the target (see Approach).
- Blocking: no — AC3 is read as covering type-only imports too, so slice 3 moves `SyncOutcome`. If not, slice 3 can go.

## Follow-ups

- 080's own Home needs the Income, Budget and Expenses figures that stay in production Home here. That's the second copy
  of pure logic in a screen, so 080 should move them to `data/` (refactoring §8) rather than repeat them.
- 080's demo `readTabs` should type its names as `TabName` so the module fits `typeof import('@/data/tabItems')`.

## Deviations

- Rebased twice as main moved (conventions §8b): base d2e321c, then a70dd47, so the bump is 1.2.0 → 1.2.1.
- Slice 5: the Budget-on-last-month check ran with a category of this month, since a fresh ledger has no list last month.

## Consolidate
