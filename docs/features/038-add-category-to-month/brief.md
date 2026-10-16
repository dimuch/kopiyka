# Add a category to a month

Type: feature

## Why

Part 5 of 5 of `../033-monthly-budget/brief.md` (split at Gate A, 2026-10-16). A month's list can only be copied so
far; the user needs to add a category, either to start an empty month or to extend a copied list.

Depends on 037. The outline is in 033's plan ("Later parts"); 014's notes on `tech_name` uniqueness (deleted rows
included) and collation apply.

## What

- **"Add a category"** on the Budget tab, in the empty state and under the list: a name, planned amount €0.
- Name rules as in 037 (1–40 characters, unique within the month ignoring case).
- A name that matches a category in any month of the ledger (latest month first) reuses that category, so its history,
  Category screen and Notion totals stay one category. Otherwise a new category is created.
- A category removed from the month earlier comes back at €0 with its old expenses still deleted.
- Ended months can't change.

## Acceptance criteria

- [ ] API: add a category to a month, with integration tests: new name creates a category; a name used in another
      month reuses its id; duplicate in that month 400; 400 empty/too long; 409 `month_ended`; 401; non-member 404.
- [ ] App (web 390×844): "Add a category" in an empty month and under a list adds it at €0, and it can be picked in the
      expense form.
- [ ] iPhone (Expo Go): add works.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green, integration tests ran.

## Out of scope

- Reordering (015). Icons or colours.
