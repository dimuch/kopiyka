import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Hands a just-deleted item from the screen that deleted it to the screen it returns to,
// which shows the Undo bar. One pending delete at a time.

export interface PendingUndo {
  /** What the bar says and VoiceOver announces, e.g. 'Deleted “Coffee”'. */
  message: string;
  /** Brings back what was deleted; rejects when it can't. */
  restore: () => Promise<void>;
}

export interface UndoOffer {
  undo: PendingUndo;
  status: 'offer' | 'restoring' | 'failed';
}

let pending: PendingUndo | null = null;

export function setPendingUndo(undo: PendingUndo): void {
  pending = undo;
}

export function takePendingUndo(): PendingUndo | null {
  const taken = pending;
  pending = null;
  return taken;
}

/** Takes a pending Undo when the screen comes into focus and runs its bar; `onRestored` runs after a successful restore. */
export function useUndoOffer(onRestored: () => void): {
  offer: UndoOffer | null;
  restore: () => Promise<void>;
} {
  // The Undo offer after a delete; it stays until the restore succeeds or it times out.
  const [offer, setOffer] = useState<UndoOffer | null>(null);

  // Coming back from a delete: offer Undo for a few seconds.
  useFocusEffect(
    useCallback(() => {
      const taken = takePendingUndo();
      if (!taken) return;
      setOffer({ undo: taken, status: 'offer' });
      AccessibilityInfo.announceForAccessibility(taken.message);
    }, []),
  );
  // Restarts on each change; never times out while a restore is in flight.
  useEffect(() => {
    if (!offer || offer.status === 'restoring') return;
    const timer = setTimeout(() => setOffer(null), 10_000);
    return () => clearTimeout(timer);
  }, [offer]);

  async function restore() {
    if (!offer || offer.status === 'restoring') return;
    const { undo } = offer;
    setOffer({ undo, status: 'restoring' });
    // Only touch the offer this restore started from: another delete may have replaced it meanwhile.
    try {
      await undo.restore();
      setOffer((o) => (o?.undo === undo ? null : o));
      onRestored();
    } catch {
      setOffer((o) => (o?.undo === undo ? { undo, status: 'failed' } : o));
      AccessibilityInfo.announceForAccessibility('Couldn’t undo');
    }
  }

  return { offer, restore };
}
