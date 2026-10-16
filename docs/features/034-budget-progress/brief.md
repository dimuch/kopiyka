# Budget progress on the Expenses tab and Home

Type: feature

## Why

With planned amounts per category per month (033), the user needs to see at a glance how much of each category's plan
is used, and to be warned before going over.

Depends on 036 (planned amounts, part 3 of 033).

## What

- **Expenses tab:** every category row gets a progress bar from €0 to that category's planned amount for the month,
  filled by what's spent in it, plus "€86.20 of €120". The fill stops at full when spent is over the plan.
- **Warning:** a row turns to a soft warning background when spent reaches 90% of its planned amount. Over the plan it
  keeps the warning background and also says how much over ("€12.40 over").
- **Planned €0:** with nothing spent the bar is empty and there's no warning; any spending counts as over.
- **Expenses tab total:** "Spent this month" also shows the month's planned total ("€2,078.85 of €4,600"), using
  `CollapsingSummary`'s existing budget line.
- **Home:** the Budget card shows the current month's planned total ("Not set" when the month has no budget); the
  Expenses card keeps showing what's spent.
- The warning colour is a theme token with light and dark values that meet contrast for the row text.

## Acceptance criteria

- [ ] Unit tests (Vitest) for the progress maths: fill ratio, cap at 100%, 90% threshold, over amount, planned €0.
- [ ] App (web 390×844): a category at €50 of €120 shows a half-empty bar and no warning; at €108 of €120 (90%) it
      has the warning background; at €132.40 of €120 the bar is full, the background is the warning one and it says
      "€12.40 over".
- [ ] App: a category planned at €0 with no spending has an empty bar and no warning; with spending it shows over.
- [ ] App: the Expenses tab shows spent of planned for the month; Home's Budget card shows the planned total, or
      "Not set" for a month without a budget.
- [ ] App: figures update after adding, editing or deleting an expense and after changing a planned amount.
- [ ] Light and dark themes both readable; iPhone (Expo Go) checked.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Progress on the Category screen or Statistics.
- Notifications or alerts when crossing 90% or 100%.
- Planned amounts in Notion (postponed).

## Open questions

- "€12.40 over" and the exact copy are a proposal; the user asked for "a bit warning background" at about 90%.
