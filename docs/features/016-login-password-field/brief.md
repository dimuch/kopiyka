# Login screen: "Password" field

Type: chore

## Why

The login screen talks about Google Authenticator and a "6-digit code". We want it to
read like an ordinary sign-in form: a username and a password, with the secret hidden
as it is typed.

## What

UI-only change on `apps/mobile/src/app/login.tsx`. Sign-in still works exactly as today
(username + the 6-digit TOTP code from the authenticator app); only the wording and the
field presentation change.

- Remove the subtitle "Sign in with your username and the code from Google Authenticator."
- The second field's label (and accessibility label) becomes "Password" instead of
  "6-digit code".
- The password field hides typed characters, and its placeholder is masked dots
  ("••••••") instead of "000000". It accepts whatever the user types, of any length —
  no client-side digits-only filter and no 6-character limit. Sign in is enabled once
  username and password are both non-empty; the API stays the judge of a valid code.
- Error messages say "password" instead of "code":
  - "Wrong username or password."
  - "Too many wrong passwords. Sign-in is blocked for 24 hours."
  - A malformed password (API answers `invalid_request`, e.g. 7 digits or letters):
    "Wrong username or password." — the client already requires both fields, so this
    can only mean a wrong password.

## Acceptance criteria

- [ ] Given the login screen, then the Google Authenticator subtitle is not shown.
- [ ] Given the login screen, then the second field is labelled "Password" (visible
      label and accessibility label) and no "6-digit code" text appears.
- [ ] Given an empty password field, then its placeholder is "••••••".
- [ ] Given I type into the password field, then the characters are masked (secure
      text entry) and nothing is filtered or truncated (any characters, any length).
- [ ] Given a non-empty username and any non-empty password, then Sign in is enabled.
- [ ] Given a valid username and current authenticator code, when I sign in, then
      login succeeds as before.
- [ ] Given wrong credentials / a block / an invalid request, then the error text says
      "password" (texts above), not "code".

## Out of scope

- Any API, DB or auth-model change (no real passwords; TOTP stays).
- Show/hide password toggle.
- Other screens, the admin/setup flow, README wording about Google Authenticator.

## Notes

- Decided with the user: relabel only; masked + "••••••" placeholder; password of any
  length/characters on the client; base is
  `origin/main` in a separate worktree (`../kopiyka-login-password`).
- With free-form input, the plan should decide the keyboard type and autofill hints
  (`number-pad`/`oneTimeCode` vs default/`password`) — say which and why.
- A malformed password gets a 400 before the throttle runs (unchanged API behaviour).
