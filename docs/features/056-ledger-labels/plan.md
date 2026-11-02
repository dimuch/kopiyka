# Plan: Your own label for a ledger

Status: approved

Brief: ./brief.md
Branch: feat/ledger-labels
Base: origin/main at `ffe4ec6` (briefs 051–055 merged). Contracts below were read in `apps/api/src/ledgers/routes.ts`,
`apps/mobile/src/auth/AuthContext.tsx` and `apps/mobile/src/app/members.tsx` at that commit.

## Approach

- The label belongs to a membership, so it is a nullable column on `ledger_members`: one row per person per ledger
  already exists, it goes when the person leaves or is removed, and `ledgers.name` stays "Home".
- `GET /api/ledgers` returns it as `label` (null until set). One new route, `PUT /api/ledgers/:id/label`, sets or
  clears the caller's own label. It takes the usual ledger guards, so any member can call it and a non-member gets
  404 `ledger_not_found`.
- The app displays `ledger.label ?? <today's text>` in the three places the brief names. The fallback differs in each
  place ("Home" in the picker, "Kopiyka" on Home, "`<owner>`’s Home" on Members), so each one stays inline and there
  is no shared helper.
- A "Your label" form at the top of the Members screen (owner and member alike) saves the label, then calls the
  existing `openLedger(ledger.ledgerId)`. That refetches `/api/ledgers` into AuthContext and keeps the open ledger, so
  the picker, Home and the caption update with no new context method.

Alternatives considered:

- `PUT` returns the updated `Ledger` and AuthContext gets a `setLabel`/`refresh` method that patches state locally.
  It lost: that adds surface to the context, and `openLedger` on the open ledger already refetches and keeps the
  choice. The cost is one extra GET per save.
- Reuse `CategoryNameForm`. It lost: the form is about a category in a month (month, `nameRefusedText`, required 1–40,
  `autoFocus`). A label can be empty and has its own texts, so making it generic would be a bolt-on.
- A separate `ledger_labels` table. It lost: it would need its own cleanup when someone leaves, which the
  membership row gives for free.

Bolt-on check: if labels had existed from the start, the DTO would still carry the label apart from `name`. The app
needs to know whether a label is set, to choose between "Kopiyka" and the label and to fill the field. Serving a
computed `COALESCE(label, name)` would hide that. So `label` is a separate field, not a special case.

## Contracts

- DB: `apps/api/migrations/011_ledger_member_labels.sql`:
  ```sql
  -- Brief 056. Each person's own name for a ledger they're in, shown only to them in place of "Home" (ledgers.name
  -- stays "Home" for everyone). NULL until set; clearing sets NULL again. It goes with the membership row when they
  -- leave or are removed. The API trims and allows 1–40 characters (code points, as VARCHAR counts them in utf8mb4).
  ALTER TABLE ledger_members
    ADD COLUMN label VARCHAR(40) NULL; -- this member's label for the ledger; NULL: none
  ```
  No data change. Existing rows read NULL.
- API (`apps/api/src/ledgers/routes.ts`):
  - `GET /api/ledgers`: each ledger gains `label: string | null` (`m.label`). The response is otherwise unchanged:
    `{ user, ledgers: [{ ledgerId, name, role, owner, label }] }`.
  - `PUT /api/ledgers/:id/label`:
    - `preHandler: [app.requireAuth, app.requireLedger]` (no `requireOwner`).
    - Body: `LabelBody = z.object({ label: z.string().trim().max(40) })`. Zod 4 counts code points: checked, 40 emoji
      pass and 41 `x` fail. An empty string after trimming clears the label.
    - Write: `UPDATE ledger_members SET label = ? WHERE ledger_id = ? AND user_id = ?` with
      `[label || null, ledgerId, userId]`. That touches only the caller's row.
    - Response 204, no body.
    - Errors: 400 `invalid_request` (missing, not a string, or over 40 after trimming), 401, 404 `ledger_not_found`
      (not a member, or no such ledger, from `requireLedger`).
    - A membership removed between the guard and the UPDATE matches 0 rows. That is still 204: the next request gets
      `ledger_not_found`. The route says so in a comment.
  - Consumers: `AuthContext.fetchMe` reads GET. Only the Members screen's form calls PUT.
- App:
  - `api/types.ts`: `Ledger` gains `label: string | null`, with the JSDoc "The user's own label for it (brief 056);
    null shows the default." Update `owner`'s comment ("every ledger is named Home" → "until a label is set…").
  - `data/members.ts`: `setLedgerLabel(ledgerId: number, label: string): Promise<void>`, which sends PUT with body
    `{ label }`.
  - `data/ledgerLabel.ts` (new, pure): `normalizeLabel(text: string): string | null`. It returns the trimmed label
    (`''` clears), or null when it has more than 40 code points. It counts the same way as `normalizeName` and the API,
    and its comment says it counts like `normalizeName` (`data/categoryName.ts`), so the two don't drift.
  - `auth/AuthContext.tsx`: no code change. `openLedger`'s JSDoc adds "and on the open ledger after a label change,
    to reload the ledgers".
  - `app/members.tsx`: a local `LabelForm({ ledger }: { ledger: Ledger })`, rendered under the title block as
    `<LabelForm key={ledger.ledgerId} ledger={ledger} />` for both roles. The key resets the field if the
    ledger-gone handler swaps the ledger.
  - No new routes or components.
- Reuses: `requireAuth`/`requireLedger`; `openLedger` as the refresh; `ApiError`; the `inFlight` + `busy` double-tap
  guard and the alert line with `announceForAccessibility` (InviteForm); InviteForm's `section`/`caption`/`input`
  styles and its accent button. The button styles `invite`/`inviteText` are renamed `primary`/`primaryText` (as in
  `CategoryNameForm`) in their own commit (slice 3a), so both forms share them. `router.dismissTo('/')` after `ledger_not_found` (MemberLeave).
- New dependencies: none.

### Texts (proposed; see Open questions)

| Where        | When                                | Text                                                                |
| ------------ | ----------------------------------- | ------------------------------------------------------------------- |
| Members form | caption above the field             | "Your label"                                                        |
| Members form | helper under the field              | "Only you see it. Leave it empty for the usual name."               |
| Members form | placeholder                         | `ledger.name` ("Home")                                              |
| Members form | over 40 characters (checked in-app) | "A label can have up to 40 characters."                             |
| Members form | PUT failed (not `ledger_not_found`) | "Couldn’t save. Check your connection and try again."               |
| Members form | PUT saved, then the refresh failed  | "Saved, but couldn’t refresh. Reopen the app to see it everywhere." |
| Members form | saved (screen reader only)          | "Label saved."                                                      |

## Slices

QA setup for the Verify steps (per `kopiyka-local-qa`):

- Run the API from this worktree with the main checkout's `apps/api/.env` (`tsx --env-file=…`). Run
  `yarn api migrate` to apply 011. For web, run Metro from a sibling worktree outside `.claude/` at
  `http://127.0.0.1:8084`, viewport 390×844.
- Users:
  - A: `yarn api create-user --username claude-qa-056 --email claude-qa-056@example.test` (owns ledger LA).
  - B: `claude-qa-056b` the same way (owns LB).
  - A invites B and B accepts. Then B invites A and A accepts, using 055's Members form and Settings list. Now each
    owns one ledger and is a member of the other, so both see the Settings picker.
- Keep TOTP secrets only in the session scratchpad. Codes come from a scratch `tsx` script using
  `hotp(base32Decode(secret), timeStep(Date.now()))`. Log in by POST `/api/auth/login` from the page with
  `credentials: 'include'`. Use one browser profile per user and keep the network log open.

The slices, in order:

- [x] 1. List each person's own ledger label with their ledgers (~25)
  - Files: `apps/api/migrations/011_ledger_member_labels.sql` (new), `apps/api/src/ledgers/routes.ts`,
    `apps/api/test/ledgers.int.test.ts`, `apps/api/test/members.int.test.ts`, `apps/api/test/invites.int.test.ts`
  - Change:
    - The migration per Contracts.
    - GET selects `m.label` and maps `label: r.label`. Its comment drops "every ledger is named Home" for "with the
      caller's own label".
  - Tests: every integration file applies 011 through `resetSchema`. That is the proof it applies; a nullable ADD
    COLUMN has no data to migrate, so there's no `migrations.int.test.ts` case.
    - The three existing ledger-list assertions (`ledgers.int.test.ts:52–53`, `members.int.test.ts:69,72`,
      `invites.int.test.ts:249`) gain `label: null`.
- [x] 2. Let anyone in a ledger set or clear their own label for it (~90)
  - Files: `apps/api/src/ledgers/routes.ts`, `apps/api/test/members.int.test.ts`
  - Change: `LabelBody` and the PUT route per Contracts.
  - Tests: a new `describe('your own label')` in `members.int.test.ts`, using the existing dimuch (owner) + olena
    (member) fixture. Helpers: `label(headers, body)` returns `[status, json?]` and `labels(headers)` maps GET
    `/api/ledgers` to `label`.
    - The owner sets "Family" and the member sets "Flat with Olena", each 204. Each GET shows only their own label.
      `ledgerId` and `name: 'Home'` are unchanged, and `categories(memberAuth)` equals its value before.
    - It trims: `'  Family  '` is stored as `'Family'`.
    - Limits: 40 `x` → 204. 41 `x` → 400 `invalid_request`, and the label is unchanged. `'😀'.repeat(40)` → 204 and is
      read back intact (MySQL utf8mb4 VARCHAR(40) holds 40 code points).
    - Clearing: `''` → 204 and `label: null`. `'   '` after a set → `null`. The other person's label is untouched.
    - Body without `label` → 400. `{ label: 5 }` → 400. `{ label: null }` → 400 (clearing is `''`).
    - No session → 401.
    - A stranger (`makeUser`) → 404 `ledger_not_found`. A ledger id that doesn't exist → 404 `ledger_not_found`.
    - Leaving drops the label: olena sets one and leaves (DELETE `ledgerUrl(`/members/${olena.userId}`)` with `memberAuth`). `addMember` puts her back, and GET
      shows `label: null`.
- [x] 3. Show your own ledger label in the picker, on Home and on Members (~20)
  - Files: `apps/mobile/src/api/types.ts`, `apps/mobile/test/ledgerChoice.test.ts` (fixture gains `label: null`),
    `apps/mobile/src/components/LedgerPicker.tsx`, `apps/mobile/src/app/(tabs)/index.tsx`,
    `apps/mobile/src/app/members.tsx`
  - Change:
    - `Ledger.label`.
    - Picker rows show `l.label ?? l.name` on the left and keep `whose(l)` on the right, in the text and in the
      accessibility label. `name` gets `flexShrink: 1`, and `whose` changes from `flexShrink: 1` to
      `flexShrink: 0, maxWidth: '50%'`, so a long label ends in "…", "Yours" stays whole, and a 64-character owner
      name still can't push the label out.
      `whose`'s comment changes to "until a label is set, every ledger shows as Home".
    - Home's title is `ledger.label ?? 'Kopiyka'`, with `numberOfLines={2}` (40 wide characters would wrap to three
      lines at 390px).
    - The Members caption is `ledger.label ?? `${ledger.owner}’s ${ledger.name}``, with its comment updated.
    - The Leave question is unchanged (see Not doing).
  - Verify (web 390×844). Set labels from the page with a `fetch` PUT to
    `http://localhost:3000/api/ledgers/<LA>/label` (`credentials: 'include'`, JSON body `{ label }`), then reload:
    1. With no labels, everything looks as on main: picker "Home · Yours" / "Home · claude-qa-056’s", Home
       "Kopiyka", caption "claude-qa-056’s Home".
    2. A labels LA "Family". A sees "Family · Yours" in the picker. Home says "Family" while LA is open and "Kopiyka"
       with LB open. Members shows "Family". B still sees "Home · claude-qa-056’s".
    3. A 40-character label (once with `x`, once with `W`): the picker row ends in "…" with "Yours" whole, B's row
       for LA keeps "claude-qa-056’s" whole, and Home's title takes at most two lines (ending in "…" if needed)
       without overlapping the month caption.
    4. Light and dark at a glance.
- [x] 3a. Name the Members screen's accent button styles for a second form (~4)
  - Files: `apps/mobile/src/app/members.tsx`
  - Change: rename the styles `invite`/`inviteText` to `primary`/`primaryText` (as in `CategoryNameForm`) and update
    InviteForm's two uses. This is mechanical and behaviour-preserving; slice 4's Save is the second user.
  - Verify: typecheck and lint; on web the Invite button looks unchanged.
- [x] 4. Edit your ledger label on the Members screen (~125)
  - Files: `apps/mobile/src/data/ledgerLabel.ts` (new), `apps/mobile/test/ledgerLabel.test.ts` (new),
    `apps/mobile/src/data/members.ts`, `apps/mobile/src/app/members.tsx`, `apps/mobile/src/auth/AuthContext.tsx`
    (JSDoc only)
  - Change:
    - `normalizeLabel` and `setLedgerLabel` per Contracts.
    - The `LabelForm` section has:
      - the caption "Your label";
      - a `TextInput` (`accessibilityLabel="Your label"`, placeholder `ledger.name` in `colors.faint`,
        `returnKeyType="done"`, submit on enter, `editable={!busy}`, no `maxLength`, so an over-long paste gets the
        message instead of being cut, and RN's `maxLength` counts UTF-16 units);
      - the helper line;
      - the alert line;
      - Save (accent `primary` button ≥ 44pt, spinner while busy). Save is disabled while busy or while
        `text.trim() === (ledger.label ?? '')`.
    - Saving:
      1. `normalizeLabel(text)`. On null, show the 40-character text and send nothing.
      2. Under `inFlight`: `await setLedgerLabel(ledger.ledgerId, label)`. On `ApiError` `ledger_not_found`,
         `router.dismissTo('/')`: the ledger-gone handler is already moving them, as in MemberLeave. Any other
         failure shows "Couldn’t save…" and stops.
      3. `setText(label)`, then `await openLedger(ledger.ledgerId)` and announce "Label saved.". If the refresh
         rejects, show "Saved, but couldn’t refresh…" instead. Save stays enabled then (the context still has the old
         label), and saving again repeats the same PUT and refreshes.
    - The screen's `ScrollView` gets `keyboardShouldPersistTaps="handled"`, as `CategoryNameForm` and `expense.tsx`
      have, so on iPhone one tap on Save works with the keyboard up (Invite benefits too).
    - Update the screen's JSDoc: everyone can set their own label at the top.
  - Tests: `ledgerLabel.test.ts`, a table in `categoryName.test.ts` style:
    - `''` → `''`, `'   '` → `''`, `'  Family  '` → `'Family'`;
    - `'x'.repeat(40)` → itself, `'x'.repeat(41)` → null;
    - `'😀'.repeat(40)` → itself, `'😀'.repeat(41)` → null (code points).
  - Verify (web 390×844, two profiles; network log open):
    1. AC1: A opens Members on LA (owner) and saves "Family". There is one PUT and one GET `/api/ledgers`, the
       caption shows "Family" at once, and Save is disabled. Back → Home says "Family" and Settings' picker says
       "Family · Yours".
       B opens LA (member, via the picker) → Members → saves "Flat with A". B sees "Flat with A" in all three places,
       and A's display still says "Family" after a reload.
       A quick double tap on Save sends one PUT.
    2. AC2: A clears the field and saves → the picker shows "Home · Yours", Home shows "Kopiyka" and the caption shows
       "claude-qa-056’s Home". B's "Flat with A" stays.
    3. AC3: switch between LA and LB in the picker, then reload the page → the stored choice opens the same ledger,
       labels still show, and GET `/api/ledgers` has the same `ledgerId`s. Budget and Expenses for LA look as before
       the labels.
    4. AC4:
       - Paste 41 characters → "A label can have up to 40 characters." and no PUT.
       - `'  Family  '` saves as "Family".
       - Ten emoji save and show.
       - A fetch stub failing the PUT → "Couldn’t save…" and the label is unchanged.
       - A fetch stub failing only GET `/api/ledgers` → "Saved, but couldn’t refresh…". After a page reload the
         new label shows.
    5. AC5 on the app side: A removes B from LA while B's Members is open on LA. B taps Save → the app leaves to Home
       on LB.
    6. Light and dark. iPhone (Expo Go) at Gate B: steps 1 and 2 as A and B, one tap on Save with the keyboard up,
       VoiceOver reads "Your label" and announces "Label saved.".
    7. Clean up per `kopiyka-local-qa`: A's and B's expenses, then LA and LB (this cascades members and invites),
       then users A and B, then their `login_throttle` username rows.

Total: about 265 changed lines in 5 slices (25 + 90 + 22 + 4 + 125).

## AC → evidence

| AC                                                                                 | Evidence                                                                                             |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Owner and member each set a different label; each sees only theirs in three places | `members.int.test.ts` "your own label": owner and member set different labels; manual slice 4 step 1 |
| Clearing brings back today's display                                               | `members.int.test.ts` clearing cases; manual slice 3 step 1 and slice 4 step 2                       |
| Never changes the ledger's id, data or anyone else's label; switching works        | `members.int.test.ts` (ids, `name`, categories, other's label unchanged); manual slice 4 step 3      |
| Trimmed, 1–40 characters or empty; longer refused with a clear message             | `members.int.test.ts` trim/limit/emoji cases; `ledgerLabel.test.ts`; manual slice 4 step 4           |
| Only a person in the ledger can label it (404 `ledger_not_found`)                  | `members.int.test.ts` stranger and missing-ledger cases; manual slice 4 step 5                       |
| Checked on web at phone width and on the iPhone via Expo Go                        | Verify steps of slices 3 and 4 at 390×844, and slice 4 step 6 on the iPhone, in the PR's test plan   |

## Not doing (YAGNI)

- Renaming the ledger for everyone, labels in invites, labels in Budget/Expenses/Statistics headers (out of scope).
- The label in the Leave confirmation ("Leave claude-qa-056’s Home?"). The brief names three places; the owner's
  name is the clearer thing to confirm there.
- Keeping a label after leaving and rejoining. It goes with the membership row.
- A new AuthContext method, or patching state locally from the PUT response. `openLedger` already refetches.
- Unique labels across a person's ledgers. Not asked for; two ledgers with the same label still differ by "Yours" /
  "`<owner>`’s" in the picker.
- A migration test for 011 (nothing to migrate; see slice 1).

## Risks

- Calling `openLedger` on the open ledger might reload screen data or flash a loading state. The data hooks key on
  `ledger.ledgerId` (a number), and `fetchMe` never sets `loading`. Disproved or proved by slice 4 step 1's network
  log: one PUT and one GET `/api/ledgers`, and no members/month refetch until focus.
- MySQL might count VARCHAR(40) differently from Zod for emoji. Both DBs are `utf8mb4` / `utf8mb4_0900_ai_ci`
  (checked on dev and test, MySQL 26.7.0). Slice 2's 40-emoji case proves it.
- A crash between 011's ALTER and its `schema_migrations` row would make a re-run fail with "Duplicate column". The
  ALTER is one atomic DDL, MySQL has no `ADD COLUMN IF NOT EXISTS`, and the runner says fix forward, as with 009.
  Accepted.
- Applying 011 to the shared dev DB while the main checkout's API runs older code is safe. Every SELECT and INSERT
  on `ledger_members` names its columns, and the new one is nullable (checked with `rg ledger_members apps/api/src`).
- Without `keyboardShouldPersistTaps`, the first tap on Save on iPhone would only dismiss the keyboard. Slice 4
  adds the prop, and step 6 checks it.

## Open questions

- No: is 40 characters a good limit? Kept at 40. It matches category names (`NameBody`, `normalizeName`), Zod and
  MySQL both count code points, and the picker row truncates a long label with "…" while keeping "Yours" visible.
  Home's 22pt title is capped at two lines, which slice 3 step 3 checks.
- No: the picker row with a label shows "`<label>` · Yours/`<owner>`’s". The brief says the label replaces "Home";
  the assumption is that the whose-part stays.
- No: leaving or being removed drops the label, so rejoining starts with today's display.
- No: the texts in Contracts, and Save being disabled while the field matches the saved label.
- No: clearing is sent as `{ label: '' }`, not `null`. One string type keeps the body simple, and the app always
  sends the trimmed field.

## Follow-ups

None found while planning.

## Deviations

## Consolidate

CONSOLIDATE: reused 0 · extracted 0 · left 4

- LEAVE `normalizeLabel` vs `normalizeName` (`data/categoryName.ts`): the same code-point count and 40 limit, but a
  label may be empty (it clears) and a name may not. Two copies, and each comment names the other so they don't
  drift.
- LEAVE `LabelForm` vs `InviteForm` in `members.tsx`: the same field-plus-button shape with the `inFlight` guard, but
  each maps its own outcomes to its own texts (per-screen by convention). They share the styles since slice 3a.
- LEAVE the PUT label route's `[requireAuth, requireLedger]` guard list: the repo's usual inline form.
- LEAVE `setLedgerLabel` beside the other one-call helpers in `data/members.ts`.

## Revision 1

The skeptic approved with edits (2026-11-02):

- Slice 3: `whose` becomes `flexShrink: 0, maxWidth: '50%'`, because `LedgerPicker.tsx:68` already shrinks it and
  usernames can be 64 characters. Home's title gets `numberOfLines={2}`, and Verify step 3 adds a wide (`W`) label.
- Slice 2: the leave test calls DELETE with olena's numeric `userId`, as `MemberParams` requires.
- The `invite`/`inviteText` → `primary`/`primaryText` rename moves out of slice 4 into its own commit, slice 3a.
- `normalizeLabel`'s comment ties it to `normalizeName`.
- A saved PUT followed by a failed refresh now says "Saved, but couldn’t refresh…" instead of "Couldn’t save…"
  (Texts, slice 4 step 3, Verify step 4).
- Inline code that Prettier had split across lines was put back on one line.
