# Plan: Shared components, part 3: outlined and text buttons through Button

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/text-buttons
Base: origin/main (4acc04d, version 1.23.3)

## Approach

`Button` gains four looks as new `variant` values: `outlinedDanger`, `dangerText`, `mutedText` and `accentText`. The
brief's buttons move onto it at the sizes that already exist: `medium` (48) and `compact` (44). Each caller keeps only
its layout, plus any padding that differs from the size, in the `style` it already has. `outlinedDangerButton`,
`outlinedDangerText` and `dangerText` then leave `theme.ts`. The category ⋯ menu row writes out `dangerText`'s look as
its own style.

**Size.** I made every edit in a scratch copy of `apps/mobile` and ran it through the repo's Prettier, `tsc` and
ESLint (all clean, no warnings). It comes to **279 changed lines (117 added, 162 removed) in 12 files**. That's one PR
in 4 slices, each 120 lines or fewer. `demo-modules.txt` doesn't change: `Button` and `LoadError` are already in the
demo, and nothing new reaches it.

**Three rules keep today's look and accessibility record exactly** (all measured on Base, in Contracts):

- **The text looks have no corner.** They come after the size in the style array and set `borderRadius: 0`. Otherwise
  the size's pill would round their web focus ring and change the snapshots' radius column on every text button.
- **Only the filled looks dim while off.** Today none of the 7 disabled text buttons dims, except Decline. So Button
  dims `primary` and `danger` only, and Decline keeps its own `opacity: 0.6`, as it does today.
- **Only the filled looks take `busy`.** A props union lets only `primary` and `danger` take `busy` (still required)
  and `icon`. That way the text and outlined buttons never render `aria-busy`. react-native-web writes
  `aria-busy="false"` for `aria-busy={false}` (`createDOMProps`, `_ariaBusy != null`). None of these buttons has the
  attribute today, so a `false` would change AC5's record.

**Bolt-on check.** `filled && off` is a variant check inside a shared component. Had today's looks been designed
together, each look would still carry its own disabled rule. Writing that as a per-look table costs the same and reads
worse, so it stays one named line with a comment. Brief 105 unifies the disabled look and deletes it.

Alternatives considered:

- **`variant: 'outlined' | 'text'` plus a `tone`.** Every call site needs two props instead of one, and
  `tone` means nothing on `primary` and `danger`. `outlined` only ever has one tone, so the type would need a union to
  forbid the rest.
- **New text sizes for each padding** (4, 8, 12, 16, and 0 at 48). That's four sizes whose only job is a quirk 105
  removes. A text button is 44 or 48 tall, which `compact` and `medium` already are.

## Contracts

- DB / API / DTOs: none. `theme.ts` only loses the three helpers and the `ViewStyle` import; there's no new token.
- **`src/components/Button.tsx`** (changed; existing callers untouched):

  ```ts
  export type ButtonSize = 'large' | 'medium' | 'compact'; // unchanged
  /** primary, danger: filled, onAccent label, dim while busy or disabled. outlinedDanger: surface, 1pt borderStrong,
   *  danger label. dangerText, mutedText, accentText: only the label, no corner; disabled, they don't dim. */
  type ButtonVariant = 'primary' | 'danger' | 'outlinedDanger' | 'dangerText' | 'mutedText' | 'accentText';
  type Look =
    | { variant: 'primary' | 'danger'; busy: boolean; icon?: IconName }
    | { variant: Exclude<ButtonVariant, 'primary' | 'danger'>; busy?: never; icon?: never };
  export function Button(
    props: Look & {
      size: ButtonSize;
      label: string;
      onPress: () => void;
      disabled?: boolean; // default false
      accessibilityLabel?: string;
      style?: StyleProp<ViewStyle>; // applied last
    },
  ): React.JSX.Element;
  ```

  - Render: as today. The style becomes `[button, styles[size], styles[variant], filled && off && styles.off, style]`,
    so the look comes after the size; the filled looks and the sizes set disjoint keys, so the order doesn't change
    them. `aria-busy={busy}` (undefined for the non-filled looks). The label is
    `<Text style={[styles.label, styles[`${variant}Label`]]}>`.
  - Styles: `label: { textAlign: 'center', flexShrink: 1 }`. Per look:

    | Look             | Box                                                                                 | Label                                                              |
    | ---------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
    | `primary`        | `backgroundColor: colors.accent`                                                    | `...text.bodyStrong, color: colors.onAccent`                       |
    | `danger`         | `backgroundColor: colors.danger`                                                    | `...text.bodyStrong, color: colors.onAccent`                       |
    | `outlinedDanger` | `borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface` | `...text.bodyStrong, color: colors.danger`                         |
    | `dangerText`     | `bare`                                                                              | `...text.body, fontFamily: fonts.bodyMedium, color: colors.danger` |
    | `mutedText`      | `bare`                                                                              | `...text.body, fontFamily: fonts.bodyMedium, color: colors.muted`  |
    | `accentText`     | `bare`                                                                              | `...text.bodyStrong, color: colors.accent`                         |

    `bare` is `{ borderRadius: 0 }`, declared once in `makeStyles`, with the reason on the line above and then
    `eslint-disable-next-line no-restricted-syntax`. A literal `0` trips the style-number rule; I checked that in the
    draft.

  - Imports: the same five modules as today. `fonts` joins the `@/theme` import.
  - Checked with a scratch probe file: `dangerText` with `busy`, `primary` without `busy`, and `mutedText` with `icon`
    each fail `tsc` (TS2322). `accentText` with `disabled` and no `busy` compiles.

- **Call sites, measured on Base** ("→" is what the caller passes; `style` lists what the caller's style keeps):

  | #   | Site (file: style)                                    | Today                                                                                                          | → variant, size        | Other props / `style`                                                                                                                        |
  | --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
  | 1   | `(tabs)/settings`: `signOut`                          | `outlinedDangerButton` (height 48, pill, 1pt `borderStrong`, `surface`, centred) + mB 20; `outlinedDangerText` | outlinedDanger, medium | `style={styles.signOut}`: `{ marginBottom: space.xl }`                                                                                       |
  | 2   | `no-ledger`: `signOut`                                | the same helpers                                                                                               | outlinedDanger, medium | —                                                                                                                                            |
  | 3   | `members` MemberLeave: `leave`                        | the same helpers, label "Leave ledger"                                                                         | outlinedDanger, medium | —                                                                                                                                            |
  | 4   | `category-form` EditCategory: `remove`                | height 48, centred, no padding; `dangerText`; label "Remove from {Month}"; disabled while busy, **not dimmed** | dangerText, medium     | `disabled={busy}`                                                                                                                            |
  | 5   | `income-item`: `delete`                               | the same as 4, "Delete item"                                                                                   | dangerText, medium     | `disabled={busy}`                                                                                                                            |
  | 6   | `expense`: `delete`                                   | the same as 4, "Delete expense"                                                                                | dangerText, medium     | `disabled={busy}`                                                                                                                            |
  | 7   | `members` OwnerMembers: `remove`                      | min 44, minW 44, pad 4, content width in a row; `dangerText`; disabled while busy, not dimmed                  | dangerText, compact    | `accessibilityLabel={`Remove ${member.username}`}`, `disabled={busy}`, `style`: `{ minWidth: size.iconButton, paddingHorizontal: space.xs }` |
  | 8   | `members` PendingList: `remove`                       | the same as 7, "Revoke"                                                                                        | dangerText, compact    | `accessibilityLabel={`Revoke invite to ${invite.username}`}`, `disabled={busy}`, the same `style`                                            |
  | 9   | `PendingInvites`: `decline`                           | min 44, pad 12; body medium muted; disabled while any invite is busy, **0.6**                                  | mutedText, compact     | `accessibilityLabel` as today, `disabled={busy}`, `style={[styles.decline, busy && { opacity: 0.6 }]}`: `{ paddingHorizontal: space.md }`    |
  | 10  | `members` ConfirmPanel: `dismiss`                     | min 44, pad 12; body medium muted; "Back" / "Close"; disabled while busy, **not dimmed**                       | mutedText, compact     | `disabled={busy}`, `style`: `{ paddingHorizontal: space.md }`                                                                                |
  | 11  | `expense` LoadFailed: `back` (shared with the header) | height 44, pad 8, mL −8; **stretched full width** (column), word at the left                                   | mutedText, compact     | new `style={styles.failedBack}`: `{ justifyContent: 'flex-start', marginLeft: -space.sm, paddingHorizontal: space.sm }`                      |
  | 12  | `LoadError`: `retry`                                  | min 44, pad 8, `alignSelf: 'flex-start'`; bodyStrong accent                                                    | accentText, compact    | `style`: `{ alignSelf: 'flex-start', paddingHorizontal: space.sm }`                                                                          |
  | 13  | `no-ledger`: `check`                                  | the same as 12, plus mL −8                                                                                     | accentText, compact    | `style`: `{ alignSelf: 'flex-start', marginLeft: -space.sm, paddingHorizontal: space.sm }`                                                   |
  | 14  | `actual-end`: `secondary`                             | height 48, centred; bodyStrong accent; disabled while busy, not dimmed                                         | accentText, medium     | `disabled={busy}`                                                                                                                            |
  - **Corrections to the brief's table:**
    - Members' Back/Close doesn't dim while busy: `members.tsx:496` and the `dismiss` style have no opacity.
    - LoadFailed's Back is stretched across the row, not as wide as its word. It reuses the header's `back` style
      inside a plain `View`.
    - Retry isn't pulled left; Check for invites is.
    - The category form's label is "Remove from {Month}".
    - None of the 14 sets `aria-busy`.
  - **Prop values in use after this PR:**
    - Looks: `outlinedDanger` 3, `dangerText` 5, `mutedText` 3, `accentText` 3, `primary` 9, `danger` 2.
    - Sizes: `medium` 9, `compact` 9, `large` 7.
  - **Caller clean-up:**
    - Unused styles go: `signOutText`, `checkText`, `retryText`, `removeText`, `deleteText`, `secondaryText`,
      `leave`, `leaveText`, `dismissText`, `declineText`, no-ledger's `signOut`, category-form's `remove`,
      income-item's `delete`, expense's `delete` and actual-end's `secondary`. Sites 2, 4, 5, 6 and 14 pass no
      `style`, and lint doesn't catch unused StyleSheet keys.
    - Unused imports go:
      - `Pressable`: no-ledger, LoadError, PendingInvites
      - `size`: no-ledger, LoadError, PendingInvites
      - the helpers: settings, no-ledger, members, category-form, income-item, expense, `category/[categoryId]`
    - The `const styles` that ESLint then flags as unused goes too: in `category-form`'s EditCategory and `members`'
      MemberLeave.
    - `Button` is imported in settings, no-ledger, LoadError and category-form.

- **Category ⋯ menu row** (`category/[categoryId].tsx:273`): `menuDelete` becomes
  `{ ...text.body, fontFamily: fonts.bodyMedium, color: colors.danger }`, with the comment "A menu row, not a button
  (brief 104c), so it keeps its own style." `fonts` and `text` are already imported there.
- **Left as they are (exceptions, with reasons):**
  - **Login's Try it now and Request access** (Open question 2). `Link asChild` hands its child `href`, `role="link"`
    and, on web, `onClick` instead of `onPress` (expo-router 58.0.30, `BaseExpoRouterLink.js`, via `Slot`).
    `Button` passes only its own props on, so the links would lose their target and their click on web.
  - **UndoToast's Undo.** At 56pt only `large` fits, and `large` names itself (`accessibilityLabel = label`). Undo
    would gain an `aria-label`, which AC5 rules out, and it needs a dimming override too.
  - **DemoStrip's "Sign in"**: an expo-router `Link` drawn as `Text`, not a Pressable.
  - **The header Back buttons**: 104e.
  - **The other text-bearing pressables** (searched every `<Pressable` in `src`): Budget's Start → End line (a 13pt
    label with a pencil icon), Statistics' period button (label with a chevron), Settings' Members row, HomeCards, and
    the menu, radio, chip and option rows. None is one of these four looks.
- Reuses: `Button` (#160), `Pressable`, `useThemedStyles`/`useColors`, the tokens, and the 104 snapshot script with
  104b's changes (Visual check).
- New dependencies: none.

## Version

Bump: patch — 1.23.3 → 1.23.4
Why: §8b `patch`. It's a behaviour-preserving refactor of shipped app code: the same buttons, labels, roles and states,
with no new capability and no API, schema or connector change.

## Slices

Before slice 1, the orchestrator takes the **before** set on Base (Visual check). Line counts come from the scratch
draft.

- [ ] 0. Bump version to 1.23.4
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.23.4
- [ ] 1. Draw Sign out, Retry and Check for invites with Button (~118 lines)
  - Files: `src/components/Button.tsx`, `src/app/(tabs)/settings.tsx`, `src/app/no-ledger.tsx`,
    `src/components/LoadError.tsx`
  - Change: the four looks, the props union and the style order (Contracts); sites 1, 2, 12 and 13. Rewrite
    Button's JSDoc ("An accent (`primary`) or `danger` button …") and the `ButtonSize` comment ("Today's filled-button
    sizes"), which the new looks make wrong. Drop no-ledger's `signOut` style.
  - Verify: gates; `yarn mobile export:web && yarn mobile check-builds` passes with no `--accept`. Snapshots:
    `settings`, `expense-load-error` (Retry only, since Back moves in slice 2; compare its Retry rows). To show the
    filled buttons don't change, also `category-form-edit`, `income-item-edit`, `expense-edit` and `actual-end-set`
    (`large`), and `members-owner` (`medium` Save and Invite).
- [ ] 2. Draw the forms' delete, Use calculated end and LoadFailed's Back with Button (~51 lines)
  - Files: `src/app/category-form.tsx`, `src/app/income-item.tsx`, `src/app/expense.tsx`, `src/app/actual-end.tsx`
  - Change: sites 4, 5, 6, 11 and 14. Drop the `remove`, `delete` (×2) and `secondary` styles.
  - Verify: gates. Snapshots: `category-form-edit`, `income-item-edit`, `expense-edit`, `expense-delete-busy`,
    `actual-end-set`, `expense-load-error` (the one expected difference, What moves).
- [ ] 3. Draw the Members and invite text buttons with Button (~78 lines)
  - Files: `src/app/members.tsx`, `src/components/PendingInvites.tsx`
  - Change: sites 3 and 7–10.
  - Verify: gates. Snapshots: `members-owner`, `members-confirm`, `members-confirm-busy`, `members-member`,
    `no-ledger`, `no-ledger-decline-busy`.
- [ ] 4. Remove the danger button helpers from theme.ts (~32 lines)
  - Files: `src/theme.ts`, `src/app/category/[categoryId].tsx`
  - Change: the menu row gets its own style (Contracts); delete the three helpers and the `ViewStyle` import.
  - Verify: gates. `rg -n "dangerText|outlinedDanger" apps/mobile/src/theme.ts` finds nothing, and
    `rg -n "dangerText\(|outlinedDangerButton|outlinedDangerText" apps/mobile/src` finds nothing. Then the demo
    check, and the category page's ⋯ menu in both themes (the "Remove from …" row looks as before).

Every slice runs `yarn format:check && yarn lint && yarn typecheck && yarn test`, unpiped. In this worktree, export
`DATABASE_URL_TEST` from the main checkout's `.env`, or the API integration tests skip. There are no unit tests to add,
because no pure logic changes (§6: UI is checked in the browser).

## What moves (the PR lists this)

- **One snapshot difference:** `expense-load-error`, light and dark. LoadFailed's Back keeps its full-width box and
  the word stays where it was. Its text element shrinks from the row's width to the word's, because the label now sits
  in a row instead of a stretched column. That's **2 rows** in all.
- **Not caught by the snapshots, and listed:**
  - `height` becomes `minHeight` on sites 1–6, 11 and 14.
  - Each button is now a row with centred content, and its label has `textAlign: 'center'` and `flexShrink: 1`.
  - At the default text size, neither change touches a box. At a very large iOS text size, a wrapped label grows its
    button instead of being clipped, and wraps centred.
- **Everything else: zero differences and the same accessibility records.** Any other difference is a bug in the
  slice that caused it, and it gets fixed, not listed.

## Visual check (AC3–AC6; not counted in the line estimates)

**Set-up.**

- This worktree already has `node_modules`, but no `.env` files. Run `api` from the main checkout (this PR doesn't
  change the API), or copy the two git-ignored files in. Check `git status` is clean before the before set.
- Today is 2026-11-25. If the after set would fall on or after 1 December (Kyiv), November has ended: Remove, Delete
  and Use calculated end disappear. In that case take both sets on a December copy of the data instead.
- **Three QA users**, all created by the orchestrator before the before set and deleted after Gate B (members first):
  - **Owner:** `yarn api create-user --username claude-qa-104c --email …`. Its ledger gets the default November list.
  - **Member:** `claude-qa-104c-m`, created with `--join claude-qa-104c`.
  - **No ledger:** `claude-qa-104c-n`, created with `--join claude-qa-104c` and then removed by the owner (Members →
    Remove → Remove). The CLI has no flag for a user without a ledger, and that leaves one.
  - Also as the owner, before the before set:
    - one November expense (note its id and category id)
    - one November income item (note its id)
    - November's actual End, saved once from `/actual-end?month=2026-11`, so the form shows Use calculated end
- **The invite.** Invites expire after an hour, which is less than the gap between the two sets, so each set makes its
  own:
  - As the owner, invite `claude-qa-104c-n` from Members just before step 2 of that set's order below.
  - If the before set's invite is somehow still live in the after set, skip it: the API refuses a second one, and the
    views look the same.
- TOTP codes come from a scratch script in the system temp dir, and the secret is never printed. Wait for a fresh
  30 s window between sign-ins. Wrong codes count against the limit (5 in 24 hours), so don't guess.

**Snapshot script:** 104b's version, which is the 104 plan's script with three changes:

- it records `aria-busy` and `aria-disabled`
- it pauses infinite animations at frame 0
- its keys become `snap:before:104c:<view>:<scheme>` and `snap:after:104c:*`

Use 390×844, check `innerWidth === 390` in every result, and take Light, then Dark, for each view.

**Views, in this order, the same in both sets:**

1. **Owner, no invite yet.**

   | View                  | Where / how                                                                                                                                                                                                                     |
   | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `settings`            | `/settings` (Sign out)                                                                                                                                                                                                          |
   | `category-form-edit`  | `/category-form?month=2026-11&categoryId=<the expense's category>` (Remove from November)                                                                                                                                       |
   | `income-item-edit`    | `/income-item?month=2026-11&incomeId=<id>` (Delete item)                                                                                                                                                                        |
   | `expense-edit`        | `/expense?expenseId=<id>` (Delete expense)                                                                                                                                                                                      |
   | `actual-end-set`      | `/actual-end?month=2026-11` (Use calculated end)                                                                                                                                                                                |
   | `expense-load-error`  | Open `/category/<id>?month=2026-11`, then `window.fetch = () => Promise.reject(new TypeError('offline'))`. Click the expense row: the client-side push to `/expense` fails its load and shows Retry and Back. Reload afterwards |
   | `expense-delete-busy` | On `expense-edit`, hold every request with `window.fetch = () => new Promise(() => {})` and press Delete expense: it's disabled, not dimmed, and Update shows the spinner. Reload afterwards; nothing was sent                  |

2. **Owner, with the invite.** Invite `claude-qa-104c-n`, then:

   | View                   | Where / how                                                                                    |
   | ---------------------- | ---------------------------------------------------------------------------------------------- |
   | `members-owner`        | `/members`: the member with Remove, and the invite with Revoke                                 |
   | `members-confirm`      | Tap the member's Remove; the panel shows Back and Remove                                       |
   | `members-confirm-busy` | Hold, then press the panel's Remove: Back is disabled and not dimmed. Reload; nothing was sent |

3. **Member.** Sign out, then sign in as `claude-qa-104c-m`:

   | View             | Where / how               |
   | ---------------- | ------------------------- |
   | `members-member` | `/members` (Leave ledger) |

4. **No ledger.** Sign out, then sign in as `claude-qa-104c-n`, within the invite's hour:

   | View                     | Where / how                                                                                           |
   | ------------------------ | ----------------------------------------------------------------------------------------------------- |
   | `no-ledger`              | `/`: the invite (Decline, Accept), Check for invites and Sign out                                     |
   | `no-ledger-decline-busy` | Hold, then press Decline: Decline dims to 0.6, and Accept shows the spinner. Reload; nothing was sent |

5. **Signed out.**

   | View    | Where / how                                                 |
   | ------- | ----------------------------------------------------------- |
   | `login` | `POST /api/auth/logout` (credentials included), then reload |

Before comparing a busy after snapshot, confirm it shows the held state (spinner or `aria-disabled`). If it doesn't,
reload and repeat.

**Checked from the code only** (listed as such in the PR):

- Members' Leave confirm panel: the same `ConfirmPanel` as `members-confirm`.
- Revoke while busy, and Close (the gone-member case): the same props as Remove and Back.
- PendingInvites on Home and Settings: the same component as `no-ledger`.
- The other `LoadError` hosts, which are the same component.

**Demo (AC6):** `web-demo` (port 8082), Light and Dark, with the console open. Check the category form (edit), the
income item (edit), the expense form (edit), the actual End form and the category page's ⋯ menu. There should be no
errors. `yarn mobile check-builds` (no `--accept`) passes on the last commit.

**Gate B, iPhone (Expo Go):** Settings' Sign out, and Delete expense on a form, idle and pressed.

## AC → evidence

| AC                                                            | Evidence                                                                                                                                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1 Button covers them, tokens and palette only, no new token | Slices 1–3 (sites 1–14). Button imports the same five modules. `git diff origin/main -- apps/mobile/src/theme.ts` has only deletions. The exceptions, with reasons, are in Contracts                         |
| AC2 the three helpers leave `theme.ts`                        | Slice 4's two `rg` checks find nothing. The menu row keeps the look as its own style, as the brief says                                                                                                      |
| AC3 before and after snapshots, nothing moves                 | Visual check: 11 idle views × 2 schemes. Expected: the 2 rows in What moves, and nothing else                                                                                                                |
| AC4 busy and disabled look and read as before                 | `no-ledger-decline-busy` (Decline 0.6), `expense-delete-busy` (a delete while saving, not dimmed) and `members-confirm-busy` (Back disabled, not dimmed), before and after in both schemes. iPhone at Gate B |
| AC5 roles, labels, `disabled`, `aria-busy` unchanged          | `a11ySame: true` on all 14 views. The props union keeps `aria-busy` off the non-filled looks, and the label rule passes the 3 existing `accessibilityLabel`s and adds none                                   |
| AC6 demo, no console errors; `check-builds` passes            | Slice 1: `check-builds` with no `--accept`. After slice 4: the demo views in both themes with a clean console                                                                                                |
| AC7 gates                                                     | Every slice                                                                                                                                                                                                  |

## Not doing (YAGNI)

- A `tone` prop, a `role` or `href` prop, a `padding` prop, or new text sizes (Approach, Open questions).
- Login's links, UndoToast's Undo, DemoStrip and the header Backs (Contracts, exceptions).
- One disabled look, one padding or one height for the text buttons: brief 105.
- Exporting `ButtonVariant`: nothing outside `Button.tsx` names it.
- Docs. The design spec's Components table describes 105's Button, and no doc names the three helpers (`rg` outside
  `docs/features`), so nothing goes stale.

## Risks

- **LoadFailed's Back moves its word.** That would happen if the row's `justifyContent: 'flex-start'` didn't hold.
  Slice 2's `expense-load-error` compares the word's x and y: only the text element's width may differ.
- **The reordered style array changes a filled button.** The filled looks and the sizes share no style keys, so it
  shouldn't. Slice 1 re-snapshots the 104b views that still exist.
- **The load-error trick doesn't reach the error.** The page might reload instead of pushing on the client, or
  something might be cached. If the expense row doesn't give LoadFailed, use Budget's Start → End line with fetch
  rejected: it pushes `/actual-end`, whose balance-load `LoadError` has Retry. LoadFailed's Back is then checked from
  the code and listed.
- **The invite expires mid-set, or November ends.** The view order keeps the invite's views within one hour, and the
  date check is in Set-up.
- **Main moves.** Brief 109 may merge first. Rebase, take main's version and bump once more (§8b). If 109 changes a
  snapshotted view, take a fresh baseline (104 script, step 7).

## Open questions

1. **Blocking: yes (Gate A). The API shape (brief open question 1).**
   - Recommended: four new `variant` values, `outlinedDanger`, `dangerText`, `mutedText` and `accentText`, with no
     `tone`.
   - That's one prop per call site and no boolean. The props union keeps `busy` and `icon` for the filled looks, which
     are the only ones they suit.
   - `variant` + `tone` needs two props everywhere, and a tone means nothing on `primary` and `danger`.
   - Assumed: four variants.
2. **Blocking: yes (Gate A). Login's two links (brief open question 2).**
   - Recommended: they stay an exception.
   - `Link asChild` passes `href`, `role` and, on web, `onClick` to its child. To take them, `Button` would have to
     pass on any Pressable prop, or render a `Link` itself. That's a second path, in a presentational component, for
     two links, and the accessibility record (`<a href role="link">`) would be at risk.
   - `accentText` has 3 callers without them.
   - Assumed: exception; `login` is still snapshotted, and doesn't change.
3. **Blocking: yes (Gate A). Heights (brief open question 3).**
   - Recommended: map them onto `medium` (48) and `compact` (44), with no new size and no height overrides.
   - Where a padding differs from the size's (0, 4, 8 or 12 against `compact`'s 16), it stays in the style the
     caller already has, as today's values until brief 105.
   - The snapshots show no difference from this. `height` becoming `minHeight` is listed (What moves).
   - Assumed: as recommended.
4. **Blocking: no. Disabled text buttons don't dim, and Decline keeps its own 0.6.** That's today's look: 7 of the 8
   disabled text buttons don't dim, and the brief's table is wrong about Members' Back/Close. Assumed: keep it; brief
   105 unifies.
5. **Blocking: no. The text looks reset the corner** (`borderRadius: 0` with a lint disable). The alternative is a
   pill corner on every text button: a rounded web focus ring, and a radius difference in every text button's
   snapshot row. Assumed: reset.
6. **Blocking: no. Three QA users, and a fresh invite per set** (Visual check). Assumed: as described. Without them,
   the Members and no-ledger views would be code only, which AC3 doesn't allow.

## Follow-ups

- For brief 105, delete these with the old look:
  - `bare` and the `filled && off` rule
  - Decline's 0.6
  - the callers' padding overrides
  - LoadFailed's `failedBack`
- LoadFailed's Back spans the whole row, which is a side effect of reusing the header's style. 104e or 105 can make it
  as wide as its word. That would be a visible tap-area change, so it's not for this PR.
- The exceptions to revisit in 105: login's links, UndoToast's Undo, DemoStrip.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a>

## Revision 1

- After the skeptic's review (#9): the clean-up list adds the five styles that are only used by the Pressables that
  go (no-ledger's `signOut`, category-form's `remove`, income-item's and expense's `delete`, actual-end's
  `secondary`), in slices 1 and 2. The scratch draft had already removed them, so the line estimates don't change.
- Slice 1 also says it rewrites Button's JSDoc and the `ButtonSize` comment, and names the views it re-snapshots for
  the filled buttons.
- Not taken: adding each look in the slice where it first gets a caller. As in 104b, slice 1 ships the component
  whole.

## Gate A (2026-11-25)

Approved by the user as recommended: one PR (about 279 lines); four new `variant` values (`outlinedDanger`,
`dangerText`, `mutedText`, `accentText`) rather than `variant` + `tone`; login's two links stay an exception; heights
map onto the existing `medium` and `compact` sizes.
