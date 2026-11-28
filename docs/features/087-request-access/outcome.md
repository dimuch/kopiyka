# Outcome: Ask for access from the login page

Brief: ./brief.md · Finished 2026-11-13

## PRs

- [#126](https://github.com/dimuch/kopiyka/pull/126) Ask for access from the login page — v1.8.0

## Decided

- On web only, below "Try it now", a "Request access" `mailto:` link built like the demo link, and under it the muted
  line "Full access: €5 a month". Store payment rules keep both off the native app.
- The new group sits in the body's existing 32pt gap, so it needed no new spacing value.
- The email address is in the public repo and on the public page, by the user's choice.
- The click check with `window.open` stubbed wasn't run, since it could open a real Mail draft; the real click in
  Safari and Chrome was left for the user.

## Left out

- A `mailto` builder or a unit test that repeats a literal.
- The price from the API or config, a sign-up form or a contact page (out of scope).
- `.web.tsx` files to keep the strings out of the native bundle, and an "opens your email app" hint.

## Follow-ups

None.

Full plan: `git show 33d9544d:docs/features/087-request-access/plan.md`
