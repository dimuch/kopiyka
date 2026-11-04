import { describe, expect, it } from 'vitest';
import { changedFields, checkFields } from '@/data/categoryForm';

const nameError = { error: 'A name needs 1 to 40 characters.' };
const amountError = { error: 'Enter an amount in euros, like 120 or 120.50.' };
const rent = { displayName: 'Rent', plannedEur: '120.50' };
// Imported from Notion, where names have no 40-character cap.
const longName = 'x'.repeat(41);

describe('checkFields when adding', () => {
  it.each([
    ['  Dog food  ', '120,50', { name: 'Dog food', amount: '120.50' }],
    ['Dog food', '120.5', { name: 'Dog food', amount: '120.50' }],
    ['Dog food', '', { name: 'Dog food', amount: '0.00' }],
    ['Dog food', '   ', { name: 'Dog food', amount: '0.00' }],
    ['Dog food', '0', { name: 'Dog food', amount: '0.00' }],
    ['   ', '10', nameError],
    [longName, '10', nameError],
    ['Dog food', 'abc', amountError],
    ['Dog food', '-1', amountError],
    ['Dog food', '1.234', amountError],
  ])('%j and %j give %j', (name, amount, expected) => {
    expect(checkFields(name, amount, null)).toEqual(expected);
  });
});

describe('checkFields when editing', () => {
  it.each([
    ['Home', '200', rent, { name: 'Home', amount: '200.00' }],
    ['Rent', '0', rent, { name: 'Rent', amount: '0.00' }],
    ['Rent', '', rent, amountError],
    ['Rent', '   ', rent, amountError],
    ['Rent', 'abc', rent, amountError],
    ['', '120.50', rent, nameError],
    [longName, '120.50', rent, nameError],
    // An untouched name passes, however long; a changed one has to fit.
    [longName, '5', { displayName: longName, plannedEur: '0.00' }, { name: longName, amount: '5.00' }],
    [`${longName}y`, '5', { displayName: longName, plannedEur: '0.00' }, nameError],
  ])('%j and %j on %j give %j', (name, amount, current, expected) => {
    expect(checkFields(name, amount, current)).toEqual(expected);
  });
});

describe('changedFields', () => {
  it.each([
    [{ name: 'Home', amount: '120.50' }, { name: 'Home' }],
    [{ name: 'Rent', amount: '200.00' }, { amount: '200.00' }],
    [
      { name: 'Home', amount: '200.00' },
      { name: 'Home', amount: '200.00' },
    ],
    [{ name: 'Rent', amount: '120.50' }, {}],
    [{ name: 'rent', amount: '120.50' }, { name: 'rent' }],
  ])('%j against Rent at 120.50 gives %j', (fields, expected) => {
    expect(changedFields(fields, rent)).toEqual(expected);
  });

  it('treats 120.5 as no change to 120.50 once checked', () => {
    const fields = checkFields('Rent', '120.5', rent);
    expect(fields).toEqual({ name: 'Rent', amount: '120.50' });
    if ('error' in fields) throw new Error('expected fields');
    expect(changedFields(fields, rent)).toEqual({});
  });
});
