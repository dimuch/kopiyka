# Plan: Move the app to Expo SDK 58

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/expo-sdk-58
Base: origin/main (8d94237)

## Approach

Run the official upgrade (`npx expo install expo@~58.0.23 --fix`) in `apps/mobile`, then make the few changes it forces.
A throwaway copy of the Base was upgraded on 2026-11-07 to find them (see Findings). Only one line fails to compile, the
`useRef<TextInput>` in `CategoryForm.tsx`. Two config or layout changes keep behaviour the same: `asyncRoutes: { web: false }`
(decided in the brief) and an explicit `redirectTo` on the root layout's three `Stack.Protected` groups.

`asyncRoutes` lands before the bump, where it changes nothing, so no commit ever splits the web bundle. The dependency bump,
the ref type and `redirectTo` must be one commit (see slice 2). No screen, API or MCP code changes.

Alternative considered: a preparatory commit with `useRef<ComponentRef<typeof TextInput>>`, which compiles on both SDKs, so
the bump could be separate. It lost because it leaves a wordier type than RN's documented `TextInputInstance` only to split
off a two-line fix, and `redirectTo` would still have to ride with the bump.

## Findings from the scratch run

Measured on a copy of 8d94237 outside the repo, with the user's Yarn age gate active and install scripts off, as on the droplet.

| Check                                                      | SDK 57                  | SDK 58                                                              |
| ---------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| Age gate during install                                    | n/a                     | nothing quarantined                                                 |
| `expo-doctor` (20 checks), `expo install --check`          | n/a                     | pass                                                                |
| Typecheck after the bump alone                             | pass                    | 2 errors, both the `CategoryForm.tsx` ref                           |
| Format, lint, typecheck, tests with the fixes              | n/a                     | pass after Prettier wraps one import; API int tests skipped (no DB) |
| `yarn install --immutable` after the bump                  | pass                    | pass                                                                |
| Web export, cold, `--max-workers 1`, 700 MB heap: peak RSS | 511 MB                  | 564 MB (macOS figure)                                               |
| JS files in the web export                                 | 1 (1.36 MB)             | 1 (1.39 MB) with `asyncRoutes`; 19 without                          |
| `index.html`                                               | one deferred script     | same; no inline script added                                        |
| Bundle path                                                | `/_expo/static/js/web/` | same                                                                |
| `expo export -p ios`                                       | n/a                     | pass, so the imports resolve for native                             |

Headless Chrome at 390 px ran each export with the production CSP header and a stub API: 17 cold loads, then ledger removed,
401 and sign-in. A shorter run added `/_sitemap` probes and a deep link followed by sign-in, and repeated on a dev-mode SDK 58
build:

- Every row landed on the same screen on both SDKs, and on the dev-mode build. No CSP violation was logged.
- One difference: on SDK 58, with no `redirectTo`, a signed-out deep link keeps its params: `/category/1` →
  `/login?categoryId=1`, then `/?categoryId=1` after sign-in. SDK 57 gave `/login` and `/`. `noLedger` deep links do the same.
  With `redirectTo`, SDK 58's results were identical to SDK 57's on every row of both runs.

Not covered by that run: the stub returns no real data, so tab dimming, modals, a pushed page's tab bar and month params
were not exercised. Nothing ran on a device. Slices 2 and 4 cover these.

Checked and needing no work:

- **Web modals.** The removed implementation was opt-in through `EXPO_UNSTABLE_WEB_MODAL`, which this repo doesn't set, and
  it isn't in the SDK 57 bundle. `presentation: 'modal'` was already a plain stack screen on web.
- **`TabBar` metrics.** Bar height 49, icon box 31×28, icon 25, badge 0.75 and its offsets are the same in expo-router 58.
  Only the comment naming the version changes.
- **`PlatformPressable`, `useNavigationState`, `expo-router/js-tabs`, `dismissTo`.** All compile and bundle. Their running
  behaviour is the check in slice 2.
- **`NODE_ENV` change.** The repo has no `.env.production`, and the web build doesn't read `EXPO_PUBLIC_API_URL`.
- **`customConditions`.** `expo/tsconfig.base` has `["react-native"]` only, so the strict types are on with no opt-out.

## Contracts

- DB: none
- API: none
- App: no props, hooks or routes change. `Stack.Protected` gains `redirectTo` in `apps/mobile/src/app/_layout.tsx`.
- Reuses: the existing `TextField`, `Stack.Protected` and `expo-router` config plugin; nothing new is written.
- New dependencies: none. Existing packages move to the SDK 58 versions, including `@types/react` and `@types/react-dom`
  `~19.3.0`. `typescript` stays `~6.0.3`.

## Version

Bump: patch — 1.2.1 → 1.2.2
Why: conventions §8b, "A framework or SDK upgrade is `patch` unless the product behaves differently", and the `patch` row's
"dependency update". No migration, API or MCP change, and rollback is unaffected.

## Slices

Before starting: the working copy has no `node_modules`, so run `yarn install --immutable`. Before each commit run the gates
with exit codes checked and not piped, with integration tests on:

```bash
yarn format:check && yarn lint && yarn typecheck && \
DATABASE_URL_TEST="$(grep '^DATABASE_URL_TEST=' /Users/dmytro.kostylov/home/kopiyka/apps/api/.env | cut -d= -f2-)" yarn test
```

Report "integration ran: yes". A mass of "table doesn't exist" failures means another session is using the shared test
database, not that this change broke something.

- [x] 0. Bump version to 1.2.2
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.2.2
- [x] 1. Keep the web app in one bundle
  - Files: apps/mobile/app.json (~10 lines)
  - Change: replace the plugin entry `"expo-router"` with `["expo-router", { "asyncRoutes": { "web": false } }]`. SDK 57
    accepts the option and still exports one bundle, so nothing changes yet.
  - Verify: `yarn mobile expo export -p web --max-workers 1 --clear` writes exactly one file under
    `apps/mobile/dist/_expo/static/js/web/`.
- [ ] 2. Move the app to Expo SDK 58
  - Why one commit: `useRef<TextInput>` fails on SDK 58 (TS2339, TS2322), `TextInputInstance` doesn't exist in SDK 57's types
    (TS2694), and `Stack.Protected` has no `redirectTo` in expo-router 57. So the ref fix can't come first or later and stay green. `redirectTo` could follow as its own commit, but it stays here so that no commit changes URLs.
  - Files: apps/mobile/package.json, yarn.lock (generated, ~2,350 lines), apps/mobile/app.json,
    apps/mobile/src/components/CategoryForm.tsx, apps/mobile/src/app/\_layout.tsx, apps/mobile/src/components/TabBar.tsx
    (~50 hand-reviewed lines)
  - Change:
    - In `apps/mobile`, run `npx expo install "expo@~58.0.23" --fix`, then confirm `expo` reads `~58.0.23`. Expected results:
      `react`/`react-dom` 19.3.0, `react-native` 0.88.1, `expo-router` ~58.0.30. Keep the `expo-status-bar` plugin entry the
      tool adds to `app.json`; it takes no options here.
    - `CategoryForm.tsx`: `useRef<TextInputInstance>(null)`, importing `type TextInputInstance` in place of `TextInput`, which
      nothing else in the file uses. Run `yarn format`: the import passes 120 columns.
    - `_layout.tsx`: add the line below, and `redirectTo={landing}` on all three `Stack.Protected`. A failed guard always wants
      the current state's home, so one value serves all three. Keep a why-comment: the library would otherwise pick the route
      and carry the old URL's params along.
      `const landing = signedIn ? '/' : state.status === 'noLedger' ? '/no-ledger' : '/login';`
    - `TabBar.tsx`: change "expo-router 57" to "expo-router 58" in the comment. The metrics were rechecked and hold.
  - If the age gate quarantines a version: wait out the 24 hours. Never bypass it.
  - Verify:
    - `npx expo-doctor` and `npx expo install --check` pass from `apps/mobile`.
    - `rg -n "customConditions|@ts-ignore|legacy-deep-imports" apps/mobile --glob '!node_modules'` finds nothing new.
    - Compare `yarn install`'s "lists build scripts" lines with the `deploy.sh` comment that names esbuild and unrs-resolver.
      If the list differs, update that comment in this commit.
    - Export as `deploy.sh` does, cold:
      `NODE_OPTIONS=--max-old-space-size=700 /usr/bin/time -l yarn mobile expo export -p web --max-workers 1 --clear`. Expect one
      JS file and the same `index.html` structure. Compare the peak RSS with the 564 MB in Findings: 700 MB caps the heap, not RSS.
    - Web check, in slice 2's real-data list below.
- [ ] 3. Record SDK 58 in the conventions and docs
  - Files: .claude/skills/kopiyka-conventions/SKILL.md, .claude/skills/kopiyka-plan/SKILL.md,
    .claude/agents/kopiyka-plan-skeptic.md, README.md, deploy/README.md (~7 lines)
  - Change: conventions §5 heading to `Expo SDK 58, React 19, RN 0.88` and its docs link to `v58.0.0`. "SDK 57 docs" to "SDK
    58 docs" at `kopiyka-plan` checklist item 8 and in the skeptic's step 1. `README.md` "Needs Node 24" to "Node 24.3 or
    newer". `deploy/README.md` step 1 comment `# v24.x` to `# v24.3 or newer`.
  - Verify: `rg -n "SDK 57|v57\.0\.0|RN 0\.86" .claude/agents .claude/skills/kopiyka-* README.md` finds no current-version
    claim left. Gates pass.
- [ ] 4. No commit: the iPhone check, by the user (see below)

**Slice 2 web check, real data.** Start the API, then Metro from this working copy without `CI=1` (`CI=1` turns off file
watching): `yarn mobile expo start --web --port 8084`. Open exactly `http://127.0.0.1:8084`, which CORS allows; `localhost:8084`
fails. Use a phone-width window, and check `document.hasFocus()` first, since an unfocused pane fakes animation and focus bugs.

First do slice 4's preparation steps 2-3. Sign in as `claude-qa-084`. Check 3 must leave at least one category and one expense in the current month, because checks 4 and 6 and slice 4 steps 4-5 need them.

1. Sign in lands on `/`. Sign out lands on `/login`. Signed out, `/category/1` lands on `/login` with no `categoryId`, and sign-in from there lands on `/`.
2. Each tab dims on press and switches.
3. `category-form`, `delete-category` and `income-item` open, save and close.
4. Budget: go to the previous month. Switch to Expenses and open a category (current month). On the pushed page, Expenses is the active tab. Tap Budget in its bar: Budget shows the previous month. This exercises `readTabRoutes` on real navigation state.
5. Change month with the switcher (`setParams`), on Budget and on Income.
6. Reload on `/category/<id>`, then tap a tab: with no tabs underneath, it still opens that tab. Reload on `/expense` and `/members`. Paste a deep link into a new tab.
7. The tab bar on a pushed page has the same height as on a tab page (web safe area).
8. As `claude-qa-084b`, open Expenses, then a category. The developer removes that user as owner, with `DELETE /api/ledgers/<id>/members/<userId>` or from Members in a second browser profile. Then tap Add expense. Its categories read returns 404 `ledger_not_found`, and the app lands on `no-ledger`. API log: the DELETE 2xx, the 404, then `GET /api/ledgers`. On iPhone, a swipe back doesn't reveal the old page. Then sign out from no-ledger: it lands on `/login`.

**Slice 4, iPhone check.** One instruction per message, waiting for the result each time. Preparation, by the developer:

1. Copy `/Users/dmytro.kostylov/home/kopiyka/apps/mobile/.env` to `apps/mobile/.env` in this working copy (git-ignored), and
   confirm its address is the Mac's current LAN address.
2. Confirm which checkout's API is on port 3000 (`lsof -a -p <pid> -d cwd`) and that it listens on `0.0.0.0`. Start one if
   needed: the API is unchanged, so the main checkout's is fine. Use an API whose output you can read. If the running one's isn't, start your own and send its output to a file in the session scratchpad.
3. Create `claude-qa-084` (own ledger) and `claude-qa-084b` (`--join claude-qa-084`). A sibling worktree has no
   `apps/api/.env`, so run `tsx` with `--env-file` pointing at the main checkout's. Keep both TOTP secrets in the session scratchpad and generate a fresh code just before steps 2 and 7.
4. Start Metro from `/Users/dmytro.kostylov/home/kopiyka-expo-sdk58`, never under `.claude/worktrees`, without `CI=1`:
   `yarn mobile expo start --port 8084`.

The user then does these in Expo Go at `exp://<LAN IP>:8084`, one per message. After each, read the API log for the matching
request from the phone's address, and don't accept "it worked" without that line:

1. Open the app: it loads, and the login screen shows.
2. Sign in as `claude-qa-084`: `POST /api/auth/login`, then `GET /api/ledgers`.
3. Switch tabs: the month and income reads for the tab appear.
4. Add an expense, tapping the date field and choosing a date in the calendar: a `POST` under `/api/ledgers/:id/` returns 2xx.
5. Open a modal screen and close it; open a category from the Expenses tab and tap a tab in its bar.
6. Sign out: `POST /api/auth/logout`, and the login screen shows.
7. As `claude-qa-084b`, open Expenses, then a category. The developer removes that user as owner, with `DELETE /api/ledgers/<id>/members/<userId>` or from Members in a second browser profile. Then tap Add expense. Its categories read returns 404 `ledger_not_found`, and the app lands on `no-ledger`. API log: the DELETE 2xx, the 404, then `GET /api/ledgers`. On iPhone, a swipe back doesn't reveal the old page.

Afterwards delete both users in the documented order: expenses, ledger, user, `login_throttle` rows.

**After the slices.** Nothing is pushed and no PR opens until the user says the production deploy is done. Then fetch, and if
`main` moved, rebase: take `main`'s `yarn.lock` and re-run the slice 2 install instead of merging it by hand, take `main`'s
version and bump it once again, and rerun the gates, `expo-doctor` and the export.

## AC → evidence

| AC                                                 | Evidence                                                                                                                                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK-managed packages at SDK 58 versions, doctor OK | Slice 2: `npx expo-doctor` and `npx expo install --check` pass                                                                                                                     |
| Gates pass, no weakening                           | Gates on each commit, integration ran; slice 2's `rg` for `customConditions`, `@ts-ignore` and the legacy condition                                                                |
| Opens in Expo Go on a real iPhone, core flow works | Slice 4 steps 1–6, each with its API log line                                                                                                                                      |
| Sign-in, no-ledger, sign-out land correctly        | Web: slice 2 web check 1 and 8. iPhone: slice 4 steps 2, 6 and 7                                                                                                                   |
| Web at phone width still works                     | Slice 2 web check 2–7                                                                                                                                                              |
| Export output as `deploy.sh` and nginx expect      | Slices 1 and 2: one JS file under `_expo/static/js/web/`, same `index.html` structure, peak RSS compared with Findings under `deploy.sh`'s flags. Droplet: first deploy, see Risks |
| CI passes; Node meets the minimum                  | PR's CI run, once pushing is allowed. `.nvmrc` is `24`, so `setup-node` takes the latest 24.x. Droplet: the open question below                                                    |
| Conventions §5 names SDK 58, RN 0.88, `v58.0.0`    | Slice 3 diff and `rg`                                                                                                                                                              |

## Not doing (YAGNI)

- Any SDK 58 feature: data loaders, native tabs, activities, server output, Liquid Glass.
- Moving the module-level `router` to `useRouter`. The guide says "prefer", it isn't removed, and it would touch every screen.
- Chunked web output (the brief's decision).
- `sitemap: false`. `/_sitemap` is reachable today on both SDKs, which is unrelated to this upgrade (see Follow-ups).
- Tightening `engines` in the root `package.json`. No AC needs it.
- Committing the scratch browser harness. The repo has no UI test tooling, and adding it is a new dependency no AC asks for.
- Android checks, native folders, EAS builds, deploying.

## Risks

- **`readTabRoutes` reads nested navigation state whose shape SDK 58 reworked.** `test/tabs.test.ts` uses hand-built fixtures,
  so it can't catch this. Slice 2 web check 4 proves or disproves it. If it fails: fix `tabRoutes.ts` in slice 2 with a table
  test of the real shape.
- **Why the default guard fallback avoids `_sitemap` isn't explained.** Reading `GuardContext.js`, a shorter route name should
  sort first, yet no build landed there. Explicit `redirectTo` removes the dependence on that order. Slice 4 step 7 proves it
  on native.
- **Web safe area.** Expo says the Router no longer supplies insets on web. `AppShell` has its own `SafeAreaProvider`, so this
  should hold. Slice 2 web check 7 proves it.
- **Native runtime.** RN 0.88 and React 19.3 in Expo Go are unproven until a device runs them: the iOS export shows only that
  it bundles. Slice 4 proves it. `@react-native-community/datetimepicker` matters most: step 4 uses it.
- **Droplet export memory.** Cold peak rose about 10% on macOS (511 → 564 MB). The droplet's measured 450 MB suggests about
  500 MB there, inside the cap, but it stays untested until the first deploy. A failed build stops before `current` switches,
  so the live release keeps running.
- **Target versions move before the rebase.** Rerunning `expo install --check` after it catches this. A version under 24 hours
  old means waiting.

## Open questions

- Blocking before merge, not before building — is the droplet's Node at 24.3 or newer? `deploy/README.md` only says `v24.x`; the user's notes record 24.22.2 on 2026-11-02,
  which would meet it, but the planner doesn't reach into production. One instruction for the user: `ssh do /usr/bin/node --version`. If it is older,
  upgrading Node comes first. Assumed for now: it meets the minimum.
- Not blocking — should explicit `redirectTo` stay, given the brief doesn't name it? Assumed yes: AC4 relies on these redirects,
  and "people notice nothing" covers the URL. Without it, three lines disappear and signed-out deep links keep their params.

## Follow-ups

- `/_sitemap` serves the route list in production, to anyone, on SDK 57 as well. It lists file names only, but `sitemap: false`
  in the plugin would close it. Worth its own small brief.
- `engines` in the root `package.json` says `>=24`, which allows 24.0–24.2 and 25, neither supported by SDK 58.
- `TabBar.tsx` copies library metrics by hand, so every router upgrade needs the same recheck.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a: CONSOLIDATE line, each reuse/extract, each LEAVE + reason>
