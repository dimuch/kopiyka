# Outcome: Login screen: "Password" field

Brief: ./brief.md · Finished 2026-10-08

## PRs

- [#23](https://github.com/dimuch/kopiyka/pull/23) Login screen password field — before versioning

## Decided

- The second field is a masked "Password" field that takes any characters, on the default keyboard. Sign in enables
  once both fields are filled, and the password is sent as typed. The API's `code` field didn't change.
- Gate A: password autofill hints (`current-password`, `password`), accepting that password managers may offer to
  save the 30-second code.
- Errors read "Wrong username or password." and "Too many wrong passwords. Sign-in is blocked for 24 hours."
- The branch kept its `feat/` name. Built as planned.

## Left out

- A show/hide toggle, any API or auth change, and the README and `create-user` wording (out of scope).
- A component-test runner just to test `errorText`.

## Follow-ups

None.

Full plan: `git show cd7d1a77:docs/features/016-login-password-field/plan.md`
