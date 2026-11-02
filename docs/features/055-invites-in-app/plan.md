# Plan: Invites in the app

Status: approved

Brief: ./brief.md
Branch: feat/invites-in-app
Base: origin/main at `8636b16` (PR #68, brief 054, merged). Contracts below were read in `apps/api/src/invites/routes.ts`
and `apps/api/src/ledgers/routes.ts` at that commit.

Design source: `../052-ledger-invites/plan.md`, Part 4 (slices 4.1–4.3) and its App contracts. The brief's Decisions
(2026-11-02) and 053/054 as merged override it; see "Changed from the 052 design".

## Approach

- **Owner side** stays in `app/members.tsx`'s `OwnerMembers`. The member list already returns the ledger's live
  invites (054, owner-only), so the screen adds an "Invited" list with Revoke and an "Invite by username" form. Both
  call `data/members.ts` and reload `useMembers`. A member's view (`MemberLeave`) is unchanged.
- **Invitee side** has one source: `InvitesProvider` in `data/invites.tsx`, mounted once in the root layout inside
  `AuthProvider`. It holds the signed-in user's live invites, Accept and Decline, the busy invite and the last failure.
  The Settings tab badge, Home's list, Settings' list and the no-ledger screen all read it through `useInvites()`, so
  an Accept on Home updates the badge at once and nothing drifts.
- **Freshness without polling**: the tab navigator reloads on every tab focus
  (`screenListeners={{ focus: reload }}`). That covers sign-in, each tab tap and the return from a pushed screen
  (React Navigation re-emits `focus` to the focused tab). The no-ledger screen reloads on focus and has a "Check for
  invites" button. Every Accept and Decline refetches. An invite that expired while shown answers 404, and the screen
  says so and refetches.
- **Accept** posts, then calls `openLedger(invite.ledgerId)`. `openLedger` now also works from `noLedger`; today it
  returns early there. The guard flips to `(tabs)`, as after sign-in.

Alternative considered: one `useInvites()` hook per screen, shaped like `useMembers` (the 052 contract). It lost
because the badge lives in the tab layout, which would need a fourth fetch. An Accept on Home would then leave the
badge stale until the next tab change. The provider costs about the same lines and is the single source the decision
needs.

### Changed from the 052 design

- The member list is owner-only (053/054), so only the owner sees "Invited". A member's Members screen is unchanged.
- One provider (`data/invites.tsx`) replaces `data/invites.ts` + `data/useInvites.ts`. The accept and decline calls are
  inline there, since the provider is their only caller.
- Decision: the Settings tab badge and a Settings list. Home keeps its list.
- Decision (054): an invite expires after 1 hour. Accept, Decline and Revoke on an expired one get `404 not_found`,
  with text for each.
- 052's "Accepted. Couldn’t open it yet — pick it in Settings." can't work. Settings' picker shows `ledgers` from the
  last `fetchMe`, which a failed `openLedger` didn't update. The new text says to reopen the app.
- `openLedger` must work from `noLedger` (`AuthContext.tsx:89` returns early today), or Accept on the no-ledger screen
  would join and stay put.
- 052's Not doing ruled out a "Check again" button on no-ledger because the list "reloads on focus". But a user
  waiting on that screen never changes focus, so the button is back (see Open questions).

## Contracts

- DB: none.
- API: none new. The app uses #68's routes:
  - `GET /api/ledgers/:id/members` returns 200 `{ members, invites: [{ inviteId, username }] }` (owner only).
  - `POST /api/ledgers/:id/invites` takes `{ username }` and returns 201 `{ inviteId, username }`. Errors:
    `409 cannot_invite`, `403 owner_only`, `400`.
  - `DELETE /api/ledgers/:id/invites/:inviteId` returns 204, or `404 not_found` (unknown, used or expired).
  - `GET /api/invites` returns 200 `{ invites: [{ inviteId, ledgerId, ledgerName, owner }] }`, the caller's live
    invites by `invite_id`.
  - `POST /api/invites/:inviteId/accept` and `DELETE /api/invites/:inviteId` (decline) return 204, or
    `404 not_found` unless it's the caller's live pending invite.
  - All of them return 401 without a session.
- App:
  - `api/types.ts`:
    - `PendingInvite { inviteId: number; username: string }`: someone invited to the open ledger, as its owner sees
      them.
    - `LedgerMembers` gains `invites: PendingInvite[]`.
    - `Invite { inviteId: number; ledgerId: number; ledgerName: string; owner: string }`: an invite to the signed-in
      user.
  - `data/members.ts`:
    - `inviteMember(ledgerId: number, username: string): Promise<PendingInvite>` (POST, body `{ username }`).
    - `revokeInvite(ledgerId: number, inviteId: number): Promise<void>` (DELETE).
  - `data/invites.tsx`:
    - `InvitesProvider({ children }: { children: ReactNode })`.
    - `useInvites(): InvitesApi`, which throws outside the provider, like `useAuth`. `InvitesApi` is:
      ```ts
      {
        invites: Invite[] | null; // the signed-in user's live invites; null until loaded for this user
        error: boolean; // the latest load failed; a failed refetch keeps `invites`
        reload: () => void; // stable; clears `failure` and refetches (screens: tab focus, Retry, Check for invites)
        busyId: number | null; // the invite being accepted or declined; all its buttons are disabled meanwhile
        failure: string | null; // why the last Accept/Decline failed
        accept: (invite: Invite) => void;
        decline: (invite: Invite) => void;
      }
      ```
    - Inside the provider, Accept and Decline refetch by bumping `version` directly, which keeps `failure`.
    - The state is tagged like `useMembers`: `loaded: { userId; invites }` and `failed: attempt` with
      `attempt = `${userId}#${version}``. Another user (sign-out, then sign-in) reads as `null`, so nobody sees the
      previous user's invites.
    - The fetch runs in a `useEffect` on `[userId, version]` with `let live`, and skips only while `userId === null`.
      So the list loads as soon as there's a user (sign-in, or a cold start with a stored session), whether or not a
      focus event comes.
    - `userId` comes from `useAuth().state` when the status is `signedIn` or `noLedger`.
    - `accept` and `decline` use the `inFlight` ref plus `busyId` (budget.tsx / Settings' `switchTo` pattern).
      Failures are announced here, once (`AccessibilityInfo.announceForAccessibility`). Home and Settings stay
      mounted together as tabs, so an effect in the component would announce twice.
  - `auth/AuthContext.tsx`: `openLedger` runs when `state.status` is `signedIn` or `noLedger`. Its JSDoc adds "also
    from no-ledger, after accepting an invite".
  - `components/PendingInvites.tsx`:
    `{ invites: Invite[]; busyId: number | null; failure: string | null; onAccept: (i: Invite) => void; onDecline: (i: Invite) => void; style?: StyleProp<ViewStyle> }`.
    It renders `null` when there are no invites and no failure. Otherwise it shows the caption "Invites", one card per
    invite reading "`<owner>` invited you to `<ledgerName>`" with Decline and Accept, and then the alert-role failure
    line. The line sits below the list, because the row it is about is gone after the refetch. `style` is for
    Settings' section margin. Callers: Home, Settings, no-ledger.
  - Routes: no new ones. `app/_layout.tsx` wraps `<Screens />` in `<InvitesProvider>`.
- Reuses: `useMembers` and its `reload`; `api()` and `ApiError`; `openLedger`; `LoadError`; the `inFlight` + busy
  double-tap guard; `dangerText` for Revoke; ConfirmPanel's button shapes (`confirm`/`cancel`, copied into
  `PendingInvites` with the accent fill); login's labelled `TextInput` props; the `useMembers` tagged-state shape for
  the provider.
- New dependencies: none.

### Texts

| Where          | When                           | Text                                                                                                     |
| -------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Accept/Decline | `404 not_found`                | "`<owner>`’s invite has expired or was withdrawn."                                                       |
| Accept         | other failure                  | "Couldn’t accept. Check your connection and try again."                                                  |
| Decline        | other failure                  | "Couldn’t decline. Check your connection and try again."                                                 |
| Accept         | 204, then `openLedger` rejects | "Joined `<owner>`’s `<ledgerName>`, but couldn’t open it yet. Check your connection and reopen the app." |
| Invite form    | `409 cannot_invite`            | "Can’t invite `<name>`. Check the spelling; they may already be in this ledger or invited to it."        |
| Invite form    | other failure                  | "Couldn’t invite. Check your connection and try again."                                                  |
| Revoke         | `404 not_found`                | "`<username>`’s invite has already expired or been answered."                                            |
| Revoke         | other failure                  | "Couldn’t revoke. Check your connection and try again."                                                  |
| no-ledger      | load failed                    | "Couldn’t check for invites. Check your connection and try again." (`LoadError` + Retry)                 |

## Slices

QA setup, used by every Verify below (per `kopiyka-local-qa`):

- Run the API from this worktree on this branch, so it has #68's routes, with the main checkout's
  `apps/api/.env`. Run `yarn api migrate` (applies 010).
- Web: Metro from this worktree, viewport 390×844.
- Users:
  - A: `yarn api create-user --username claude-qa-055 --email claude-qa-055@example.test` (owns a ledger).
  - B: `claude-qa-055b` the same way (owns a ledger).
  - C: `claude-qa-055c … --join claude-qa-055` (a member of A's ledger).
  - D: `claude-qa-055d` the same way as A (owns a ledger), a second inviter, so no invite touches dimuch's ledger.
- Keep the TOTP secrets only in the session scratchpad. Login codes come from a scratch `tsx` script using
  `hotp(base32Decode(secret), timeStep(Date.now()))` from `apps/api/src/auth/totp.ts`. Sessions last 30 minutes.
- Use one browser profile per user and keep the network log open.

The slices, in order:

- [ ] 1. Invite someone by username from the Members screen (~120)
  - Files: `apps/mobile/src/api/types.ts`, `apps/mobile/src/data/members.ts`, `apps/mobile/src/data/useMembers.ts`
    (JSDoc: "members and pending invites"), `apps/mobile/src/app/members.tsx`
  - Change: `PendingInvite`, `LedgerMembers.invites`, `inviteMember`.
    - Below the members list, `OwnerMembers` renders two local components that share `useMembers`' `data` and
      `reload`. Each has its own `busy`/`inFlight`/`failure`.
    - `PendingList({ ledgerId, invites, onChange })` has the caption "Invited" and one row per invite (username).
      It renders `null` when there are no invites and no failure.
    - `InviteForm({ ledgerId, onInvited })` has the caption "Invite by username" and a `TextInput`
      (`accessibilityLabel="Username to invite"`, `autoCapitalize="none"`, `autoCorrect={false}`, `maxLength={64}`,
      `returnKeyType="send"`, submit on enter). Below it sits the helper line "They’ll see it in the app for an hour."
      and then the Invite button (≥ 44pt, disabled while the trimmed text is empty or the form is busy).
    - On success, the form clears the field, announces "Invited `<username>`." (the stored name) and calls
      `onInvited`. On failure, an alert-role line shows the text from Contracts and announces it.
    - Update the screen's JSDoc to mention invites.
  - Verify (web 390×844, as A):
    - With no invites, Members shows the form under the list and no "Invited".
    - Invite `claude-qa-055b` → "Invited" lists claude-qa-055b and the field is empty.
    - Invite claude-qa-055b again, `nobody-055`, and `claude-qa-055c` (a member). Each gets the `cannot_invite` text.
    - A quick double tap on Invite sends one POST.
    - As C, Members shows no form and no "Invited" (unchanged).
    - In B's profile, `fetch('/api/invites', { credentials: 'include' })` lists A's invite.
    - Light and dark at a glance.
- [ ] 2. Revoke a pending invite from the Members screen (~50)
  - Files: `apps/mobile/src/data/members.ts`, `apps/mobile/src/app/members.tsx`
  - Change: `revokeInvite`. `PendingList` rows get "Revoke" (`dangerText`, ≥ 44pt, label "Revoke invite to
    `<username>`"). It is one tap, with no second tap (see Open questions). All Revokes are disabled while busy.
    - On success, call `onChange` (reload).
    - On `not_found`, show the text from Contracts and call `onChange`. The line stays under the (now shorter) list,
      because `PendingList` stays mounted.
    - On any other failure, show the text and keep the row.
    - The failure line clears at the start of the next Revoke.
  - Verify (web, A and B):
    - A revokes B → the row goes, with one DELETE. B's `/api/invites` is `[]`.
    - A invites B again. Expire it with SQL: `UPDATE ledger_invites SET expires_at = created_at WHERE invite_id = <id>`.
      A taps Revoke → "claude-qa-055b’s invite has already expired or been answered." and the row goes.
- [ ] 3. Keep the signed-in user's pending invites in one place for the app (~125)
  - Files: `apps/mobile/src/api/types.ts`, `apps/mobile/src/data/invites.tsx` (new),
    `apps/mobile/src/auth/AuthContext.tsx`, `apps/mobile/src/app/_layout.tsx`
  - Change: `Invite`, the provider and hook per Contracts, the `openLedger` guard, and the root-layout mount.
    - Accept runs in this order. Set `busyId` and clear `failure`. `POST …/accept`; on failure, show the text, refetch
      (version bump, not `reload`) and stop. Then `await openLedger(invite.ledgerId)`; if that rejects, show the
      "Joined…" text. Refetch (version bump, not `reload`). Clear `busyId`.
    - Decline: `DELETE /api/invites/:id`. On failure, show the text. Refetch (version bump, not `reload`) either way.
    - The value is `useMemo`'d, as in `AuthContext`.
  - Verify: typecheck and lint. Slice 4 is the first caller. There's no pure logic to unit-test, the same as
    `useMembers`. On web, signing in as B makes one GET `/api/invites` (the provider's load on the new user).
- [ ] 4. Show pending invites on Home and the no-ledger screen with Accept and Decline (~135)
  - Files: `apps/mobile/src/components/PendingInvites.tsx` (new), `apps/mobile/src/app/(tabs)/index.tsx`,
    `apps/mobile/src/app/(tabs)/_layout.tsx`, `apps/mobile/src/app/no-ledger.tsx`
  - Change:
    - `PendingInvites` per Contracts. Each card has the surface and border. The text "claude-qa-055 invited you to
      Home" is one accessible element. Decline is a muted text button and Accept an accent pill, both ≥ 44pt,
      labelled "Accept invite from `<owner>` to `<ledgerName>`" and "Decline invite from …". The busy card shows a
      small spinner, and all buttons are disabled while `busyId !== null`.
    - Home renders it between the header and the grid. It shows `invites ?? []`, with no loading or error block,
      the same as Home's figures (index.tsx:23).
    - The tabs layout gets `screenListeners={{ focus: reload }}`.
    - no-ledger calls the hooks before its `status` early return, plus `useFocusEffect(reload)`. Under the text it
      shows:
      - an `ActivityIndicator` while `invites === null && !error`;
      - `LoadError` with Retry on `error`;
      - the list;
      - a "Check for invites" text button (accent, ≥ 44pt) that calls `reload`.
    - no-ledger's JSDoc changes from "all they can do is sign out" to "they can accept an invite or sign out".
  - Verify (web 390×844, two profiles):
    1. AC1: A invites B on Members. B taps Home → "claude-qa-055 invited you to Home". There's one GET
       `/api/invites` per tab tap.
       B taps Accept, with a quick double tap → one POST. Home's figures are now A's ledger, and the card is gone.
       Settings lists two ledgers with A's selected. A's Members, after Back and reopening, lists B as Member and
       has no "Invited".
       Cold start: with A's invite pending, reload the page as B (session kept) → one GET /api/invites without a tab
       tap, and the card shows.
    2. Decline (AC2): A removes B. A invites B again. B declines → the card goes, and B's ledgers are unchanged.
       A's Members, reopened, shows no "Invited".
    3. Revoke on the invitee side (AC2): A invites B. B sees the card. A revokes it. B taps another tab and then
       Home → the card is gone.
    4. Expired:
       - A invites B. B sees the card. Expire the invite by SQL. B taps Accept → "claude-qa-055’s invite has
         expired or was withdrawn." The card goes and B has no new ledger.
       - Repeat with Decline.
       - With a fetch stub failing `…/accept`: "Couldn’t accept…", and the card stays.
    5. AC3: A removes C on Members. C's next tap → no-ledger, with no invites. A invites C. C taps "Check for
       invites" → the card. C taps Accept → the tabs open on A's ledger (Home), and Settings has no picker.
       A fetch stub failing `/api/invites` on no-ledger → the load error with Retry.
    6. Light and dark at a glance. iPhone (Expo Go) at Gate B: steps 1 and 5, plus two invite cards on Home (A and D
       both invite B; Home doesn't scroll, so the grid must still fit).
- [ ] 5. Badge the Settings tab with the invite count and list the invites in Settings (~30)
  - Files: `apps/mobile/src/app/(tabs)/_layout.tsx`, `apps/mobile/src/app/(tabs)/settings.tsx`
  - Change:
    - Tab layout:
      - `count = invites?.length ?? 0`.
      - The Settings tab gets `tabBarBadge: count > 0 ? count : undefined` and
        `tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.onAccent }`.
      - The badge text isn't read by screen readers, so the tab's hidden `tabBarLabel` becomes "Settings, 2
        invites" ("1 invite"). iOS builds its label from it ("…, tab, 5 of 5"). On web,
        `tabBarAccessibilityLabel` gets the same string.
    - Settings renders `<PendingInvites style={styles.section} …/>` right under the account card, so the badge
      leads to it.
  - Verify (web 390×844, as C, now in A's ledger after slice 4):
    1. Badge: B and D each invite C on their Members screens. C taps any tab → the Settings tab shows "2", and its
       aria-label is "Settings, 2 invites".
    2. Settings list: Settings lists both, with Accept and Decline. C declines D's → the badge shows "1" at once,
       with no tab tap.
    3. Accept from Settings: C accepts B's → the app opens B's ledger, the picker shows two ledgers with B's
       selected, and the badge is gone.
    4. Revoke updates the badge: B removes C. B invites C again, then revokes it. C's badge goes on the next tab tap.
    5. Light and dark. iPhone (Expo Go) at Gate B: steps 1–3, plus VoiceOver reading the Settings tab with a
       count, and relaunch Expo Go with a pending invite → the badge shows.
    6. Clean up per `kopiyka-local-qa`: A's, B's and D's expenses and then their ledgers (this cascades members and
       invites), then users A, B, C and D (this cascades sessions and invite rows), then their `login_throttle`
       username rows.

Total: about 460 changed lines in 5 slices (120 + 50 + 125 + 135 + 30). There are no unit tests: no slice adds pure logic. That is over
the ~400 target; see Open questions for the split.

## AC → evidence

| AC                                                                                            | Evidence                                                                                                         |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| End to end: owner invites on Members; invitee sees it on Home, accepts, app shows that ledger | manual slice 1 (invite) and slice 4 step 1 (Home card → Accept → A's ledger, picker selected)                    |
| Decline and revoke make the invite disappear for both sides                                   | manual slice 2 (revoke, owner side), slice 4 steps 2–3 (decline both sides, revoke invitee side), slice 5 step 4 |
| A user removed from their only ledger can accept from the no-ledger screen                    | manual slice 4 step 5                                                                                            |
| Settings tab shows the count; Settings lists them with Accept and Decline; badge goes at 0    | manual slice 5 steps 1–4                                                                                         |
| Checked on web at phone width and on the iPhone via Expo Go                                   | the Verify steps of slices 1, 2, 4 and 5 at 390×844, and the iPhone steps at Gate B, in the PR's test plan       |
| Decision (054): an expired invite answers 404 to Accept, Decline and Revoke                   | manual slice 2 (Revoke text), slice 4 step 4 (Accept and Decline text)                                           |

## Not doing (YAGNI)

- Polling, refreshing when the app returns to the foreground, or push (out of scope). Tab focus, the no-ledger
  button and every action are the refresh points.
- Showing when an invite expires, or a countdown. The DTOs have no time fields (054's Not doing), and the form's
  helper line says "an hour".
- A second tap for Revoke, Decline or Accept. Each can be undone by inviting again (Accept by leaving).
- Retrying `openLedger` after an accept whose open failed, or refreshing `ledgers` when Settings gains focus.
- A badge on the Home tab or the app icon. The decision names the Settings tab.
- Making Settings scroll (`PlaceholderPage` doesn't). See Risks.
- Showing pending invites to members on the Members screen. The API is owner-only.
- A hint on no-ledger such as "Ask a ledger’s owner to invite you". Not asked for.

## Risks

- `screenListeners.focus` might not fire for the first tab after sign-in, or on return from a pushed screen, or on a
  cold start with a stored session. The badge would then lag (the provider's load on the new user covers the first
  and the last). The installed `useFocusEvents` re-emits the parent's `focus` to the focused child, and
  `TabsClient` accepts `screenListeners`. Slice 4 step 1's network log (tab taps and the cold-start reload) proves it. If it fails, Home and Settings
  call `useFocusEffect(reload)` instead.
- `openLedger` from `noLedger` might not flip `Stack.Protected` from no-ledger to `(tabs)`. 052 proved the reverse
  direction. Slice 4 step 5 proves it.
- Settings doesn't scroll. With the Ledger section, Members, Appearance and three or more invites, Sign out could be
  pushed under the tab bar at 390×844. Invites last an hour and each owner can send one, so two is the realistic
  maximum. Slice 5 step 1 (two invites plus a picker after step 3) shows the fit. If it doesn't fit, Settings' body
  moves into a `ScrollView` in that slice.
- Every sign-in makes two `/api/invites` requests (the provider's load on the new user, then the first tab's focus).
  The second one wins and both are harmless. Accepted, so a cold start never depends on a focus event.
- Migration 010 on the shared dev DB drops the empty `ledger_invites`. The main checkout's older API never reads it,
  so that's safe.

## Open questions

- No: Revoke, Decline and Accept are one tap. Unlike Remove and Leave (053), each can be undone by inviting again.
- No: the "Check for invites" button on no-ledger. 052 dropped it, but a user waiting on that screen otherwise has
  to restart the app to see a new invite (AC3). The assumption is to keep it (~8 lines).
- No: the invite form's helper line "They’ll see it in the app for an hour." Without it, the owner sees a pending
  row vanish after an hour with no reason. The assumption is to keep it (1 line).
- No: where the Settings list goes. It goes right under the account card, above the Ledger picker, so the badge
  leads straight to it.
- No: the texts in Contracts. One 404 text covers expired, revoked and answered elsewhere, because the API doesn't
  tell them apart.
- No: the size. At ~460 lines this is over the ~400 target. It can split into the owner side (slices 1–2, ~170) and
  the invitee side (slices 3–5, ~290) as two sequential briefs. Each ships safely: invites nobody can see just
  expire. The assumption is one PR, because AC1 runs through both halves and they'd be reviewed back to back.

## Follow-ups

- Settings still says "Coming soon." (`PlaceholderPage`) above real settings (052's follow-up). It reads oddly
  next to invites.

## Deviations

## Consolidate

## Revision 1

Skeptic edits. Base is now `0cc3fd2` with #68 merged; the two rebase risks are gone. `reload` clears `failure`, while
Accept and Decline refetch by bumping `version`, so their failure text survives the refetch. The cold-start checks are
added (slice 4 step 1, slice 5's iPhone step, the first Risk). Suggestions taken:

- The provider loads whenever `userId` changes, with no lazy `version === 0` skip.
- A fourth QA user `claude-qa-055d` replaces the SQL invite into dimuch's ledger.
- Two cards on Home are checked on the iPhone.
- The no-ledger JSDoc update is named.
- `PendingList`'s failure clears at the next Revoke.

Estimates unchanged at ~460.
