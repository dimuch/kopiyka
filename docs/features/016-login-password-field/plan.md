# Plan: Login screen "Password" field

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/login-password-field <!-- existing worktree branch; brief Type is chore, see Open questions -->
Base: origin/main @ f6fc4b8

## Approach

One commit, all of it in `apps/mobile/src/app/login.tsx` (about 25 changed lines). Remove the subtitle. Relabel the
second field "Password" (visible label and `accessibilityLabel`). Make it a masked field (`secureTextEntry`) with the
placeholder `••••••`. Drop the digits-only filter and `maxLength`, and enable Sign in when
`username.trim().length > 0 && password.length > 0 && !busy`. The password is sent as typed, without trimming. In
`errorText`, `invalid_credentials` and `invalid_request` both become "Wrong username or password.", and `blocked`
becomes "Too many wrong passwords. Sign-in is blocked for 24 hours." The local state `code`/`setCode` is renamed to
`password`/`setPassword`, and the `codeInput` style to `passwordInput` (same values). `useAuth().login(username, code)`
and the API body field `code` don't change.

**Keyboard and autofill decision**: `keyboardType` default (the `number-pad` line is removed), `autoCapitalize="none"`,
`autoCorrect={false}` (on web this also turns off spellcheck), and the autofill hints become password hints:
`autoComplete="current-password"` and `textContentType="password"` (user's call at Gate A).

- A default keyboard matches "any characters". With `number-pad`, iOS users couldn't type what the field accepts, and
  it would look like a code field again.
- Password hints make the form read as an ordinary sign-in to iOS and browsers. Trade-off accepted by the user: since
  the value is still a 30-s TOTP code, Keychain / browser password managers may offer to save it.

Alternatives considered:

- Keep `number-pad` + `oneTimeCode`: faster for the real 6-digit secret, but it contradicts "any characters" on iOS.
- `oneTimeCode` hints: avoid save-password prompts, but the user chose `password` hints at Gate A.

Not unit-tested: the app's Vitest runs only `test/**/*.test.ts` in Node. `errorText` depends on `ApiError` from
`api/client.ts`, which imports `expo-secure-store` and `react-native`. Adding a component-test runner would be a new
dependency that no AC needs. Evidence is a web check at phone width plus an iPhone check (conventions §6).

## Contracts

- DB: none
- API: none. `POST /api/auth/login` still takes `{ username, code: /^\d{6}$/ }`. A malformed code → 400
  `invalid_request` (before the throttle), wrong → 401 `invalid_credentials`, locked → 429 `blocked`.
- App: none. `AuthContext.login(username: string, code: string)` is unchanged; only `login.tsx` internals change.
- New dependencies: none

## Slices

- [x] 1. Show a masked Password field on the sign-in screen
  - Files: `apps/mobile/src/app/login.tsx`
  - Change: everything in Approach. Remove the subtitle `<Text>` and the `subtitle` style. The title `View` wrapper can
    go once it has a single child. Keep `setPassword('')` after a failed sign-in and `onSubmitEditing={submit}`.
  - Tests: none (see Approach). Gates: format, lint, typecheck, test.
  - Verify: run the launch configs `api` and `web` in the in-app browser at 390×844. Use a throwaway username such as
    `nobody-qa`, so no real user's counter moves.
    1. No subtitle. The labels read "Username" and "Password". Search the page for "6-digit" and "Google": no hits. The
       a11y tree shows the input labelled "Password".
    2. The empty password shows `••••••`. The DOM input has `type="password"` and `autocomplete="current-password"`.
    3. Type `abc12345XYZ!` (12 chars). It's masked, and the input's `value` (read via JS) is exactly `abc12345XYZ!`.
       Sign in is enabled. Clear the username and Sign in turns disabled; type a username and one character of
       password and it's enabled again.
    4. Sign in with `abcdefg` → "Wrong username or password." (400 `invalid_request`, not counted by the throttle).
    5. Sign in with `123456` → "Wrong username or password." (401). Do this only once: it counts against the dev IP and
       device.
    6. Blocked, without locking the dev IP for 24 h: in the page, stub `window.fetch` so that `/api/auth/login` returns
       `new Response('{"error":"blocked"}', { status: 429 })`, then sign in → "Too many wrong passwords. Sign-in is
       blocked for 24 hours." Reload to drop the stub.
    7. Happy path: sign in as a QA user with a current authenticator code → the home screen loads. If you need a fresh
       user, create one with `yarn api create-user` and keep the secret only in the session scratchpad.
  - Verify on iPhone (Expo Go): masked entry, letters keyboard, the sign-in succeeds; note in the PR whether iOS
    prompts "Save Password?" (expected and accepted).

## AC → evidence

| AC                                                 | Evidence                                     |
| -------------------------------------------------- | -------------------------------------------- |
| Subtitle not shown                                 | Slice 1 web check 1                          |
| Labelled "Password" (visible + a11y), no "6-digit" | Slice 1 web check 1                          |
| Placeholder `••••••`                               | Slice 1 web check 2                          |
| Masked; no filter or truncation                    | Slice 1 web checks 2–3; iPhone check         |
| Non-empty username + password → Sign in enabled    | Slice 1 web check 3                          |
| Valid code → login succeeds as before              | Slice 1 web check 7; iPhone check            |
| Error texts say "password"                         | Slice 1 web checks 4 (400), 5 (401), 6 (429) |

## Not doing (YAGNI)

- Show/hide toggle, any API/DB/auth change, README or `create-user` wording about Google Authenticator (all out of
  scope per the brief).
- A component-test runner (RNTL/jest-expo) for screens, and moving `errorText` out of the screen to make it testable.
  It has one caller, and its `ApiError` import isn't Node-loadable.
- Restyling the field. It keeps today's display font and letter spacing, just under a new name.

## Risks

- With password hints, iOS Keychain and browser password managers will likely offer to save the (expiring) code.
  Accepted by the user at Gate A; noted in the PR.
- A long password in the display font with `letterSpacing: 8` scrolls horizontally inside the 52-pt field. Web check 3
  shows it. That's acceptable, because the input scrolls and nothing is truncated.

## Open questions

- Resolved at Gate A: default keyboard + password autofill hints.
- No (not blocking): branch name. Conventions §8 says a `Type: chore` brief gets `chore/<slug>`, but the worktree was
  created as `feat/login-password-field`. Assumption: keep the existing branch and let the user rename it if they care.

## Follow-ups

- Nothing found while planning. Other references to "6-digit code" and "Google Authenticator" are in the README,
  `apps/api/scripts/create-user.ts`, `apps/api/src/auth/totp.ts` and the API tests, and the brief keeps those out of
  scope. No app test, e2e test or doc refers to the login screen's old texts.

## Deviations

<filled by the developer during build>
