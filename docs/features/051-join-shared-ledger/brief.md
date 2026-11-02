# Add a user to an existing ledger

Type: feature

## Why

Kopiyka is meant to be a shared budget, and the schema has been ready for it since the start (`ledger_members` with
`owner` / `member` roles; every ledger route checks membership). But the only way to get a user is
`yarn api create-user`, which always gives the new user a ledger of their own. So nobody can work in dimuch's
ledger next to dimuch.

## What

The admin script `create-user` gets an optional `--join <username>` flag. With it, the new user does not get a
ledger of their own: they're added as a `member` of the ledger that `<username>` owns. No default categories and no
first-month budget get created, since the ledger already has them. The TOTP QR code is printed as before.

Without the flag, `create-user` works as it does today.

In the app, the new user logs in and lands on the shared ledger (it's their only ledger, and the app opens the
first one). They see and change the same categories, budgets and expenses as the owner, and expenses they add are
recorded with their own `created_by`.

## Acceptance criteria

- [ ] `yarn api create-user --username olena --email olena@example.com --join dimuch` creates the user, adds them
      to dimuch's ledger as `member`, creates no new ledger, categories or category months, and prints the QR code.
- [ ] After that, `GET /api/ledgers` for olena returns exactly dimuch's ledger with `role: "member"`, and for dimuch
      still returns that ledger with `role: "owner"`.
- [ ] olena can read and write that ledger's categories, months and expenses through the API like the owner does;
      an expense she adds has her `created_by`.
- [ ] `--join` with a username that doesn't exist, or that owns no ledger, fails with a clear message and creates
      nothing (no user row left behind).
- [ ] `--join` with more than one owned ledger fails with a clear message (no guessing which one); `--ledger` together
      with `--join` is rejected.
- [ ] `create-user` without `--join` behaves exactly as before (existing tests unchanged and green).
- [ ] Checked locally: a joined user logs in on web at phone width and sees dimuch's budget and expenses.

## Out of scope

- Adding an **existing** user to another ledger, removing members, changing roles.
- Any invite flow in the app (`ledger_invites` stays unused), or any UI for members.
- Owner-only permissions: `member` can do everything `owner` can, as the routes do today.
- Showing who added an expense in the app.
- Notion sync differences per user.

## Notes

- `ledger_members` PK is `(ledger_id, user_id)`; `ledgers.owner_user_id` names the owner.
- Brief 052 (in-app invites: owner-only, with a ledger switcher) comes next and will add members from an API route.
  Keep "add a user to a ledger as member" as one function in the API code that 052 can call, not logic inside the
  script. Don't build any of 052 here.
- Production: run it on the droplet over ssh like `create-user` today (same `TOTP_ENC_KEY`); the deploy README's
  user section should mention `--join`.

## Open questions

- None if the defaults above are OK.
