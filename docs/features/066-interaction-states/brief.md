# Interaction states and Back

Type: fix

## Why

The app draws almost no interaction states of its own. No text field has a focus style, so the browser's default
`outline: auto` ring sits over the field's unchanged border: a double ring whose colour depends on the browser, blue
and white on the user's screen, orange in a test. On iPhone only the caret shows. None of the buttons and rows
responds visually to a press. Selected options don't match each other. Screens also still say Cancel where the
expense form was changed to Back.

## What

- **Text fields:** a focused field gets an accent-coloured border on web and iPhone, and the browser's ring goes away.
- **Buttons and rows:** every one visibly responds when pressed.
- **Keyboard on web:** focus shows one clean accent ring that follows the element's rounded shape. The ring stays so
  the web app can still be used by keyboard.
- **Selected state:** the Appearance picker matches the category and date chips (accent border and tint). The ledger
  picker stays green, because it has its own theme colours for the open ledger.
- **Labels:** the headers of the income, category and remove-category screens say Back instead of Cancel, and the
  Members confirm panel's Cancel becomes Back. They do the same thing as before. The panel's Close, shown when the
  person or invite is already gone, stays.

## Acceptance criteria

- [ ] Web at 390×844, dark and light: every text field shows only the accent border when focused, with no double ring.
- [ ] Web: tabbing through a screen shows one accent ring on each button.
- [ ] Web and iPhone: pressing any button or row gives visible feedback.
- [ ] Selected Appearance, category and date options look the same.
- [ ] No screen says Cancel.
- [ ] iPhone (Expo Go): field focus and press feedback work.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Disabled-state styling.
- New colours.
- Hover effects beyond what the shared press style gives.
- Changing how these screens open: the renamed screens stay modals on iPhone.

## Notes

Audit, 2026-11-04: 10 `TextInput`s and 61 `Pressable`s, none with a focus or pressed style. The ring was confirmed on
the login screen on web (`outline-style: auto`, the border unchanged). The other screens were read from code.
