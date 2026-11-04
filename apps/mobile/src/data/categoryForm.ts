import type { Category } from '@/api/types';
import { normalizeName } from '@/data/categoryName';
import { normalizePlanned } from '@/format';

/** A category's checked name and planned EUR ('12.50'). */
export interface CategoryFields {
  name: string;
  amount: string;
}

type Current = Pick<Category, 'displayName' | 'plannedEur'>;

/**
 * The typed name and amount as the API takes them, or what to tell the user. `current` is the category when editing,
 * null when adding. A blank amount plans €0 when adding; when editing it's refused, so clearing the field can't wipe a
 * limit. An untouched name passes unchecked: one imported from Notion can be over 40 characters (brief 065).
 */
export function checkFields(
  nameText: string,
  amountText: string,
  current: Current | null,
): CategoryFields | { error: string } {
  const name = nameText === current?.displayName ? nameText : normalizeName(nameText);
  if (name === null) return { error: 'A name needs 1 to 40 characters.' };
  const amount = current === null && amountText.trim() === '' ? '0.00' : normalizePlanned(amountText);
  if (amount === null) return { error: 'Enter an amount in euros, like 120 or 120.50.' };
  return { name, amount };
}

/** The checked fields that differ from the category: saving only these leaves what a member changed meanwhile alone. */
export function changedFields(fields: CategoryFields, current: Current): Partial<CategoryFields> {
  return {
    ...(fields.name !== current.displayName && { name: fields.name }),
    ...(fields.amount !== current.plannedEur && { amount: fields.amount }),
  };
}
