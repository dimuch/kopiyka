# Tab bar on child pages, and "Back" on the expense form

Type: feature

## Why

From the expense form or a category's page there's no way to jump to another top-level
page: you have to back out first, then tap a tab. That's an extra step every time, and
"Cancel" on the expense form reads like it throws something away when it really just
leaves.

## What

- **Expense form** (`expense.tsx`, both "New expense" and "Edit expense"): the top-left
  "Cancel" button is renamed **Back**. It behaves exactly as today (goes back; opened from
  a link with nothing to go back to, it goes Home).
- **Tab bar on child pages.** The same tab bar as the tab pages (today 6 icons: Home, Budget,
  Income, Expenses, Statistics, Settings) shows at the bottom of:
  - the expense form (new and edit),
  - category detail (`category/[categoryId].tsx`).
- Tapping a tab there leaves the child page and shows that tab's page, the same as
  tapping it on a tab page. The child page doesn't stay on the stack underneath.
- The tab the user came from is shown as the active one (e.g. a category opened from
  Expenses highlights Expenses). Opened from a link, with no tab underneath, Expenses is
  active for category detail and Home for the expense form.
- The bar looks the same as on tab pages: icons only, same colours, same invites badge on
  Settings, same screen-reader labels.

This reverses one rule of brief 019 ("the tab bar shows only on the 5 tab pages");
everything else in 019 stands.

## Acceptance criteria

- [ ] Given I open New expense or Edit expense, then the top-left button reads "Back" and
      no "Cancel" text appears on the screen.
- [ ] Given I tap Back on the expense form, then I return to the page I came from (Home
      if opened from a link), as before.
- [ ] Given I open the expense form or a category page, then the tab bar shows at
      the bottom, and the Add button / the expense list stay fully visible above it (not
      covered), on iOS and web.
- [ ] Given I'm on the expense form or a category page, when I tap any tab icon, then that
      tab's page shows; pressing back / swiping back from there doesn't return to the
      child page.
- [ ] Given I opened a category from Expenses, then the Expenses icon is the active one in
      the bar on the category page.
- [ ] Given I have pending invites, then the Settings badge shows on child pages too.
- [ ] Given unsaved input on the expense form, when I tap a tab, then I leave without a
      prompt, same as Back does today.
- [ ] iOS swipe-back still works on category detail.

## Out of scope

- Other child/modal screens (add/rename/delete category, planned amount, members): they
  keep no tab bar.
- Any change to what the tabs are, their order or icons.
- An "unsaved changes" prompt on leaving the expense form.
- Restyling the header, the form or the category page beyond the one label.

## Notes

- Today the root `Stack` (`app/_layout.tsx`) puts `expense` (as a `modal`) and
  `category/[categoryId]` above `(tabs)`, which is why they cover the bar.
- Two ways to get the bar there; the planner picks, the first looks lighter:
  1. Extract the tab bar into a shared component and render it at the bottom of these two
     screens, navigating with `router.navigate('/(tabs)/…')` (after dismissing the
     child), sharing the `TABS` list and badge logic with `(tabs)/_layout.tsx` so they
     can't drift.
  2. Move the child routes into per-tab nested stacks inside `(tabs)` so the real bar
     stays. Bigger move; the expense form is opened from Expenses and category
     detail, so it'd need a copy per stack.
- A tab bar on a `modal` presentation looks odd on iOS (sheet over a bar). The expense
  form likely becomes a normal pushed screen — that fits "Back" too. Confirm in the plan.

## Open questions

- Should the expense form stay a bottom sheet (modal) on iOS, or become a regular pushed
  page with the tab bar? Recommendation: regular page.
