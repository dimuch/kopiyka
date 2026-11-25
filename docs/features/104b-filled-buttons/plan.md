# Plan: Shared components, part 2: a Button for every filled button

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/filled-buttons
Base: origin/main (129fb8f, version 1.23.1); rebased onto 3e6c4e7 (1.23.2) before review

## Approach

Add `src/components/Button.tsx`, then move the brief's 11 filled buttons onto it. They sit in 9 files.
NotionSyncPanel's Sync stays as it is, because brief 109 deletes it. All 11 hosts are plain `Pressable`s from
`@/components/Pressable`. None is an `Animated.View`, a `Link asChild` or a list host, so unlike part 1 no host needs a
style hook: each one becomes `<Button>`.

I measured every site on Base (table in Contracts). Three things go together on every site:

- the height: 56, 48 or 44
- the spinner: it replaces the label on every 56pt button and on EmptyMonth, and sits beside the label at 48 and 44
- the corner: `radius.lg` at 56 and a pill at 48 and 44, apart from two one-offs

So one `size` union carries all three, and each value has 2 or more callers. The one-offs are style overrides with a
comment: login's pill and 0.4, EmptyMonth's 48pt with `radius.md`, and Members' 0.5. On every site the button is dimmed
exactly while it's disabled, so Button dims (0.6) whenever `busy || disabled` and needs no opacity prop.

**Size.** I drafted every edit in a scratch copy and formatted it with the repo's Prettier. It comes to **408 changed
lines (157 added, 250 removed)**, plus 1 line in `demo-modules.txt`. That's within the brief's "~400", and most of it is
deletions, so this is **one PR in 4 slices**, each one 150 lines or fewer. Splitting it would mean two before and after
sets and two bumps, to save about 8 lines.

Alternatives considered:

- **Separate `size`, `corner` and `spinner` props.** Then no site needs a corner override. But that's three props where
  one does, the corner value `md` would have one caller anyway, and the spinner would be a prop that brief 105 removes.
- **A `padding` option, so the expense form's Add and login's Sign in keep 0 side padding.** It's a prop with no visible
  effect, because both are full width with short labels. Both get `large`'s 16pt instead, which shows in the snapshots'
  padding column only (What moves).

## Contracts

- DB / API / DTOs / `theme.ts`: none. No new token.
- **`src/components/Button.tsx`** (new; drafted at 77 lines):

  ```ts
  /** Today's filled-button sizes, each with its corner and spinner (brief 105 makes them one 48pt pill).
   *  large: 56pt, radius.lg; while busy the spinner takes the label's place.
   *  medium: 48pt pill; while busy a spinner shows before the label.
   *  compact: 44pt pill, as wide as its label, beside a 44pt text button; spinner as medium. */
  export type ButtonSize = 'large' | 'medium' | 'compact';

  export function Button(props: {
    variant: 'primary' | 'danger'; // background accent | danger; label and spinner onAccent
    size: ButtonSize;
    label: string;
    onPress: () => void;
    busy: boolean; // spinner, aria-busy, disabled
    disabled?: boolean; // default false
    icon?: IconName; // before the label, hidden while busy: the expense form's "+" (one caller, see below)
    accessibilityLabel?: string; // when the name says more than the label
    style?: StyleProp<ViewStyle>; // the caller's layout and the listed one-offs, applied last
  }): React.JSX.Element;
  ```

  - It renders our `Pressable` with `accessibilityRole="button"`, `aria-busy={busy}` and `disabled={busy || disabled}`.
  - Its style is `[button, styles[variant], styles[size], (busy || disabled) && off, style]`.
  - It labels itself with `accessibilityLabel ?? (size === 'large' ? label : undefined)`. While busy, a large
    button's only child is a spinner, so it needs a name. Medium and compact keep their label visible and, like today,
    add no name of their own.
  - Children while busy: `<ActivityIndicator color={colors.onAccent} />` (the default size, `small`, the same as
    today's explicit `size="small"`). For `large` that's all. For the others the label follows.
  - Children while not busy: the optional `<Icon name={icon} color={colors.onAccent} strokeWidth={2.4} />`, then
    `<Text style={label}>`.
  - Destructure the prop as `size: buttonSize`: `size` is also the theme's token object.
  - Styles (`makeStyles(colors)`):
    - `button`: `{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm }`
    - `primary`: `{ backgroundColor: colors.accent }`
    - `danger`: `{ backgroundColor: colors.danger }`
    - `large`: `{ minHeight: 56, borderRadius: radius.lg, paddingHorizontal: space.lg }`. `minHeight` isn't a guarded
      key, and 56 is a literal in 5 files today. 105 makes it `size.control`.
    - `medium`: `{ minHeight: size.control, borderRadius: radius.pill }`
    - `compact`: `{ minHeight: size.iconButton, borderRadius: radius.pill, paddingHorizontal: space.lg }`
    - `off`: `{ opacity: 0.6 }`
    - `label`: `{ ...text.bodyStrong, color: colors.onAccent, textAlign: 'center', flexShrink: 1 }`. With
      `flexShrink`, a label too long for the row wraps centred, as the column layouts do today, instead of running
      out of the row.
  - Imports: `react-native`, `@/appearance/AppearanceContext`, `@/components/Icon`, `@/components/Pressable` and
    `@/theme` only.

- **Call sites, measured on Base** ("→" is what the caller passes; the style column is the caller's `style`):

  | #   | Site (file: style)                    | Today                                                                                                   | → variant, size  | Other props / `style`                                                                                         |
  | --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------- |
  | 1   | `components/CategoryForm`: `primary`  | min 56, lg, pad 16, column, 0.6 busy, replaces, label "Save"                                            | primary, large   | —                                                                                                             |
  | 2   | `app/income-item`: `primary`          | same as 1                                                                                               | primary, large   | —                                                                                                             |
  | 3   | `app/actual-end`: `primary`           | same as 1                                                                                               | primary, large   | —                                                                                                             |
  | 4   | `app/delete-category`: `destructive`  | same as 1 on `danger`; text centred; label `warning.action`                                             | danger, large    | —                                                                                                             |
  | 5   | `app/expense`: `primary`              | **height** 56, lg, **pad 0**, row gap 8, "+" when adding, 0.6 busy or list not ready                    | primary, large   | `icon={expense ? undefined : 'plus'}`, `disabled={list.status !== 'ready'}`                                   |
  | 6   | `app/login`: `button`                 | **height** 56, **pill**, **pad 0**, column, **0.4** while `!ready`, replaces                            | primary, large   | `disabled={!ready}`, `style={[styles.signIn, !ready && styles.signInOff]}`: `radius.pill`, `opacity: 0.4`     |
  | 7   | `components/EmptyMonth`: `button`     | min **48**, **`radius.md`**, pad 16, `alignSelf: 'stretch'`, centred, replaces                          | primary, large   | `style={styles.button}`: `alignSelf: 'stretch'`, `minHeight: size.control`, `borderRadius: radius.md`         |
  | 8   | `app/members` LabelForm: `primary`    | height 48, pill, pad 0, row gap 8, **0.5** while busy or unchanged, small spinner beside, no label prop | primary, medium  | `disabled={unchanged}`, `style={(busy \|\| unchanged) && styles.dimmed}` (`opacity: 0.5`)                     |
  | 9   | `app/members` InviteForm: `primary`   | same as 8, while busy or no name                                                                        | primary, medium  | `disabled={!name}`, `style={(busy \|\| !name) && styles.dimmed}`                                              |
  | 10  | `app/members` ConfirmPanel: `confirm` | min 44, pill, pad 16, row gap 8, content width, 0.6 busy, spinner beside                                | danger, compact  | `accessibilityLabel={action}` (kept as today, so the accessibility record doesn't change)                     |
  | 11  | `components/PendingInvites`: `accept` | same as 10 on accent; spinner and aria-busy for this invite, disabled for any                           | primary, compact | `accessibilityLabel={\`Accept invite from ${from}\`}`, `busy={busyId === invite.inviteId}`, `disabled={busy}` |
  - **Today's states map exactly.** The `disabled` that each site passes today equals `busy || disabled` here. The
    dimmed condition is the same expression on every site, so `off` reproduces it. On login, `busy` implies `!ready`,
    so the button is disabled exactly while `!ready`.
  - **Prop values in use:**
    - `large` has 7 callers, `medium` 2, `compact` 2.
    - `primary` has 9 callers and `danger` 2.
    - `disabled` has 5 callers, `accessibilityLabel` 2 and `style` 4.
    - **`icon` has one caller.** It's the listed exception to the 2-caller rule: AC2 needs the Add button on Button.
      The other choice is to leave Add hand-written, which fails AC2.
  - **Caller clean-up.** Each file loses the replaced styles. It also drops imports that go unused:
    - `ActivityIndicator`: CategoryForm, delete-category, login, EmptyMonth and PendingInvites
    - `Pressable`: CategoryForm and EmptyMonth
    - `useColors`, and the now-unused `const colors`: delete-category, EmptyMonth, PendingInvites, and Members'
      InviteForm and ConfirmPanel
    - `radius`: delete-category and PendingInvites

- **Left as they are (AC2 exceptions):**
  - `NotionSyncPanel`'s Sync: brief 109 deletes the panel (brief, Out of scope).
  - `TabBar`'s badge: a count, not a pressable.
  - `app/(tabs)/_layout.tsx`'s `tabBarBadgeStyle`: the same badge (the native tab bar's), a count, not a pressable.
  - After slice 4, `rg -n "backgroundColor: colors\.(accent|danger)\b" apps/mobile/src` finds only `Button.tsx`,
    `NotionSyncPanel.tsx`, `TabBar.tsx` and `app/(tabs)/_layout.tsx`.
- **Demo:** Button reaches the demo through CategoryForm, the form screens and EmptyMonth. Slice 1 runs
  `yarn mobile export:web && yarn mobile check-builds --accept`, and the list's diff is the one line
  `src/components/Button.tsx`. Login, Members and PendingInvites aren't in the demo.
- Reuses: `Pressable` (its pressed dimming), `Icon`, `useThemedStyles`/`useColors`, the `space`, `radius`, `size` and
  `text` tokens, and the 104 snapshot script (Visual check). Searched `src/components`: there's no existing button
  component.
- New dependencies: none.

## Version

Bump: patch — 1.23.2 → 1.23.3 (planned as 1.23.1 → 1.23.2; main took 1.23.2 first, see Deviations)
Why: §8b `patch`. This is a behaviour-preserving refactor of shipped app code: the same buttons, states and labels.
There's no new capability, and no API, schema or connector change.

## Slices

Before slice 1, the orchestrator takes the **before** set on Base (Visual check). Slice 0 only changes the version.
Each line count below comes from the scratch draft.

- [x] 0. Bump version to 1.23.3
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.23.3
- [x] 1. Draw the category and income forms' Save with one Button component (~135 lines)
  - Files: `src/components/Button.tsx` (new), `src/components/CategoryForm.tsx`, `src/app/income-item.tsx`,
    `apps/mobile/demo-modules.txt`
  - Change: Button as in Contracts (all three sizes, as Card shipped all its paddings in part 1). Sites 1 and 2.
  - Verify: gates; `export:web` + `check-builds --accept`, with only the Button line added. Snapshots: `category-form`,
    `income-item`.
- [x] 2. Draw the actual End, delete category and expense buttons with Button (~95 lines)
  - Files: `src/app/actual-end.tsx`, `src/app/delete-category.tsx`, `src/app/expense.tsx`
  - Change: sites 3–5.
  - Verify: gates. Snapshots: `actual-end`, `actual-end-busy`, `delete-category`, `expense-new`, `expense-edit` (the
    last two show the expected padding row, What moves).
- [x] 3. Draw Sign in and the empty month's button with Button (~72 lines)
  - Files: `src/app/login.tsx`, `src/components/EmptyMonth.tsx`
  - Change: sites 6 and 7, with their one-off overrides and a comment each ("one-off until brief 105: …"). EmptyMonth's comment
    says that resetting `large`'s `minHeight` 56 to `size.control` is a deliberate override.
  - Verify: gates. Snapshots: `budget-empty`, `login` (idle is disabled: 0.4 and `aria-disabled`).
- [x] 4. Draw the Members and invite buttons with Button (~106 lines)
  - Files: `src/app/members.tsx`, `src/components/PendingInvites.tsx`
  - Change: sites 8–11; Members' `primary`, `primaryText`, `confirm` and `confirmText` become one `dimmed` style.
  - Verify: gates. AC2's `rg` (Contracts). Snapshots: `members`, `members-busy`, and `members-confirm` and
    `members-confirm-busy` if the second user exists (Open question 5). Then the demo check (Visual check).

Every slice runs `yarn format:check && yarn lint && yarn typecheck && yarn test`, without piping. In this worktree,
export `DATABASE_URL_TEST` from the main checkout's `.env`, or the API integration tests skip. There are no new unit
tests: no pure logic is added, and nothing in `data/` or `format.ts` changes (§6: UI is checked in the browser).

## What moves (the PR lists this)

- **Padding only, with no box moving:** the expense form's Add/Update (`expense-new`, `expense-edit`) and login's Sign in
  gain `large`'s 16pt side padding (`0px` → `0px 16px`). They're full width with short labels, so nothing in them
  moves. That's one row per view and scheme: **6 rows** in all.
- **Not caught by the snapshots, and listed:**
  - `height` becomes `minHeight` on sites 5, 6, 8 and 9.
  - Column layouts become a row (sites 1–4, 6, 7), and every label is centred with `flexShrink: 1`.
  - At the default text size none of this changes a box. At a very large iOS text size, a label that wraps now grows
    its button instead of being clipped.
- **Everything else: zero differences, and the same accessibility records.** Any other difference is a bug in the slice
  that caused it, and it gets fixed, not listed.

## Visual check (AC3–AC6; not counted in the line estimates)

**Set-up.**

- This worktree has no `node_modules`, so run `yarn install` first. Then check that `git status` is clean.
- It has no `.env` files either. Run `api` from the main checkout, which this PR doesn't change, or copy both
  git-ignored files in.
- QA user `claude-qa-104b`, created by the orchestrator before the before set and deleted after Gate B. It needs:
  - its November list (the 15 default categories, some with planned amounts)
  - at least 2 November expenses in one category, for `expense-edit` and delete category's "Remove and delete N"
  - an empty December, so Budget offers "Copy November’s categories"
- Optional second user (Open question 5), created the same way:
  `yarn api create-user --username claude-qa-104b-m --email … --join claude-qa-104b`. It makes the second user a member
  of the first user's ledger, with no invite needed. Create it before the before set, so `members` shows both people in
  both sets. Delete it before the owner.
- Get TOTP codes from a scratch script in the system temp dir, and never print the secret. Wait for a fresh 30 s window
  between sign-ins. A wrong code counts against the limit (5 in 24 hours), so don't guess.

**Snapshot script.** Use the 104 plan's "Snapshot script" and its steps 1–7, with three changes:

- keys are `snap:before:104b:<view>:<scheme>` and `snap:after:104b:*`
- the accessibility record adds `aria-busy` and `aria-disabled` (AC5)
- infinite animations are paused at frame 0 before measuring, so a spinner's rotating box can't differ between runs

Install it once per origin:

```js
localStorage.setItem(
  '__snapSrc',
  `(key) => { for (const a of document.getAnimations()) if (a.effect && a.effect.getTiming().iterations === Infinity) { a.pause(); a.currentTime = 0; } const rows = []; for (const el of document.body.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (!r.width && !r.height) continue; const s = getComputedStyle(el); const own = el.childElementCount === 0 ? (el.textContent || '').trim().slice(0, 24) : ''; rows.push([Math.round(r.x * 2) / 2, Math.round(r.y * 2) / 2, Math.round(r.width * 2) / 2, Math.round(r.height * 2) / 2, s.backgroundColor, s.borderTopWidth + ' ' + s.borderTopColor, s.borderTopLeftRadius, s.padding, s.opacity, own].join('|')); } const a11y = [...document.querySelectorAll('[role],[aria-label],[aria-busy],[aria-disabled]')].map((e) => [e.getAttribute('role'), e.getAttribute('aria-label'), e.getAttribute('aria-busy'), e.getAttribute('aria-disabled')].join('|')); localStorage.setItem(key, JSON.stringify({ rows, a11y })); return [key, rows.length, a11y.length, innerWidth, innerHeight]; }`,
);
localStorage.setItem(
  '__cmpSrc',
  `(view, scheme) => { const before = JSON.parse(localStorage.getItem('snap:before:104b:' + view + ':' + scheme)); const afterKey = 'snap:after:104b:' + view + ':' + scheme; eval(localStorage.__snapSrc)(afterKey); const after = JSON.parse(localStorage.getItem(afterKey)); const diffs = []; for (let i = 0; i < Math.max(before.rows.length, after.rows.length); i++) if (before.rows[i] !== after.rows[i]) diffs.push(i + ': ' + before.rows[i] + '  =>  ' + after.rows[i]); return { view, scheme, rows: [before.rows.length, after.rows.length], diffs: diffs.length, first: diffs.slice(0, 4), a11ySame: JSON.stringify(before.a11y) === JSON.stringify(after.a11y) }; }`,
);
```

**Idle views (AC3).** Each one in Light, then Dark, at 390×844, with nothing pressed:

| View              | Where                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------- |
| `category-form`   | `/category-form?month=2026-11` (add)                                                   |
| `income-item`     | `/income-item?month=2026-11` (add)                                                     |
| `expense-new`     | `/expense`                                                                             |
| `expense-edit`    | `/expense?expenseId=<a November expense>`                                              |
| `actual-end`      | `/actual-end?month=2026-11`                                                            |
| `delete-category` | `/delete-category?categoryId=<the category with expenses>&month=2026-11`. Don't press  |
| `budget-empty`    | `/budget?month=2026-12` (Copy November’s categories). Don't press                      |
| `members`         | `/members` as owner: Save and Invite both disabled (0.5)                               |
| `login`           | Last in each set: sign out with `POST /api/auth/logout` (credentials included), reload |

`login` is idle and disabled at once (empty fields), which covers AC4's disabled Sign in.

**Busy views (AC4).** Hold every request with `window.fetch = () => new Promise(() => {})`, press, wait about 1 s, then
snapshot. Before comparing an after snapshot, confirm it shows the spinner (the request is held); if not, reload and
repeat. Reload afterwards: nothing was sent, so no data changes. Each one in Light and Dark:

- `actual-end-busy` (spinner replaces the label): press Save on the prefilled End.
- `members-busy` (spinner beside, `medium`): type `qa` into "Your label", then hold and press Save. Type the same text
  in the after set.
- With the second user only:
  - `members-confirm`: tap the member's Remove, which opens the confirm panel.
  - `members-confirm-busy` (spinner beside, `compact`, danger): then hold and press the panel's Remove.

**Checked from the code only** (listed as such in the PR):

- PendingInvites' Accept. It shows only with a live invite, and invites expire within an hour, which is shorter than
  the gap between the two sets. It uses the same `compact` size as the confirm panel, and its props are in the
  call-site table.
- The confirm panel, if the second user isn't created.
- Members' Leave confirm, which is the same `ConfirmPanel`, seen by a member.
- The empty Income and Expenses months' buttons, which are the same `EmptyMonth` as `budget-empty`.

**After set:** after slice 4 (or per slice, as listed in Slices), the same views, data and port, compared with
`eval(localStorage.__cmpSrc)('<view>', '<scheme>')` against What moves. The screenshots go in the PR, not the repo.

**Demo (AC6):** `web-demo` (port 8082), Light and Dark, with the console open:

- the category form, the income item, the expense form (new and edit), the actual End form and delete category
- a month with no categories, for EmptyMonth

There should be no red screen and no errors. `yarn mobile check-builds` (no `--accept`) passes on the last commit.

**Gate B, iPhone (Expo Go):** watch a busy Save (the category form or the actual End: spinner in place of the label,
dimmed), and Sign in, disabled and then enabled.

## AC → evidence

| AC                                                         | Evidence                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 `Button` exists, tokens and palette only, no new token | Slice 1. Its imports are the five listed in Contracts. `git diff origin/main -- apps/mobile/src/theme.ts` is empty                                                                                                        |
| AC2 the 11 buttons use Button; exceptions listed           | Slices 1–4. Slice 4's `rg` finds only `Button.tsx`, plus `NotionSyncPanel.tsx`, `TabBar.tsx` and `app/(tabs)/_layout.tsx` (the exceptions, with reasons, in Contracts)                                                    |
| AC3 before and after snapshots, nothing moves              | Visual check: 9 idle views × 2 schemes. Expected: the 6 padding-only rows in What moves, and nothing else                                                                                                                 |
| AC4 busy and disabled look and read as before              | `actual-end-busy` (replaces), `members-busy` (beside) and `members-confirm-busy` if the second user exists, plus `login` (disabled, 0.4); before and after, in both schemes. On iPhone at Gate B: a busy Save and Sign in |
| AC5 roles, labels, `disabled`, `aria-busy` unchanged       | `a11ySame: true` on every view. The record now includes `aria-busy` and `aria-disabled`. The label rule in Contracts keeps today's labels, and the members' Save and Invite still have none                               |
| AC6 demo, no console errors; `check-builds` passes         | Slice 1: `check-builds --accept` (one line). After slice 4: demo views in both themes with a clean console, and `check-builds` without `--accept` passes                                                                  |
| AC7 gates                                                  | Every slice                                                                                                                                                                                                               |

## Not doing (YAGNI)

- Outlined and text buttons (104c), icon buttons and chips (104d), headers (104e), `Text` (104f).
- One size, one opacity or one spinner placement: brief 105 (Open questions 1 and 2).
- An opacity, corner or padding prop: each would serve one-offs that 105 deletes.
- A `children` slot for the icon: `icon` covers its one caller.
- NotionSyncPanel: brief 109 deletes it.
- Docs: the design spec's Components table already describes 105's Button. Nothing in it goes stale.

## Risks

- **A row instead of a column changes a label's box** on sites 1–4, 6 and 7. With one child, centred both ways, it
  shouldn't. Slices 1–3 prove it: the label's text row is the same in the snapshots.
- **The spinner's box differs between runs** because it rotates. The script pauses infinite animations at frame 0. If
  busy rows still differ only at the spinner, compare that row's width and height by eye and list it.
- **Holding `fetch` misses the request.** `api()` calls the global `fetch` when it sends (`client.ts:83`), so replacing
  `window.fetch` before the press holds it. The busy snapshot shows the spinner if it worked.
- **`busy` required on every site.** All 11 have a boolean today, so the type proves it in each slice.
- **Main moves.** Brief 109 may merge first. It touches the Sync panel and Home, not these files. Rebase, take main's
  version and bump once more (§8b). If 109's merge changes a snapshotted view, take a fresh baseline (104 script, step
  7).
- **Worktree set-up** (no `node_modules`, no `.env`): handled in the Visual check set-up, before the before set.

## Open questions

1. **Blocking: yes (Gate A). Keep the 3 disabled opacities and 2 spinner placements, or unify them now (brief open
   question 1)?**
   - Recommended: keep them.
   - The brief's rule is "nothing changes", and 105 changes every filled button anyway (48pt violet pills), so it
     decides states and look together.
   - Cost of keeping: the spinner rides on `size`, 0.6 is Button's default, and the two other opacities are style
     overrides with a comment (login 0.4, Members 0.5). 105 deletes those lines.
   - Assumed: keep.
2. **Blocking: yes (Gate A). Members' confirm Remove and PendingInvites' Accept at 44pt, under the 48pt control size
   (brief open question 2)?**
   - Recommended: keep 44 as the `compact` size.
   - Both sit in a row beside a 44pt text button (Back/Close, Decline). 48 would make each row 4pt taller, a visible
     shift that this brief rules out.
   - 44 meets the touch minimum. 105 decides whether `compact` survives.
   - Assumed: `compact`.
3. **Blocking: no. Expected snapshot differences** (What moves): 16pt side padding on Add/Update and Sign in, and
   `minHeight` instead of `height`. The alternative is a padding option with no visible effect. Assumed: accept and
   list them in the PR.
4. **Blocking: no. `icon` has one caller**, against the 2-caller rule. AC2 puts Add on Button, and an icon prop is
   the smallest way. Assumed: `icon`.
5. **Blocking: no. A second QA user, `claude-qa-104b-m`, made a member with `--join`**, gives Members' confirm panel
   and its busy state real snapshots (the only `compact` and `danger`-beside evidence). It's one command, and it needs
   no invite. Accept stays code only. Assumed: create it. Without it, the confirm panel is code only too, as 104 did.
6. **Blocking: no. Size: 408 lines** against the brief's "split above ~400". Assumed: one PR (Approach).

## Follow-ups

- For brief 105, delete these with the old look:
  - `large`'s 56 and the `ButtonSize` union
  - the 0.6 default
  - the one-off overrides: login's `signIn` and `signInOff`, EmptyMonth's `minHeight` and `borderRadius`, Members'
    `dimmed`
- Members' confirm passes `accessibilityLabel={action}`, which equals its label. It's kept only so the accessibility
  record doesn't change. Drop it in 104c or 105, where the record is allowed to change.
- The BACKLOG's "one modal-form kit" (income item, category form, actual End) can use Button once this merges.

## Deviations

- Ports: brief 109's session held :3000 and :8081, so the before and after sets ran this branch's web app on :8084 and
  the demo on :8082. The API came from 109's checkout at first; when that server stopped mid-build, this worktree's
  own API took over :3000. Neither branch changes the API, so the snapshots compare the app only.
- Losing the API signed the QA user out, so one batch of slice 2 after-snapshots showed the login page. It was
  thrown away and the views were taken again after signing in; the results below are from the repeat.
- Results: all 26 pairs (13 views, light and dark) match their before snapshot, apart from the 6 padding rows in
  What moves, with identical accessibility records. Busy views showed the spinner and `aria-busy` before comparing.
  Enabled Sign in has opacity 1. Demo: `check-builds` passes (145 modules), no console errors in either theme.

- Before review, main moved to 3e6c4e7: brief 109's first commits (its own bump to 1.23.2 and NotionSyncPanel's removal
  from Home). Rebased cleanly; this branch's bump became 1.23.3. None of the 13 snapshot views shows Home, so the
  before set still stands. AC2's exception for NotionSyncPanel is moot now: the file is gone.

## Consolidate

One new component, `Button`. Its twins were the 11 hand-written filled buttons, all now replaced. Left: 0.
NotionSyncPanel's Sync button was left for brief 109, which has since deleted it on main; the tab bar badges aren't
buttons. Reused 0, extracted 0.

## Gate A (2026-11-25)

Approved by the user as recommended: one PR (about 408 lines); disabled opacity and spinner placement stay per
button as today (brief 105 unifies them); the two 44pt buttons keep a `compact` size.
