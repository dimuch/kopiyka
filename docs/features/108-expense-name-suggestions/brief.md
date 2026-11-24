# Expense name suggestions per category

Type: feature

## Why

The same shop names get typed again and again — "Delhaize" for groceries several times a
week. The "What was it?" field on the expense form is plain text, so each one is typed in
full every time. Offering the names already used in that category saves the typing and
keeps the spelling consistent.

## What

The "What was it?" field becomes a single-select with free text (a combobox):

- Tapping or focusing the field opens a dropdown of names already used in the
  **selected category**, taken from expenses dated in the **month of the form's date and
  the month before it**. The previous month is included so the list isn't empty at the start
  of a month.
- Names come from all members of the ledger (the ledger is shared).
- Order: **most used first** (how many expenses in that window have the name); ties go
  to the most recent expense date, then A–Z.
- Names that differ only in case or surrounding spaces count as one ("Delhaize",
  "delhaize ", "DELHAIZE"). The list shows the spelling used most recently.
- **Typing filters the list**: case-insensitive, matching anywhere in the name ("del" →
  Delhaize). A name that matches what is typed exactly (ignoring case) is still shown, so it
  can be picked to fix the spelling.
- Picking a suggestion fills in **the name only** and closes the dropdown. The amount, date
  and category stay as they are.
- Free text always works: any name can be typed and saved, as today.
- Changing the category (or a date in another month) updates the list for the new
  category and period.
- Nothing to suggest (no names, or no match for the typed text) → no dropdown, no
  empty-state message.
- A long list scrolls inside the dropdown. A cap on the list length is up to the plan
  (around 10–20).
- A locked form (expense in an ended month) shows no dropdown.
- Works on iOS and web, with the keyboard on web (arrow keys, Enter to pick, Escape to
  close), and with screen readers (combobox / listbox semantics).

## Acceptance criteria

- [ ] Given three expenses "Delhaize" and one "Colruyt" in Groceries this month, when I
      focus the name field with Groceries selected, then Delhaize is listed above Colruyt.
- [ ] Given "Delhaize" only in last month's Groceries and nothing this month, when I open
      the form on the 1st, then Delhaize is suggested.
- [ ] Given names from two months ago only, then they are not suggested.
- [ ] Given "Delhaize" in Groceries and "Netflix" in Subscriptions, when Groceries is
      selected, then only Delhaize is offered; switching to Subscriptions offers only
      Netflix.
- [ ] Given "Delhaize" and "delhaize " in the window, then one entry is shown.
- [ ] When I type "del", then only names containing "del" (any case) remain.
- [ ] When I pick a suggestion, then the name field holds it and the amount is unchanged.
- [ ] When I type a new name not in the list and save, then it saves as today.
- [ ] Given an expense added by another ledger member, then its name is suggested to me.
- [ ] A user who isn't a member of the ledger gets the same refusal as other ledger
      endpoints (no names from other ledgers).
- [ ] On web, the list can be used with the keyboard alone; on iOS with VoiceOver.

## Out of scope

- Suggesting or filling in an amount.
- Suggestions on the income form.
- Suggestions across all categories, or a "frequent names" setting.
- Removing a name from the suggestions (it goes once it hasn't been used for two
  months).
- The MCP connector.

## Notes

- Form field: `apps/mobile/src/app/expense.tsx` ("What was it?" `TextField`, placeholder
  already "e.g. Delhaize"). Use `@/components/TextField` and `@/components/Pressable` (brief
  066).
- Categories belong to the ledger (`categories.ledger_id`), so "same category last month"
  is the same `category_id`.
- The period follows the form's date (Kyiv calendar, see the conventions' date rules), not
  the device's today.
- A new expense saved in the form should appear in the suggestions the next time the
  form opens (cache invalidation).
- Expected to be an API read endpoint (e.g. names for a ledger + category + month) plus
  the combobox in the app; the plan decides the shape.

## Open questions

- None. Decided 2026-11-24: period = this + last month; order = most used; typing
  filters; picking fills the name only.
