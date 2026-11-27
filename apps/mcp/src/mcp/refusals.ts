export const ALREADY_SAVED_NOTE =
  'An identical expense was saved in the last 10 minutes, so no second one was added. ' +
  'To add another on purpose, give it a name that tells them apart.';

const SAVED_NOTHING = 'This call saved nothing.';
const CHANGED_NOTHING = 'This call changed nothing.';
const DELETED_NOTHING = 'This call deleted nothing.';

/** Refusals every write tool shares: a read-only connection, and a ledger this user can't reach. */
const WRITE_ACCESS_REFUSALS = {
  insufficient_scope:
    'This connection can only read. Disconnect Kopiyka in Claude’s connectors, connect, and allow it.',
  ledger_not_found: 'No such ledger for this user; use list_ledgers.',
};

/** The API's refusals of an expense's fields, the same for adding and changing one. */
const EXPENSE_INPUT_REFUSALS = {
  category_not_in_month:
    'That category isn’t in that month’s list; use a categoryId from month_summary for that month.',
  unknown_category: 'That isn’t a category of this ledger.',
  invalid_request:
    'The amount must be positive with at most 8 digits and 2 decimals, the date a real YYYY-MM-DD from 2000 on, and the name at most 200 characters.',
  date_in_future: 'The date is too far ahead.',
  rate_unavailable: 'The NBU rate isn’t available; try later.',
};

/** Each sentence, followed by what the call didn't do. */
const ending = (sentences: Record<string, string>, didNothing: string) =>
  Object.fromEntries(Object.entries(sentences).map(([code, sentence]) => [code, `${sentence} ${didNothing}`]));

const lostAnswerFor = (sentence: string) => ({ api_unreachable: sentence, api_error: sentence, internal: sentence });

/** What the LLM can do about each API code. `date` is the one this call used, so a repeat can't land on another day. */
export function addExpenseRefusals(date: string): Record<string, string> {
  return {
    ...ending(
      {
        ...WRITE_ACCESS_REFUSALS,
        ...EXPENSE_INPUT_REFUSALS,
      },
      SAVED_NOTHING,
    ),
    // A repeat just after the month's end comes here too, though the first call saved: the month check goes first.
    month_ended: `That month has ended and is read-only. ${SAVED_NOTHING} If an earlier call for this expense got no answer, it may have been saved: check with list_expenses.`,
    ...lostAnswerFor(
      'The answer was lost, so it may be saved. Repeat within 10 minutes with the same inputs and date set to ' +
        `${date}: it’s safe.`,
    ),
  };
}

export const UPDATE_EXPENSE_REFUSALS = {
  ...ending(
    {
      ...WRITE_ACCESS_REFUSALS,
      not_found: 'No live expense with that id in this ledger; find it with list_expenses.',
      month_ended: 'That month has ended and is read-only; an expense can’t move into or out of it either.',
      ...EXPENSE_INPUT_REFUSALS,
    },
    CHANGED_NOTHING,
  ),
  ...lostAnswerFor('The answer was lost, so it may be saved. The same call repeated is safe.'),
};

export const DELETE_EXPENSE_REFUSALS = {
  ...ending(
    {
      ...WRITE_ACCESS_REFUSALS,
      not_found:
        'No live expense with that id in this ledger. If an earlier call got no answer, it may already be deleted: ' +
        'check list_expenses.',
      month_ended: 'That month has ended and is read-only.',
    },
    DELETED_NOTHING,
  ),
  ...lostAnswerFor('The answer was lost, so it may be deleted. The same call repeated is safe.'),
};

const INCOME_INPUT_REFUSAL =
  'The title must be 1 to 40 characters, and the amount positive with at most 8 digits and 2 decimals.';

export const ADD_INCOME_REFUSALS = {
  ...ending(
    {
      ...WRITE_ACCESS_REFUSALS,
      month_ended: 'That month has ended and is read-only.',
      invalid_request: INCOME_INPUT_REFUSAL,
    },
    SAVED_NOTHING,
  ),
  ...lostAnswerFor(
    'The answer was lost, so it may be saved. Check list_income before adding it again: a repeat adds a second one.',
  ),
};

const OVER_INCOME_REFUSAL =
  'That would leave the month planned above its income; lower a planned amount in the app first.';

export const UPDATE_INCOME_REFUSALS = {
  ...ending(
    {
      ...WRITE_ACCESS_REFUSALS,
      not_found: 'No income with that id in this ledger; use list_income.',
      month_ended: 'That month has ended and is read-only.',
      invalid_request: INCOME_INPUT_REFUSAL,
      over_income: OVER_INCOME_REFUSAL,
    },
    CHANGED_NOTHING,
  ),
  ...lostAnswerFor('The answer was lost, so it may be saved. The same call repeated is safe.'),
};

export const DELETE_INCOME_REFUSALS = {
  ...ending(
    {
      ...WRITE_ACCESS_REFUSALS,
      not_found:
        'No income with that id in that month. If an earlier call got no answer, it may already be deleted: check ' +
        'list_income, and to add it back use the title and amount from an earlier list_income.',
      month_ended: 'That month has ended and is read-only.',
      over_income: OVER_INCOME_REFUSAL,
    },
    DELETED_NOTHING,
  ),
  ...lostAnswerFor('The answer was lost, so it may be deleted. The same call repeated is safe.'),
};

export const DELETED_INCOME_NOTE = 'Deleted for good: to undo, add it again with add_income from this answer.';

export const DELETED_EXPENSE_NOTE =
  'It can’t be brought back from Claude, and the app can’t restore it either. To undo, add it again with add_expense ' +
  'from this answer.';
