# Plan: Interaction states and Back

Status: approved

Brief: ./brief.md
Branch: fix/interaction-states
Base: origin/main@9f6b4fc

## Approach

A mix, because neither half can do the other's job. Two thin shared components carry what must work on iPhone, and one
web-only `<style>` carries what only CSS can do.

- `TextField` wraps `TextInput`: the caller's style first, then an accent `borderColor` while focused (9 tags).
- `Pressable` (ours) wraps RN's: dims while pressed. Call sites keep their JSX; only the import line changes (60 of 61).
- `FocusStyles`, rendered once in `Root`, is the web edge: it removes the browser ring on inputs and draws the keyboard
  ring on everything else, including the library tab bar and modals, which no wrapper reaches.

Selected state is a two-line style change and the labels are a rename.

Alternative considered: ring through Pressable's `style` function with `outline*` styles. It lost because `focused` is
plain focus (a mouse click would ring too), `focusVisible` doesn't exist, and a wrapper can't reach the library tab bar.
A web-only stylesheet alone also lost: iPhone needs press feedback and field focus, and CSS doesn't exist there.

### Facts checked in node_modules (react-native-web 0.21.3, RN 0.86.3)

- RNW Pressable's state is `{ hovered, focused, pressed }`. `focused` follows `onFocus`, so it is true on mouse focus.
  RN's type is `{ pressed }` only. Neither has `focusVisible`, so `:focus-visible` is the only keyboard-only signal.
- RN types `outlineStyle` as `'solid' | 'dotted' | 'dashed'`, so `'none'` doesn't typecheck, and RN styles have no
  pseudo-state. Removing the input ring therefore needs CSS.
- A rendered probe gave `<button role="button">` for `accessibilityRole="button"`, `div[role=radio]` and `div[role=tab]`
  with `tabindex=0`, and `tabindex=-1` for disabled. All match one selector.
- `[{opacity:.6},{opacity:.4}]` compiles to the `.4` class: the later style wins.
- RN and RNW both refuse the responder when `disabled`, so a disabled Pressable never reports `pressed`.
- The CSP has `style-src 'self' 'unsafe-inline'` (`deploy/kopiyka.englishplus.com.ua.conf:45`), so an inline `<style>`
  is allowed. `app.json` has `web.output: single`, so there is no `+html.tsx` or SSR to consider.
- Library tabs get `pressOpacity: 1` (`BottomTabItem.js:112`), so they have no press feedback today. `tabBarButton`
  receives that prop and can override it. Our `Tabs.Screen`s don't use `href`, so `TabsClient`'s guard doesn't apply.
- Scratch `tsc` passes for both wrapper shapes, `createElement('style', ...)`, and the `tabBarButton` lambda with
  `PlatformPressable` from `expo-router/react-navigation`.

### Why the ring is inset (headless Chrome, 390 wide, scratch HTML)

Most screens pad 20 outside their ScrollView (no-ledger pads 24 inside it), and RNW's ScrollView is `overflow-x: hidden`, so full-width content sits
flush against the clip edge.

| Ring                                        | Result                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `outline-offset: 2px`                       | Left and right sides cut off on Save, Sign out, Invite; also in `expenses` card |
| `outline-offset: -2px` alone                | Never clipped, but invisible on the 8 accent-filled buttons                     |
| `-2px` + `box-shadow: inset 0 0 0 4px` (bg) | Whole ring on every kind: filled, outlined, chips, rows, icon boxes             |

The third needs no per-site edits and no layout change. It also covers an element's own border, so a selected chip
shows one line. It overlaps glyphs on buttons with no side padding, so those get padding (slices 2 and 5).

## Contracts

- DB: none
- API: none
- App:
  - `components/TextField.tsx`:
    `TextField(props: Omit<ComponentPropsWithRef<typeof TextInput>, 'onFocus' | 'onBlur'>)`. No caller passes either
    handler, so they aren't composed. `ref` passes through in `rest` (CategoryForm uses it).
  - `components/Pressable.tsx`: `Pressable(props: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> })`,
    and `export const pressedOpacity = 0.6`. No site passes a style function or a `ref`, so neither is supported.
    Style order is `[pressed && styles.pressed, style]`, so a caller's opacity wins.
  - `components/FocusStyles.tsx`: `FocusStyles()`, no props, reads `useColors()`. Returns `null` off web, otherwise
    `createElement('style', null, css)` (`createElement` as in `DateField`). One caller, but it keeps the `Platform.OS`
    branch at an edge like `PhoneColumn` and out of `_layout.tsx`. Re-rendering follows the theme, so no effect or CSS
    variable is needed.
- Reuses: `useColors`, the `createElement` web pattern from `DateField`, `PlatformPressable`, the `back` padding from
  `members.tsx`/`category/[categoryId].tsx`, existing `accent`, `accentTint`, `bg` tokens (no new colours).
- New dependencies: none

## Slices

- [x] 1. Show an accent border on focused text fields, without the browser ring (~60 lines)
  - Files: new `components/TextField.tsx`, `components/FocusStyles.tsx`; `app/_layout.tsx` (render `<FocusStyles />` as
    the first child of `SafeAreaProvider`); swap the tag in `AmountFields`, `CategoryForm` (2), `login` (2), `members`
    (2), `expense`, `income-item`.
  - Change: CSS is `input:focus { outline: none; }`. Focus adds only a border colour after the caller's style, so
    AmountField's `paddingLeft: 32` under the ₴/€ overlay, CategoryForm's `amount`, and login's `passwordInput` array
    are untouched. All six input styles have `borderWidth: 1`, so nothing shifts. `CategoryForm` keeps `TextInput` as
    the ref type only.
  - Verify: web 390×844, dark and light: focus each of the fields listed under AC1. Only the accent border shows, the
    symbol stays in place, and blur restores the border. `income-item` and `category-form` open with the autofocused
    field already accent.

- [ ] 2. Show one accent ring on keyboard focus on web (~12 lines)
  - Files: `components/FocusStyles.tsx`; `app/expense.tsx`, `components/LoadError.tsx`, `app/no-ledger.tsx`.
  - Change: add `:not(input):focus-visible { outline: 2px solid <accent>; outline-offset: -2px; box-shadow: inset 0 0 0 4px <bg>; }`.
    Add `marginLeft: -8, paddingHorizontal: 8` to `back` and `check`, so the text doesn't move and the ring clears it.
    `retry` gets `paddingHorizontal: 8` only, because LoadError sits inside ScrollViews with no side padding and a
    negative margin would push its left edge past the clip. Its text moves 8 pt right.
  - Verify: Tab through the screens under AC2 in both themes: one ring per stop, none clipped, none on mouse click.
    Check that the ring clears the text on NotionSyncPanel's `retry` (minWidth 44, no side padding).

- [ ] 3. Dim buttons and rows while pressed (~90 lines, almost all import lines)
  - Files: new `components/Pressable.tsx`; import swap in the 29 files with Pressables except `PhoneColumn`;
    `app/(tabs)/_layout.tsx`.
  - Change: `tabBarButton: (props) => <PlatformPressable {...props} pressOpacity={pressedOpacity} />` in `screenOptions`.
  - Special cases:
    - `PhoneColumn`'s backdrop stays on RN's Pressable: aria-hidden, out of the tab order, nothing drawn to dim, and a
      mouse click doesn't match `:focus-visible`.
    - Scrims (`CategorySheet`, `DateField`, `CategoryMenu`) take the wrapper with their files. They are empty, so the
      dim shows nothing; the sheet closing is their feedback.
    - Busy and disabled sites never report `pressed`.
    - `login` is the one dimmed site with no `disabled` prop: while not ready it reports `pressed`, and its 0.4 wins
      because it comes later, so it can't brighten.
  - Verify: `rg -n "^\s+Pressable,$|\bPressable\b.*from 'react-native'" apps/mobile/src` lists only `PhoneColumn` and
    the wrapper. Web: press and hold each kind under AC3; then the not-ready Sign in stays at 0.4.

- [ ] 4. Match the selected Appearance option to the category and date chips (~2 lines)
  - Files: `components/AppearancePicker.tsx`.
  - Change: `optionOn` border `accentLine` → `accent`; `labelOn` becomes `{ color: colors.text }` (see Open questions).
    `LedgerPicker` is untouched. `accentLine` stays, the "Added" note uses it.
  - Verify: Settings and the expense form side by side in both themes: same border, tint and text.

- [ ] 5. Say Back instead of Cancel on the income, category and Members screens (~25 lines)
  - Files: `app/income-item.tsx`, `app/category-form.tsx`, `app/delete-category.tsx`, `app/members.tsx`.
  - Change:
    - Three headers: label to Back, `cancel`/`cancelText` → `back`/`backText`, `back` gains
      `marginLeft: -8, paddingHorizontal: 8` like `expense` after slice 2.
    - `members.tsx` already has `styles.back`, so the panel's `cancel`/`cancelText`/`onCancel` become
      `dismiss`/`dismissText`/`onDismiss`, which also fits Close. Text is `gone ? 'Close' : 'Back'`.
    - Handlers and `presentation: 'modal'` don't change.
  - Verify: `rg -n "Cancel" apps/mobile/src` has no user-visible hit. Each Back leaves as Cancel did; the busy state
    still blocks it; Close still shows for a person or invite already gone.

Tests: nothing here is pure logic. It is all wiring and styles, and the app's Vitest runs in Node with no renderer, so
no new test file. Gates run per slice, as in conventions §7.

## AC → evidence

| AC                                    | Evidence                                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fields show only the accent border    | Web 390×844, dark + light, computed `outline-style: none` and accent `border-color` on: login username, password; expense name, UAH, EUR; income title, amount; category name, amount; Members label, invite                                                                                                  |
| Tabbing shows one accent ring         | Web, Tab through: login; Budget (arrows, rows, edit, tab bar); expense form (chips, tiles, Save, Delete); category sheet (scrim, close, items); Settings (radios, Members, Sign out); Members (Save, Invite, Remove, panel); pushed-page `TabBar`; LoadError Retry on Budget and Members with the API stopped |
| Pressing gives visible feedback (web) | Hold-press and normal click on: filled and outlined buttons, icon button, chip, radio, list rows on Budget, Expenses, Income, category page, library tabs, `TabBar`                                                                                                                                           |
| Selected options look the same        | Slice 4 side-by-side check, both themes                                                                                                                                                                                                                                                                       |
| No screen says Cancel                 | Slice 5 `rg` plus opening the four surfaces                                                                                                                                                                                                                                                                   |
| iPhone: field focus and press         | Expo Go: focus login, expense and category fields; press a button, row, tab; open `income-item` and check it's still a modal                                                                                                                                                                                  |
| `format:check`, lint, typecheck, test | Run after each slice, exit codes read directly                                                                                                                                                                                                                                                                |

## Not doing (YAGNI)

- Hover styles, disabled-state styling, new colours (brief).
- Read-only fields stay focusable on web and show the border; changing that is disabled-state work.
- A shared header Back component, or moving ScrollView padding inward so the ring could sit outside.
- A `no-restricted-imports` rule for RN's `Pressable`/`TextInput`.
- Per-kind ring variants, and an `outline*` opt-out for filled buttons.

## Risks

- A press shorter than 50 ms shows no dim on web: RNW delays `pressed` 50 ms, and a faster release activates and
  deactivates in one tick. iPhone holds at least 130 ms (`Pressability`). Slice 3 checks a normal click; if the dim is
  too brief, add an `:active` opacity rule to `FocusStyles` and record it under Deviations.
- The bg band reads as a second ring to the user, against "one clean accent ring". Slice 2 shows it on filled buttons;
  the fallback is in Open questions.
- `react/display-name` or a compiler lint may object to the inline `tabBarButton`. Slice 3's lint proves it; the
  fallback is a module-level function typed from `tabBarButton`'s parameters.
- A library focus surface may behave unexpectedly under the global selector (RNW's modal focus brackets, or a scroller
  Chrome makes focusable). Brackets only hold focus transiently; slice 2's Tab pass through the category sheet proves
  that. The sheet has no ScrollView, so slice 2 also Tabs once through `delete-category` in its `gone` state, in a window
  short enough to overflow: that scroller has no focusable child.
- `onFocus` may not fire for `autoFocus` on iPhone or web. Slice 1 checks `income-item` and `category-form` on both;
  the fallback is `useState(!!autoFocus)` in `TextField`.

## Open questions

- Decided at Gate A (accent with a gap) — Filled buttons can't show a pure accent ring inset, because accent on accent is invisible. What shows
  is an accent edge, a 2px band in `bg`, then the fill. Assumed acceptable as "one accent ring". The alternative is an
  `onAccent` ring through `outlineColor` on the 10 filled styles, about 10 lines.
- Not blocking — "Look the same": the brief names accent border and tint, but Appearance's selected label is also accent
  and semibold, where chips keep `text` and medium. Assumed the label should match too, so `labelOn` is `text` only.
- Not blocking — The library tab bar isn't among the audit's 61 Pressables. It is included because the AC says any button.
- Note — The audit's 10 `TextInput`s are 9 JSX tags; the tenth hit is `useRef<TextInput>`. The 61 Pressables are right.

## Follow-ups

- Propose a conventions §5 line (and perhaps a lint rule) saying new UI uses `@/components/Pressable` and `TextField`.
- The 52 pt header spacer no longer matches the Back width, so titles sit about 6 pt left of centre, as `expense` already
  did by more. Left as is.

## Deviations

- slice 1: no `useState(!!autoFocus)` fallback. `onFocus` fires for `autoFocus` on web when the page has focus (checked by opening `income-item` from the Income tab); it looked missing only in a test pane without focus. iPhone is checked at Gate B.

## Consolidate
