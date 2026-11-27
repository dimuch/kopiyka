# Kopiyka design system

Direction **A · Card per row**, chosen 2026-11-22. The look is light, plain and borderless. Each
category or item sits on its own white card on a pale grey page, and soft shadows replace
borders. Violet is the only brand colour and is used sparingly. Everything else is near-black,
white and violet-tinted greys.

It borrows principles, not branding, from Shop (shop.com and the Shop app), which the user
liked:

- pale page, white cards and soft shadows instead of borders
- round corners and pill-shaped controls
- tight, heavy headings
- a single violet accent
- a floating pill tab bar

Kopiyka uses its own violet (`#6D4AFF`), not Shop's `#5433EB`. It uses no Shop assets or wording.

This file is the source of truth for values. The code lives in `apps/mobile/src/theme.ts`, which
is the only place raw colours, font names and sizes may appear (conventions §2).

## Principles

1. **No borders by default.** Cards are separated by spacing, a white card on a grey page, and
   one soft shadow. A hairline is allowed only where two same-colour surfaces touch, such as an
   input on a white sheet.
2. **One violet.** Violet marks the main action, progress, selection and the "left" figure.
   Everything else is neutral, and there is at most one violet button per screen.
3. **Numbers are the content.** Every money figure uses tabular digits and a text role from the
   type scale, never an ad-hoc size.
4. **Tokens, not numbers.** Screens read spacing, radius, type and shadow from tokens. A raw
   number in a style is a review finding, except for one-off layout maths.
5. **Accessible by construction.** Text is at least 4.5:1, bars and icons at least 3:1, and touch
   targets at least 44pt. Every pair below has been checked. The one exception is the light
   `caution` bar, which always comes with text next to it (see "Caution is the same yellow").

## Colour (light)

| Token                   | Value                 | Use                                                   | Checked                                             |
| ----------------------- | --------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `bg`                    | `#F7F7F8`             | page                                                  | —                                                   |
| `surface`               | `#FFFFFF`             | cards, sheets                                         | —                                                   |
| `fill`                  | `#F0EFF4`             | grey pill buttons, inputs, chips                      | text 16.6:1, muted 4.7:1                            |
| `track`                 | `#ECEAF2`             | progress track                                        | —                                                   |
| `text`                  | `#111014`             | primary text                                          | 17.7:1 on `bg`                                      |
| `muted`                 | `#6B6780`             | secondary text                                        | 5.1:1 on `bg`                                       |
| `faint`                 | `#8E8A9E`             | minor icons only, never text                          | 3.3:1                                               |
| `accent`                | `#6D4AFF`             | main button, bars, selection                          | 5.2:1 on white, 4.3:1 on `track`                    |
| `onAccent`              | `#FFFFFF`             | text on `accent`                                      | 5.2:1                                               |
| `accentTint`            | `#EEE9FF`             | chips, selected rows                                  | —                                                   |
| `accentText`            | `#4C2FC9`             | text on `accentTint`                                  | 6.9:1                                               |
| `caution`               | `#F2C94C`             | bar from 90% of plan up to plan (same yellow as dark) | 1.3:1 on `track`: **accepted exception**, see below |
| `cautionText`           | `#8A6600`             | the "€15 left" label on near-plan rows                | 5.3:1 on white                                      |
| `danger`                | `#C23B31`             | over plan, delete                                     | 4.4:1 on `track`, 5.3:1 on white                    |
| `active` / `activeTint` | `#1B7A3D` / `#E3F4E8` | open ledger                                           | 4.7:1                                               |
| `hairline`              | `rgba(17,16,20,0.06)` | the rare border                                       | —                                                   |
| `backdrop`              | `rgba(17,16,20,0.35)` | sheet scrim                                           | —                                                   |

**Progress bars** go from under plan to over plan as `accent` (violet) → `caution` → `danger`.
This replaces brief 091's green for under-plan bars. Brief 105 made that change.

**Caution is the same yellow in both themes** (user decision, 2026-11-22). In light it fails
brief 091's 3:1 bar rule, so colour is never the only signal. Brief 107 made the change and
records the exception to 091. Brief 105 added the caution label: a near-plan row shows, for
example, "€15 left" in `cautionText`, just as an over-plan row shows "€9 over".

## Colour (dark, first pass)

`bg #0E0D12`, `surface #18171D`, `fill #211F27`, `track #2A2832`, `text #EDECF2`,
`muted #A3A0B2` (7.0:1), `accent #A08CFF` (6.5:1 on surface, 5.3:1 on track),
`onAccent #0E0D12` (7.1:1), `accentTint #241D45`, `accentText #C9BDFF` (9.1:1). Keep today's
`caution #F2C94C` and `danger #FF8A80`. In dark, `cautionText` is also `#F2C94C`
(11.2:1 on `surface`). `faint`, `active`, `activeTint` and `backdrop` aren't set here, so
they keep their values from before brief 105 (`#6E757E`, `#6FD08C`, `#132A1C`,
`rgba(5,6,8,0.62)`). `hairline` is `rgba(237,236,242,0.06)`, dark `text` at 6% as light's is
light `text` at 6% (1.12:1 on `bg`, 1.16:1 on `surface`; light's is 1.13:1 on both). In dark
mode, shadows are off: elevation comes from `surface` being lighter than `bg`.

## Type

Inter (`@expo-google-fonts/inter`, weights 400, 500, 600 and 800) replaced Bricolage Grotesque
and IBM Plex Sans (brief 105b). Letter spacing is negative and grows tighter with size.

| Role         | Size / line | Weight | Tracking | Use                          |
| ------------ | ----------- | ------ | -------- | ---------------------------- |
| `display`    | 28 / 34     | 800    | −1       | screen title, hero figure    |
| `title`      | 22 / 28     | 800    | −0.8     | month name, sheet title      |
| `heading`    | 17 / 22     | 600    | −0.4     | section heads, card titles   |
| `body`       | 15 / 20     | 400    | −0.2     | default text                 |
| `bodyStrong` | 15 / 20     | 600    | −0.2     | row names, amounts           |
| `label`      | 13 / 18     | 500    | −0.1     | buttons, chips, field labels |
| `caption`    | 12 / 16     | 400    | 0        | notes, "of €120"             |
| `input`      | 16 / —      | 400    | −0.2     | typed text (min 16)          |

`input` sets no line height, because fields are single-line and centred by their 48pt height. Below
16px, iOS Safari zooms into a field on focus.

The money variants `amountLg` (`display` with tabular digits) and `amount` (`bodyStrong` with
tabular digits) are used for every figure.

## Spacing, radius, size

- **Space (4pt grid):** `xxs 2`, `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 20`, `xxl 24`, `xxxl 32`,
  `huge 40`.
- **Screen gutter:** `lg` (16). Gap between cards: `sm` (8). Card padding: `md` to `lg`.
- **Radius:** `sm 10` (category tile, small chip), `md 14` (input), `lg 20` (card), `xl 28` (sheet,
  hero), `pill 999` (buttons, chips, tab bar).
- **Control heights:** `control 48` (button, input), `iconButton 44` (touch minimum), `chip 32`.

## Elevation

React Native 0.88 supports `boxShadow` on iOS and web, so no library is needed.

| Token          | Light                            | Use                        |
| -------------- | -------------------------------- | -------------------------- |
| `shadow.card`  | `0 2px 8px rgba(17,16,20,0.06)`  | every card                 |
| `shadow.float` | `0 4px 24px rgba(17,16,20,0.12)` | tab bar, "+" button, toast |

Dark mode uses no shadows.

## Components

| Component        | Shape                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Text`           | `variant` prop from the type roles, plus four pairs: `bodyMedium` 500, `labelRegular` 400, `labelSemi` 600, `captionMedium` 500; colour defaults to `text` |
| `Card`           | `surface`, `radius.lg`, `shadow.card`, padding `md`; no border                                                                                             |
| `Button`         | pill, height 48; variants `primary` (accent), `secondary` (`fill` and `text`), `danger` (`fill` and `danger` text)                                         |
| `IconButton`     | 44×44 round; `plain` or `raised` (white and `shadow.card`)                                                                                                 |
| `Chip`           | pill, height 32; `fill` background, or `accentTint` with `accentText` when selected                                                                        |
| `ScreenHeader`   | back or home button, `title`, one trailing action                                                                                                          |
| `ProgressBar`    | 4pt track, rounded, with an 8pt dot at the end of the fill                                                                                                 |
| `TabBar` (later) | floating pill, `shadow.float`, plus a separate round "+" button                                                                                            |

Text buttons have no fill: the label in `danger`, `muted` or `accent`, 44pt high. Every button dims to 0.4 while busy
or disabled, and a busy one shows a spinner before its label. A chip's touch area is 44pt high around its 32pt pill.

## Roll-out (one brief each, in order)

1. **103 · Tokens and text roles** (split into 103 tabs, 103b components, 103c/103d other screens): add
   the token objects and move styles onto them. Only small shifts from snapping to the scale;
   each PR lists the ones over 2pt.
2. **104 · Shared components** (split into 104–104f): `Text`, `Card`, `Button`, `IconButton`, `Chip`, `ScreenHeader`
   and `ProgressBar`, replacing the copied styles. Nothing visibly changes.
3. **105 · The fresh look:** the new palettes, Inter, radii, shadows, borders removed, one card
   per category row and violet bars. Most of it is a `theme.ts` change because 103 and 104 came
   first.
4. **106 · Floating tab bar** with a "+" (add expense) button.
