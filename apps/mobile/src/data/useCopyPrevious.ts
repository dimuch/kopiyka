import { useRef, useState } from 'react';
import { ApiError } from '@/api/apiError';
import { copyRefusedText } from '@/data/monthCopy';

/**
 * The "copy last month" button's flow for a 'YYYY-MM' month (Budget's categories, Income's items): `startCopy` runs
 * `copy`, then reloads. `note` is the refusal or failure to show; `hideCopy` is true once a copy was refused in this
 * month or has just landed, so the button doesn't come back.
 */
export function useCopyPrevious({
  ledgerId,
  month,
  copy,
  current,
  reload,
  reloadPrevious,
}: {
  ledgerId: number;
  month: string;
  copy: (ledgerId: number, month: string) => Promise<void>;
  /** The month's loaded list, compared by identity only. */
  current: object | null;
  reload: () => void;
  reloadPrevious: () => void;
}): { busy: boolean; note: string | null; hideCopy: boolean; startCopy: () => Promise<void> } {
  const [busy, setBusy] = useState(false);
  // Tagged with their ledger and month, so switching either clears them without an effect.
  const shown = `${ledgerId}/${month}`;
  const [refused, setRefused] = useState<{ shown: string; text: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // The empty month loaded before a successful copy: the list hook keeps it until the reload lands, so without this
  // Copy would flash back.
  const [copiedOver, setCopiedOver] = useState<object | null>(null);
  // `busy` disables the button only after a re-render; two presses in one tick would both get here.
  const inFlight = useRef(false);

  async function startCopy() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(null);
    const before = current;
    try {
      await copy(ledgerId, month);
      setCopiedOver(before);
      reload();
    } catch (err) {
      const refusedText = err instanceof ApiError ? copyRefusedText(err.code, month) : null;
      if (refusedText) {
        setRefused({ shown, text: refusedText });
        // A budget_exists or income_exists brings the list in; a no_previous_budget or no_previous_income refreshes
        // the previous month.
        reload();
        reloadPrevious();
      } else {
        setFailed(shown);
      }
    } finally {
      // The screen stays mounted, so a later copy into another month must work.
      inFlight.current = false;
      setBusy(false);
    }
  }

  const refusal = refused?.shown === shown ? refused.text : null;
  const note = refusal ?? (failed === shown ? 'Couldn’t copy. Check your connection and try again.' : null);
  return { busy, note, hideCopy: !!refusal || current === copiedOver, startCopy };
}
