# Your own label for a ledger

Type: feature

## Why

Every ledger is named "Home", so the app tells them apart by owner ("Home · Yours", "Home · dimuch's"). That isn't
convenient: someone in two or three ledgers wants names that mean something to them ("Family", "Flat with Olena").
People in the same ledger may want different names for it, so the name is per person, not per ledger.

## What

- Each person in a ledger (owner or member) can set their own label for it. The ledger itself keeps its id; only that
  person sees their label. Other people's labels for the same ledger are unchanged.
- The label is edited on the Members screen for the open ledger, which the owner and members both reach from Settings:
  a "Your label" field at the top, saved for this person only.
- Until a label is set, everything shows as today: "Home" with "Yours" or "<owner>'s". Clearing the label goes back to
  that.
- Where the label shows (when set):
  - the Settings Ledger picker rows, instead of "Home";
  - Home's title, for the open ledger (today it says "Kopiyka");
  - the Members screen caption (today "dimuch's Home").

## Acceptance criteria

- [ ] An owner and a member of the same ledger each set a different label; each sees only their own, in the Settings
      picker, Home's title and the Members caption.
- [ ] Clearing the label brings back today's display ("Home" with "Yours" / "<owner>'s"; "Kopiyka" on Home).
- [ ] Setting a label never changes the ledger's id, its data, or anyone else's label; switching ledgers and the stored
      ledger choice keep working.
- [ ] A label is trimmed, 1–40 characters (or empty to clear); anything longer is refused with a clear message.
- [ ] Only a person in the ledger can label it (a non-member gets 404 `ledger_not_found`).
- [ ] Checked on web at phone width and on the iPhone via Expo Go.

## Out of scope

- Renaming the ledger for everyone (`ledgers.name` stays "Home").
- Showing labels in invites: an invite still says "<owner> invited you to Home", since the invitee has no label for a
  ledger they're not in yet.
- Labels on other screens (Budget, Expenses, Statistics headers).

## Decisions

- The label is edited on the Members screen, for owner and members alike. Decided by the user on 2026-11-02.
- Before a label is set, the display is as today. Decided by the user on 2026-11-02.
- The label shows in the Settings picker, Home's title and the Members caption. Decided by the user on 2026-11-02.

## Open questions

- Is 40 characters a good limit? (Planned default; the picker row has room for about that at phone width.)
