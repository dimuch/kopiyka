// Up to 40 characters after trimming, as the API's LabelBody (brief 056); empty clears the label.
const MAX_LABEL = 40;

/**
 * The trimmed label ('' clears it) when it has at most 40 characters, else null. Counts code points like
 * `normalizeName` (data/categoryName.ts) and the API, so an emoji is one character.
 */
export function normalizeLabel(text: string): string | null {
  const label = text.trim();
  return [...label].length <= MAX_LABEL ? label : null;
}
