# Screen readers on web hear which option is selected

Type: fix

## Why

On the web build, controls don't tell a screen reader their state. A radio row in the ledger or appearance picker is
read as "radio button" but never as checked. A category chip never reads as selected. The ⋯ menu button never says
whether its menu is open. Busy buttons never say they're busy. Sighted users see all of this, and iPhone VoiceOver
hears it, but someone using a screen reader in a browser doesn't.

The cause: the app sets these states with `accessibilityState={{ … }}`. React Native on iOS reads that, but
react-native-web 0.21 ignores it, so no `aria-checked`, `aria-selected`, `aria-expanded` or `aria-busy` reaches the
page. React Native's own `aria-*` props (`aria-checked`, `aria-selected`, `aria-expanded`, `aria-busy`,
`aria-disabled`) work on both: on iOS, `View` and `Pressable` turn them into the same accessibility state as today, and
react-native-web renders them into the page.

## What

- Every control that sets `accessibilityState` sets the same states with the `aria-*` props instead, with the same
  values. Today that's:
  - checked: `LedgerPicker`, `AppearancePicker`
  - selected: `CategoryPicker`
  - expanded: the ⋯ menu button on the category page
  - busy and disabled: the buttons on login, expense, income item, members, delete category, `NotionSyncPanel` and
    `EmptyMonth`
- On iPhone, nothing changes: VoiceOver reads each control exactly as it does today.
- On web, the page's accessibility tree shows each state: `aria-checked`, `aria-selected`, `aria-expanded`,
  `aria-busy` and `aria-disabled`, each with the right value.
- Lint stops `accessibilityState` from coming back, with a message that says to use the `aria-*` props.

## Acceptance criteria

- [ ] Given the web build, when I open Settings, then the selected appearance and ledger rows have
      `aria-checked="true"` and the others `aria-checked="false"`.
- [ ] Given the web build, when I open the expense form, then the chosen category chip has `aria-selected="true"`.
- [ ] Given the web build, when I tap ⋯ on a category page, then the button has `aria-expanded="true"` while the menu
      is open and `"false"` when it's closed.
- [ ] Given the web build, when the sign-in button can't be pressed yet, then it has `aria-disabled="true"`.
- [ ] Given the iPhone app with VoiceOver, then the same controls announce the same states as before.
- [ ] `accessibilityState` appears nowhere in `apps/mobile/src`, and lint fails if it's added.

## Out of scope

- `accessibilityHint` (react-native-web has no equivalent) and `accessibilityLabel` / `accessibilityRole`, which
  already reach the page.
- Any other accessibility audit or change in look or behaviour.
- The Statistics period menu on the unmerged `feat/statistics-period-dropdown` branch. Whichever branch merges second
  converts it; the lint rule makes sure that happens.

## Notes

- Checked in the installed code: `react-native` 0.88.1 `View.js` and `Pressable.js` merge `aria-busy`/`checked`/
  `disabled`/`expanded`/`selected` into `accessibilityState`; `react-native-web` 0.21.4 `createDOMProps` renders the
  `aria-*` props and has no `accessibilityState` mapping.
- Found during the Statistics browser check (`docs/features/094-statistics-period-dropdown/outcome.md`, Follow-ups).
- Local QA user for signed-in web checks: `qa-user`, secret in the gitignored `apps/api/.env.qa`.
