# One screen for a category's name and planned amount

Type: feature

## Why

Adding a category with a budget takes two trips today: enter the name on Add a category, save, find the new row on
Budget, press its number, then enter the amount on Planned amount. Name and amount also live on two separate edit
screens (pencil = Rename category, row = Planned amount), so changing both means opening two modals. Both fields
belong to the same thing, so they should sit on one screen.

## What

One category screen with two fields, **Name** and **Planned amount** (€), and one **Save**. It replaces Add a
category, Rename category and Planned amount.

- **Add:** the "+" on Budget opens it empty, titled "Add a category". Name has focus. Save adds the category to the
  month with that amount and returns to Budget. Leaving the amount blank plans €0, as adding does today.
- **Edit:** the pencil on a Budget row opens it filled with the category's name and planned amount in that month,
  titled "Edit category". Name has focus. Save stores the changes and returns to Budget.
- **Row tap:** pressing the row or its number opens the same Edit screen, with the amount focused, so the quick way to
  change a limit stays one tap.
- **Remove:** "Remove from <month>" stays on the Edit screen under Save, and works as it does now. It isn't on Add.
- **Months:** the name and the amount still apply to the selected month only, and the caption says so.
- **Keyboards:** Name is a text field and shows the normal text keyboard. Planned amount is a number field and shows
  the number keyboard with a decimal mark, on iPhone and on a phone's web browser.
- **One save, all or nothing:** if Save is refused, nothing is stored. The screen stays open with what the user typed
  and shows why, so they can correct it and save again.
- **Only what changed is saved:** on a shared ledger, renaming must not overwrite an amount another member changed
  after the screen opened, and the reverse.

## Acceptance criteria

- [ ] API: one request adds a category to a month with a planned amount. Sending no amount plans €0, as today.
- [ ] API: adding with an amount that would leave the month above income returns 409 `over_income` and writes nothing:
      no category, no month row, no budget row. The same name can then be added with a smaller amount.
- [ ] API: adding a name that reuses a category earlier removed from the month plans the given amount, not the old one.
- [ ] API: one request changes a category's name and planned amount in a month. If either part is refused
      (`name_taken`, `over_income`), neither is stored.
- [ ] API: in a month already over income, changing only the name succeeds, and so does lowering the amount.
- [ ] API: both requests return `month_ended` for an ended month, 400 for a bad name or amount, 401 without auth and
      404 for a non-member; the edit also returns 404 for a category not in the month.
- [ ] App (web 390×844): "+" → type a name and amount → Save → Budget shows the new category with that amount, without
      opening another screen.
- [ ] App: "+" → name only → Save → the category shows €0.
- [ ] App: pencil opens the screen filled in; changing the name, the amount, or both saves and shows on Budget.
- [ ] App: pressing a row opens the same screen with the amount focused.
- [ ] App: Remove from the Edit screen still works, with its warning and Undo; an ended month deep link shows no Remove.
- [ ] App: a refused save shows the existing text for that refusal ("You already have a category called…", "Planned
      would exceed income by €X.", the month ended text), keeps both fields as typed, and an over-income or name refusal
      can be fixed and saved again.
- [ ] App: an invalid amount or name is refused on the screen with today's messages, and nothing is sent. On Edit a
      blank amount is refused, so clearing the field can't wipe a limit by accident.
- [ ] App: `/add-category`, `/rename-category` and `/planned-amount` are gone; nothing in the app links to them.
- [ ] Unit tests for any new pure logic in `data/`, such as working out which fields changed.
- [ ] iPhone (Expo Go): Name shows the text keyboard and Planned amount the decimal number keyboard, and an amount typed
      with either decimal mark (`120.50` or `120,50`) saves correctly.
- [ ] iPhone (Expo Go): with the keyboard open, both fields and Save can be reached. Return on Name moves to the amount.
      The number keyboard has no Return key, so Save must stay reachable without dismissing it by hand.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green, integration tests ran.

## Out of scope

- Changing a category in more than one month at once, or carrying its amount to later months.
- Reordering categories, and category icons or colours.
- The Income screens and their forms.
- The Category screen (`category/[categoryId]`) and its delete flow.
- Any change to the over-income rule itself (brief 060).

## Notes

- Why this needs the API: two calls in a row can't meet "all or nothing". Add then Set planned would leave the category
  at €0 after an `over_income` refusal, and the retry would then fail with `name_taken`. `addToMonth` and `setPlanned`
  each run in their own transaction today (`apps/api/src/categories/monthLists.ts`), so the plan should do the combined
  work in one transaction under `lockLedger`, with `checkIncome` given the amount as the raise.
- The plan decides the contract: an optional `amount` on `POST .../months/:month/categories` looks natural for Add; Edit
  needs one route for both fields, with each optional so only changes are sent. Say whether the existing `/name` and
  `/planned` routes go once the app stops calling them.
- `CategoryNameForm` and the Editor in `planned-amount.tsx` repeat the same save handling (in-flight guard, `gone`,
  error announcement), which merges into the one form. Keep the `busy` and `gestureEnabled` handling.
- `over_income` must leave the fields editable, unlike `month_ended` and `not_found`, which stop saving.
- Amounts use `normalizePlanned` and names use `normalizeName`, unchanged. Money stays decimal strings on the wire.
- The Budget row's accessibility text changes with it ("Rename…" and "Sets the planned amount" no longer fit).
- Number 065: 064 is `login-lockout` on main.

## Open questions

- None blocking. The row tap (opens Edit with the amount focused) and blank amount on Edit (refused) are the two choices
  made here that the request didn't spell out.
