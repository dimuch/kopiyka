# Per-month category lists in the app

Type: feature

## Why

Part 3 of 4 of per-month categories (`../028-per-month-categories/brief.md`, split at Gate A on 2026-10-13). Since
028 and 029, the API keeps a category list per month and can remove a category from one month, but the app still
asks for the current month's list everywhere. So a past or future month shows today's categories, and the expense
form offers categories that the chosen date's month doesn't have, which the API then refuses with a generic error.

## What

- **Each month shows its own categories.** Home, the Expenses tab (with its month switcher) and the Category screen
  load the list of the month they show (`GET …/categories?month=YYYY-MM`).
- **The Category screen for a month without that category** says “eating out” isn’t in October., instead of
  "Category not found.". It has no "+" (Add would preselect a category the month doesn't have).
- **The expense form follows the date's month.**
  - It offers the categories of the month of the chosen date, and reloads them when the date moves to another month.
  - If the selected category isn't in that month, the form shows "That category isn’t in November." and doesn't
    save. A save refused by the API with `category_not_in_month` shows the same text.
  - The quick row only shows categories of that month.
- **`month` becomes required** on `GET …/categories`, because every caller now sends it.

## Acceptance criteria

- [ ] Web 390×844: after removing `eating_out` from October through the API (QA ledger), October's Expenses tab and
      expense form have no "eating out", while September's Expenses tab still shows it with its spending.
- [ ] Web: in the expense form, picking "eating out" on a September date and then changing the date to October shows
      "That category isn’t in October." and Save doesn't send the expense. Moving the date back to September clears
      the message and saves.
- [ ] Web: the Category screen for eating out in October shows “eating out” isn’t in October. without "+";
      September's shows its expenses.
- [ ] API: `GET …/categories` without `month` answers 400; existing tests updated.
- [ ] Light and Dark checked; iPhone (Expo Go): the month switcher and the form's message.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Removing a category from the app (part 4, brief 031), and 018's all-months delete (removed in 031).
- Locking ended months (its own brief).

## Notes

- To see a month without a category before 031, remove it through the API (`DELETE …/categories/:id/months/:month`)
  on a fresh `claude-qa-030` ledger. Never on ledger 1, which is synced to the real Notion.
- 018's delete-category screen still calls `GET one` without `month`; it stays as it is until 031.
