# Plan: Screen readers on web hear which option is selected

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: fix/aria-states-on-web
Base: origin/main (e074249, version 1.15.0)

## Approach

Every `accessibilityState={{ … }}` in `apps/mobile/src` is on the app's `components/Pressable.tsx` wrapper, which
spreads its props into React Native's `Pressable`. There are 23 sites in 16 files, more than the brief lists, and
"every control" covers all of them. Each becomes the matching `aria-*` prop with the same value. `disabled` is the one
exception: react-native-web's `Pressable` overwrites `aria-disabled` with its own `disabled` prop, so `disabled` is
what carries the state. Then an ESLint `no-restricted-syntax` rule stops the prop from coming back.

Facts checked on the Base's installed code (react-native 0.88.1, react-native-web 0.21.4):

- **iOS stays the same.** `react-native/Libraries/Components/Pressable/Pressable.js` builds `accessibilityState` as
  `{ busy: ariaBusy ?? accessibilityState?.busy, checked: …, disabled: …, expanded: …, selected: … }`, then replaces
  `disabled` with the `disabled` prop when that prop is set. Moving a value from `accessibilityState.x` to `aria-x`
  gives the native view the same object, key for key.
- **Web: the `aria-*` states reach the page.** I server-rendered react-native-web's `Pressable` in a scratch script.
  `aria-busy`/`aria-checked`/`aria-expanded`/`aria-selected` set to `true` or `false` come out as the matching attribute
  with that value. `accessibilityState` comes out as nothing.
- **Web: `aria-disabled` does not reach the page from a Pressable.** In
  `react-native-web/dist/exports/Pressable/index.js` the props passed to the `View` end with
  `{...rest, "aria-disabled": disabled, …}`, so a caller's `aria-disabled` is replaced by `disabled`, which may be
  `undefined`. Rendering `aria-disabled` alone gave `<button … tabindex="0">`. Rendering `disabled` gave
  `<button aria-disabled="true" disabled="" tabindex="-1">`.
- **So sites that already pass `disabled` lose their `disabled:` key and gain no `aria-disabled`.** That covers 13 sites in 9
  files. On iOS the prop already overrides that key, and on web the prop already renders `aria-disabled="true"`.
  - In `expense.tsx` the key (`list.status !== 'ready'`) and the prop (`busy || list.status !== 'ready'`) disagree.
    iOS already announces the prop's value, so dropping the key changes nothing there either.
- **`login.tsx` needs the `disabled` prop instead.** It is the one site with `accessibilityState.disabled` and no
  `disabled` prop. `aria-disabled={!ready}` would work on iOS but be dropped on web, so AC4 would fail. It gets
  `disabled={!ready}`. `submit` already returns early when `!ready`, so nothing a user can do changes. See Risks and
  Open questions for the small changes on web.
- **No site is a `TextInput` or other non-View component**, so there's no question of which components accept `aria-*`.
  `TabBar.tsx` already uses `aria-selected` this way, so this is the repo's existing pattern.

Alternative considered: have `components/Pressable.tsx` turn `accessibilityState` into `aria-*` props. That's one
file, but it keeps a prop that react-native-web ignores alive at every call site. It wouldn't cover RN's own
`Pressable`, and it can't stop the mistake from coming back the way a lint rule can. The swap is the same size and
leaves nothing behind.

## Contracts

- DB: none
- API: none
- App: no new props or types. Sites pass `aria-busy` / `aria-checked` / `aria-expanded` / `aria-selected` (already
  in RN's `PressableProps`) and, on login only, `disabled`. Site by site, `before → after`:

  | Site                                                | Before                                                 | After                                            |
  | --------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------ |
  | `app/income-item.tsx:246`                           | `{ busy }`                                             | `aria-busy={busy}`                               |
  | `app/expense.tsx:357`                               | `{ busy, disabled: list.status !== 'ready' }`          | `aria-busy={busy}` (prop covers disabled)        |
  | `app/login.tsx:92`                                  | `{ disabled: !ready }`                                 | `disabled={!ready}`                              |
  | `app/members.tsx:126`, `:375`                       | `{ disabled: …, busy }`                                | `aria-busy={busy}`                               |
  | `app/members.tsx:495`                               | `{ busy }`                                             | `aria-busy={busy}`                               |
  | `app/delete-category.tsx:147`                       | `{ busy }`                                             | `aria-busy={busy}`                               |
  | `app/(tabs)/statistics.tsx:213` (period button)     | `{ expanded: menuOpen }`                               | `aria-expanded={menuOpen}`                       |
  | `app/(tabs)/statistics.tsx:225` (Next month)        | `{ disabled: !forwardEnabled }`                        | removed (`disabled={!forwardEnabled}` covers it) |
  | `app/(tabs)/statistics.tsx:274` (period menu radio) | `{ checked }`                                          | `aria-checked={checked}`                         |
  | `app/category/[categoryId].tsx:108`                 | `{ expanded: menuOpen }`                               | `aria-expanded={menuOpen}`                       |
  | `components/NotionSyncPanel.tsx:40`                 | `{ disabled: syncing, busy: syncing }`                 | `aria-busy={syncing}`                            |
  | `components/NotionSyncPanel.tsx:63`                 | `{ disabled: syncing }`                                | removed (prop covers it)                         |
  | `components/EmptyMonth.tsx:28`                      | `{ busy: action.busy, disabled: action.busy }`         | `aria-busy={action.busy}`                        |
  | `components/CategoryPicker.tsx:35`                  | `{ selected: on, disabled }`                           | `aria-selected={on}`                             |
  | `components/CategoryPicker.tsx:51`                  | `{ disabled }`                                         | removed (prop covers it)                         |
  | `components/AppearancePicker.tsx:31`                | `{ checked }`                                          | `aria-checked={checked}`                         |
  | `components/LedgerPicker.tsx:34`                    | `{ checked, disabled }`                                | `aria-checked={checked}`                         |
  | `components/CategoryForm.tsx:157`                   | `{ busy }`                                             | `aria-busy={busy}`                               |
  | `components/PendingInvites.tsx:42`                  | `{ disabled: busy }`                                   | removed (prop covers it)                         |
  | `components/PendingInvites.tsx:52`                  | `{ disabled: busy, busy: busyId === invite.inviteId }` | `aria-busy={busyId === invite.inviteId}`         |
  | `components/DateChips.tsx:34`                       | `{ selected: value === d.value }`                      | `aria-selected={value === d.value}`              |
  | `components/DateField.tsx:73`                       | `{ disabled }`                                         | removed (prop covers it)                         |

  Each "prop covers it" row already passes a `disabled=` prop with the same value as the removed key; `expense.tsx` is
  the one exception, explained in Approach.

- Lint: in `apps/mobile/eslint.config.js`, a new config object after `prettierConfig`:
  `rules: { 'no-restricted-syntax': ['error', { selector: "JSXAttribute[name.name='accessibilityState']", message:
'react-native-web ignores accessibilityState. Use aria-busy, aria-checked, aria-expanded or aria-selected; on a
Pressable, use disabled (react-native-web drops aria-disabled there).' }] }`.
  - No `files` key, so it covers everything `expo lint src test` lints. Neither `eslint-config-expo` nor Prettier sets
    `no-restricted-syntax` (checked with `--print-config`), so nothing is overridden.
  - I tested the selector through ESLint on JSX (stdin, `--stdin-filename src/scratch.tsx`): it reports
    `<Pressable accessibilityState={{ busy: true }} />` at the attribute.
- Reuses: the existing `aria-selected` pattern in `components/TabBar.tsx`; the existing `disabled` prop on every
  other dimmed button.
- New dependencies: none

## Version

Bump: patch — 1.15.0 → 1.15.1
Why: §8b `patch` ("Bug fix … no new capability"). Screen readers on web now hear states that were always meant to
reach them. No API, schema, connector or iOS behaviour changes.

## Slices

- [x] 0. Bump version to 1.15.1
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.15.1
- [x] 1. Tell screen readers on web which option is selected, open or busy (~40 lines)
  - Files: the 15 files in the Contracts table other than `login.tsx`.
  - Change: each row as in the table. Each `accessibilityState` line becomes one `aria-*` line or is deleted.
  - Verify: `rg -c accessibilityState apps/mobile/src` gives 1 (`login.tsx`), before slice 2. Then run the web check below for
    AC1–AC3, plus `aria-busy="false"` on the idle Add button of the expense form.
- [x] 2. Report the sign-in button as disabled on web (~3 lines)
  - Files: `apps/mobile/src/app/login.tsx`.
  - Change: `accessibilityState={{ disabled: !ready }}` → `disabled={!ready}`, with a why-comment above it:
    `// disabled, not aria-disabled: react-native-web's Pressable sets aria-disabled from disabled only.`
  - Verify: signed out on web, empty fields → Sign in has `aria-disabled="true"`. Type a username and Password → the
    attribute is gone and the button signs in. Enter in the Password field still submits. The look stays the same (0.4
    dim), apart from the mouse cursor.
- [x] 3. Fail lint when accessibilityState comes back (~10 lines)
  - Files: `apps/mobile/eslint.config.js`.
  - Change: the rule from Contracts.
  - Verify: `yarn lint` passes. Then put `accessibilityState={{ busy: true }}` on any Pressable in `src`, run
    `yarn mobile lint`, see the error with the message, and revert. Record this in the PR test plan.

There's no automated test, on purpose:

- App tests run in Node and cover pure modules only (§6).
- Rendering these components under Vitest would mean aliasing `react-native` to `react-native-web` and stubbing
  Expo and the appearance provider. That's new test infrastructure, and all it would assert is react-native-web's own
  mapping.
- The regression this fix guards against is the prop name, and slice 3's lint rule catches that.
- §6 says UI is verified in the web build, and the PR's test plan records it.

**Web check**, used by slices 1 and 2. I didn't count it in the line estimates.

1. Start `api` and `web` from `.claude/launch.json`.
   - If port 8081 is taken, start web with `--port 8082`, and add `http://localhost:8082` to `CORS_ORIGINS` in the
     gitignored `apps/api/.env` for the check only. Put that line back afterwards.
2. Phone width, in the in-app browser.
3. Sign in as `qa-user` with a TOTP code.
   - Get the code from a scratch script in the system temp dir run with `tsx`:
     `hotp(base32Decode(QA_TOTP_SECRET), timeStep(Date.now()))` from `apps/api/src/auth/totp.ts`.
   - Don't print the secret.
   - A code that has been used once is refused, so wait for the next 30 s step before trying again.
4. Read the attributes in the console with
   `[...document.querySelectorAll('[aria-checked],[aria-selected],[aria-expanded],[aria-busy],[aria-disabled]')].map(e => [e.getAttribute('aria-label') ?? e.textContent, e.getAttribute('role'), ['checked','selected','expanded','busy','disabled'].map(a => e.getAttribute('aria-' + a))])`
   on:
   - Settings
   - the expense form (category chip, date chips, Add)
   - a category page (⋯ closed, then open)
   - Statistics (period button closed, then open with the menu's radios; Next month on the current month shows
     aria-disabled="true")
   - the signed-out login screen

**iPhone check (AC5)**: with VoiceOver on, focus on an Appearance radio, a category chip, ⋯ before and after opening,
and Sign in with empty fields. Each should read as it does on `main`.

## AC → evidence

| AC                                                     | Evidence                                                                                                                                                                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 Settings appearance and ledger rows `aria-checked` | Web check: the 3 Appearance radios show `"true"` on the chosen one and `"false"` on the others. Ledger rows: see Open questions, since `qa-user` has one ledger and `LedgerPicker` only renders with two or more. Same code path as Appearance. |
| AC2 chosen category chip `aria-selected="true"`        | Web check on the expense form: the chosen chip shows `"true"` and the others `"false"`. Also seen there: the date chips.                                                                                                                        |
| AC3 ⋯ `aria-expanded` true/false                       | Web check on a category page: `"false"`, then `"true"` after a tap, then `"false"` after the menu closes.                                                                                                                                       |
| AC4 sign-in `aria-disabled="true"` when not ready      | Slice 2's web check, signed out with empty fields.                                                                                                                                                                                              |
| AC5 iPhone VoiceOver unchanged                         | RN `Pressable.js` source (Approach) shows the same `accessibilityState` object key for key, and the iPhone check above.                                                                                                                         |
| AC6 none in `src`, lint fails if added                 | `rg -n accessibilityState apps/mobile/src` is empty after slice 2, and slice 3 shows the lint failure.                                                                                                                                          |

## Not doing (YAGNI)

- Mapping `accessibilityState` inside `components/Pressable.tsx` (see Alternative).
- `aria-disabled` next to an existing `disabled` prop. It's redundant on iOS and replaced on web.
- Swapping `accessibilityLabel` / `accessibilityRole` / `accessibilityHint` for `aria-*`. That's out of scope in the
  brief.
- A lint rule for `accessibilityState` passed in a spread object. No code does that.
- Changing which ARIA state chips use (see Follow-ups).
- Making a second ledger for `qa-user`.

## Risks

- **Making Sign in truly disabled changes a little on web**, even though `submit` already ignores presses. Disproven
  or confirmed by slice 2's check.
  - While the fields are empty, Tab skips the button (`tabindex="-1"`, native `disabled`), and the cursor stops being a
    pointer.
  - While signing in, the button becomes disabled under focus. Every other busy button already does this.
- The Statistics period menu is already on main (6adc80d); this plan converts its three sites, as the brief's Out of
  scope asks of the branch that merges second.
- **The demo build may need a new module list.** It contains several of these components, but no imports change, so
  `yarn mobile check-builds` should pass without `--accept`. CI proves it on the PR.

## Open questions

- **Non-blocking: ledger rows can't be seen on web with `qa-user`.** The local `qa-user` belongs to one ledger (checked
  with a read-only query), and Settings only renders `LedgerPicker` with two or more, so the ledger half of AC1 can't
  be seen on web with that user. Assumption: the Appearance radios stand in for it. Both use the same wrapper, the same
  `aria-checked={checked}` and the same role, and the PR test plan says so. If you want it seen anyway, a second local
  user would have to invite `qa-user` to a second ledger.
- **Non-blocking: is a truly disabled Sign in acceptable?** On web, while the button isn't ready, it now leaves the tab
  order and the cursor stops being a pointer. That's the only way react-native-web renders `aria-disabled` on a
  Pressable. Assumption: yes, because it now behaves like every other disabled button in the app.
- **Non-blocking: who runs the iPhone check?** No iOS Simulator is installed on this machine. Assumption: you run the
  VoiceOver check on your iPhone, and the PR test plan leaves it unticked until then.
- **Non-blocking: the brief's site list is short.** It leaves out `DateChips`, `DateField`, `CategoryForm`,
  `PendingInvites` and the Statistics period menu, now on `main`. Assumption: "every control that sets
  `accessibilityState`" and AC6 include them, so this plan converts them too.

## Follow-ups

- **Chips that use `aria-selected` may still be silent on web.** WAI-ARIA 1.2 doesn't support `aria-selected` on
  `role="button"` (only `gridcell`, `option`, `row`, `tab`), so a browser may leave it out of the accessibility tree.
  That covers the category and date chips. If so, a screen reader on web still won't hear "selected" there,
  even though the attribute is now on the page and AC2 is met as written.
  - VoiceOver on iOS does read it.
  - A follow-up brief could pick a supported pattern: `aria-pressed`, or a radio group as in `AppearancePicker`. That
    one decision covers both platforms.
- Conventions §5's accessibility line could say "states via `aria-*` props (react-native-web ignores
  `accessibilityState`)". This is a proposal, not a slice; the lint rule already enforces it.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a: CONSOLIDATE line, each reuse/extract, each LEAVE + reason>
