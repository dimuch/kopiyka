# Monthly budget: set up a month and plan each category

Type: feature

## Why

The point of kopiyka is to keep spending per category under a monthly plan. Today a month silently inherits the
previous month's categories (028) and there is nowhere to say how much each category may use: the Budget tab is a
placeholder and `category_budgets` (planned EUR per category per month, in `001_initial.sql`) has never been used.

Each month should be planned on purpose: the user sets up the month's categories and a planned amount for each before
entering expenses. Months are independent: changing October never changes September.

Depends on 032 (Remove from a month in the app). Replaces brief 014 (create and rename), which was written for
ledger-wide categories. 034 (progress bars and Home totals) builds on this.

## What

- **Budget tab** (replaces the placeholder) with the same month switcher as the Expenses tab. It lists the selected
  month's categories, each with its planned amount, and the month's planned total at the top.
- **A month with no budget** shows an empty screen: "No budget for November yet" with two actions:
  - **"Copy October’s categories"** copies the previous month's list 1:1 (same categories, names and order), with every
    planned amount at €0. Only offered when the previous month has a list.
  - **"Add a category"** starts the list with one new category.
- **Add a category** to a month: a name, planned amount €0 by default. Names are 1–40 characters after trimming and
  unique within that month ignoring case ("You already have a category called “groceries” in November."). A name that
  matches a category in another month of the ledger reuses that category (same id), so its history, Category screen
  and Notion totals stay one category.
- **Set the planned amount:** tap a category on the Budget page and enter an amount in EUR (≥ 0, cents allowed).
- **Rename** a category in one month only. October's rename leaves September's name as it was; a later copy from
  October takes October's name.
- **Remove** a category from the month: the same confirm screen and Undo as 032. Its planned amount goes with it and
  comes back on Undo.
- **Budget before expenses:** in a month with no budget, the Expenses tab shows "No budget for November yet" with a
  button to the Budget tab, and the expense form can't save into that month ("Set up November’s budget first.").
- **Months are independent.** No carry-over: removing, adding or renaming in October changes only October.
- **Ended months are read-only** (028): no add, remove, rename, copy or amount change. The current month and future
  months can be planned.

## Acceptance criteria

Split at Gate A (2026-10-16) into 5 PRs: part 1 is this brief's PR (API: months stand alone, Copy the previous month),
parts 2–5 are briefs 035 (Budget tab), 036 (planned amounts), 037 (rename in one month) and 038 (add a category). See
the plan. Each AC names its part.

- [ ] Migration, part 1: every month from the ledger's first month (its creation or first expense, whichever is
      earlier) up to and including the month of the migration keeps exactly the list it has today (its own or
      inherited); later months start with no budget. Tests.
- [ ] API, part 1: copy the previous month, with integration tests: happy path, copy when the previous month has no
      list, a month that already has a budget, ended month 409 `month_ended`, auth 401, non-member 404.
- [ ] API, part 1: an expense dated in a month with no budget is refused (400), as `category_not_in_month` does today.
- [ ] API, parts 3–5: set a planned amount (036), rename (037), add a category (038), with integration tests:
      validation 400 (empty/long/duplicate-in-month name, negative or malformed amount), 409 `month_ended`, 401, 404.
- [ ] API, part 4: a rename in October leaves September's name unchanged; a copy into November takes October's names.
- [ ] App (web 390×844), parts 2 and 5: November with no budget shows the empty screen; "Copy October’s categories"
      fills it with October's list at €0 (035); "Add a category" adds one at €0 (038).
- [ ] App, parts 3 and 4: setting a planned amount updates the row and the month's planned total (036); renaming
      changes the name on the Budget tab, Expenses tab, Category screen and expense form for that month only (037).
- [ ] App, part 2: in a month with no budget the Expenses tab points to the Budget tab and the form shows "Set up
      November’s budget first."; an ended month's Budget tab has no edit controls.
- [ ] iPhone (Expo Go), parts 2–5: empty screen, copy, add, amount and rename work.
- [ ] Every part: `yarn format:check && yarn lint && yarn typecheck && yarn test` green, integration tests ran.

## Out of scope

- Progress bars, the warning colour and Home's Budget card figure (brief 034).
- Planned amounts in Notion's "Budget" column (postponed, user 2026-10-16).
- Reordering categories (015); a copy keeps the previous month's order.
- Copying planned amounts (a copy always starts at €0).
- Copying from a month other than the previous one.

## Notes

- Today's carry-over lives in `apps/api/src/categories/monthLists.ts` (`MAX(list_month) <= month`) and the
  `'2000-01-01'` seed rows (migration 007, `admin.ts`). This brief replaces "inherit the latest earlier list" with
  "a month has exactly its own list".
- A per-month name needs storage per category per month (for example a column on `category_months`); the planner
  decides. `tech_name` (tile hue) stays per category so a rename doesn't change colours. 014's notes on `tech_name`
  uniqueness, accent-insensitive collation and Undo bringing back a name that's now taken still apply, per month.
- Notion totals and groceries sync match Notion rows by category name (with the `utilities` ↔ "utilites" alias).
  The plan must say which name the sync uses once names are per month, and test only on a QA ledger.
- Name reuse across months: if "eating out" was renamed in October to "food out", adding "eating out" in December
  should still find the category. The plan says how (e.g. match any month's name, latest first).
- The expense form's default category (030) must cope with a month that has no budget.

## Decisions (user, 2026-10-16)

- New months start empty; the user adds categories or copies the previous month (planned €0). Months that already
  have a list keep it.
- Category id and name can be reused across months, but months are not connected: October's changes don't affect
  September.
- The copy source is the month before the selected one.
- Ended months can't change.
- A budget is required before any expense in that month.

## Decisions (user, Gate A, 2026-10-16)

- Split into 5 parts (033 part 1, then 035–038), each its own PR from main.
- Part 1 merges when ready and part 2 comes next; if part 2 is late for November, one copy call per ledger sets
  November up.
- Migration 008 writes lists from each ledger's first month, not from 2000-01.
