# Budget header: Home button

Type: feature

## Why

The Expenses tab's header has a Home button on the left (brief 027). The Budget tab's header has an empty space
there, so the two month pages look and behave differently. The user wants the same button on Budget.

## What

Header of the Budget tab (`(tabs)/budget.tsx`), left to right:

- **Left: Home button.** The same house icon, colour, size and hit area as on Expenses. Tapping it does what the
  Home tab does: it switches to the Home tab and pushes no screen.
- **Centre: month switcher**, unchanged and still centred.
- **Right: the "+" add-category button**, unchanged (hidden for an ended month and before the month loads).

## Acceptance criteria

- [ ] Web (390×844): the Budget header shows the house button at the left, the month switcher centred, and "+" at
      the right, matching the Expenses header.
- [ ] Tapping the house button shows Home, with the Home tab icon active and no Back to Budget.
- [ ] The house button has the accessible name "Home" and a 44×44 hit area.
- [ ] The month switcher stays centred, and nothing overlaps at 375 px, for a current month and an ended month (no
      "+").
- [ ] iPhone (Expo Go) checked by the user, light and dark.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Headers of other screens (Statistics, Settings, Category, the modal screens).
- Any change to the month switcher, the "+" button or the rest of the Budget tab.

## Notes

- Expenses' button: `(tabs)/expenses.tsx`, a `Pressable` with `router.navigate('/')` and `<Icon name="home" />` in
  `colors.muted`, inside the left `side` view. Budget's left `side` view is empty today.
- With two copies, a shared Home button component is a natural extract (consolidation).
