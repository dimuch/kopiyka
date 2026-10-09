# Home screen and tab navigation

Type: feature

## Why

The app opens straight into the month's expenses by category, and there is nowhere to
put the pages that are coming next (budgets, statistics, settings). We need a home
screen that leads to every section, and a persistent way to move between them.

## What

- **Bottom tab bar** with 5 icons: Home, Budget, Expenses, Statistics, Settings. The
  icon of the current page is in its active state (accent colour); the others are
  muted. Tapping an icon switches to that page.
- **Home** (the first screen after sign-in) shows 4 cards — Budget, Expenses,
  Statistics, Settings. Each card has an icon, a title and one live figure. Tapping a
  card switches to that tab, exactly like tapping its tab icon.
- **Expenses** tab = today's home screen, unchanged (month switcher, spent total,
  categories with spent amounts), except for the add button below.
- **Add expense = "+" in the header.** The floating "Add expense" button is removed
  everywhere. Instead a "+" icon button sits at the right of the top header on
  Expenses and on category detail (where it pre-selects that category, as today).
- **Budget**, **Statistics** tabs = placeholder pages (title + "coming soon" text).
- **Settings** tab = placeholder plus "Signed in as <username> · Sign out", moved from
  the bottom of today's home screen.
- **Parent vs child pages.** The tab bar shows only on the 5 tab pages. Child pages —
  category detail and the add/edit expense form — hide it. Category detail keeps its
  back arrow at top left, and iOS swipe-back works on it. (The add/edit form stays a
  modal in this brief; making it a child page is brief 020.)

Live figures on the Home cards (current Kyiv month):

| Card       | Figure                                            |
| ---------- | ------------------------------------------------- |
| Expenses   | Spent this month, e.g. "€412.30"                  |
| Budget     | "Not set" (budgets don't exist yet)               |
| Statistics | Number of expenses this month, e.g. "23 expenses" |
| Settings   | Signed-in username                                |

While the month loads, figures show "—"; on a load error the cards still navigate and
show "—" (no error block on Home).

## Acceptance criteria

- [ ] Given I sign in, then I land on Home with 4 cards and a 5-icon tab bar where
      Home is active.
- [ ] Given I'm on Home, when I tap a card, then that tab's page shows and its tab icon
      is active.
- [ ] Given I'm on any tab page, when I tap another tab icon, then that page shows and
      only its icon is active.
- [ ] The Expenses tab shows everything today's home shows (month switching, totals,
      categories) and behaves the same, except adding an expense.
- [ ] There is no floating "Add expense" button anywhere. A "+" at the right of the
      header on Expenses opens the add form; on category detail it opens the add form
      with that category pre-selected.
- [ ] The Expenses card shows this month's spent total, matching the Expenses tab's
      "Spent this month"; the Statistics card shows this month's expense count; the
      Settings card shows the username; the Budget card shows "Not set".
- [ ] Given I open a category from Expenses, then the tab bar is hidden, a back arrow is
      top left, and back (arrow or iOS swipe) returns to Expenses with the tab bar.
- [ ] Given I open the add/edit expense form, then the tab bar is not visible over it.
- [ ] Sign out works from Settings and is no longer on the Expenses page.
- [ ] Works on web at phone width and on iPhone (Expo Go).

## Out of scope

- Real content for Budget and Statistics.
- Turning the add/edit expense modal into a child page (brief 020).
- Settings options beyond sign out.
- Any API change.

## Notes

- Expo Router: a `(tabs)` group with a tab layout; child routes stay in the root Stack
  above it so they cover the tab bar. JS `Tabs` vs `NativeTabs` is the planner's call —
  it must work on web too.
- Icons: add the 5 tab icons to `components/Icon.tsx` in the same 24×24 stroke style.
- Deep links to `/category/...` and `/expense` must keep working; `router.replace('/')`
  fallbacks in child pages should land somewhere sensible (Home or Expenses).
