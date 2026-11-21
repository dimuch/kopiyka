import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  type GestureResponderEvent,
  PanResponder,
  type PanResponderInstance,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useColors } from '@/appearance/AppearanceContext';
import { dropIndex, rowOffset } from '@/data/reorder';

/** What a row spreads on the `Pressable` that picks it up. Empty while the list is disabled. */
export interface DragHandlers {
  onLongPress?: (event: GestureResponderEvent) => void;
  onPressOut?: () => void;
}

interface Props<T> {
  items: readonly T[];
  keyOf: (item: T) => number;
  renderRow: (item: T, index: number, drag: DragHandlers) => ReactNode;
  /** Called on a drop that moved the row (`from !== to`). */
  onMove: (from: number, to: number) => void;
  disabled: boolean;
  /** The screen turns its scrolling off while a row is held. */
  onDragChange: (dragging: boolean) => void;
  style?: StyleProp<ViewStyle>;
}

interface Held {
  key: number;
  from: number;
  to: number;
  height: number;
}

interface Latest {
  /** Row heights, top first. */
  heights: () => number[];
  onMove: (from: number, to: number) => void;
  onDragChange: (dragging: boolean) => void;
}

/**
 * The drag's state between renders. The pan handlers are made once, so they read what changes from here, never from
 * a render.
 */
class Drag {
  readonly dragY = new Animated.Value(0);
  readonly heights = new Map<number, number>();
  readonly responder: PanResponderInstance;
  private latest: Latest | null = null;
  private held: Held | null = null;
  private granted = false;
  /** Where the long-press happened (page y): travel counts from here, not from where the list took the touch. */
  private startY = 0;

  constructor(private readonly show: (held: Held | null) => void) {
    this.responder = PanResponder.create({
      // Only while a row is held: otherwise touches go to the rows and the scroll view as before.
      onMoveShouldSetPanResponderCapture: () => this.held !== null,
      onPanResponderGrant: () => {
        this.granted = true;
      },
      onPanResponderMove: (_event, gesture) => {
        if (!this.held || !this.latest) return;
        const travel = gesture.moveY - this.startY;
        this.dragY.setValue(travel);
        const to = dropIndex(this.latest.heights(), this.held.from, travel);
        if (to !== this.held.to) this.set({ ...this.held, to });
      },
      // Refused, so the scroll view, or the browser's selection and context menu, can't take the row away mid-drag.
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => this.finish(),
      onPanResponderTerminate: () => this.finish(),
    });
  }

  /** What the handlers read from the latest render. */
  update(latest: Latest) {
    this.latest = latest;
  }

  pickUp(key: number, from: number, pageY: number) {
    this.granted = false;
    this.startY = pageY;
    this.dragY.setValue(0);
    this.set({ key, from, to: from, height: this.heights.get(key) ?? 0 });
    this.latest?.onDragChange(true);
  }

  /**
   * A long-press let go without a move ends here. Handing the touch to the list also fires onPressOut, just before
   * the grant, so the check waits a frame.
   */
  pressOut() {
    requestAnimationFrame(() => {
      if (!this.granted) this.finish();
    });
  }

  private finish() {
    const done = this.held;
    if (!done) return;
    this.set(null);
    this.granted = false;
    this.dragY.setValue(0);
    this.latest?.onDragChange(false);
    if (done.from !== done.to) this.latest?.onMove(done.from, done.to);
  }

  private set(held: Held | null) {
    this.held = held;
    this.show(held);
  }
}

/**
 * A list whose rows move by long-press and drag (brief 092), on web and native, with React Native's own
 * `PanResponder` and `Animated`. A long-press picks a row up; the list takes the touch on the first move after it, so
 * a tap still opens the row and a scroll that starts before the long-press still scrolls.
 */
export function ReorderList<T>({ items, keyOf, renderRow, onMove, disabled, onDragChange, style }: Props<T>) {
  const colors = useColors();
  const [held, setHeld] = useState<Held | null>(null);
  const [drag] = useState(() => new Drag(setHeld));
  useEffect(() => {
    drag.update({
      heights: () => items.map((item) => drag.heights.get(keyOf(item)) ?? 0),
      onMove,
      onDragChange,
    });
  });

  return (
    <View {...drag.responder.panHandlers} style={style}>
      {items.map((item, index) => {
        const key = keyOf(item);
        const isHeld = held?.key === key;
        const handlers: DragHandlers = disabled
          ? {}
          : {
              onLongPress: (event) => drag.pickUp(key, index, event.nativeEvent.pageY),
              onPressOut: () => drag.pressOut(),
            };
        return (
          <Row
            key={key}
            index={index}
            offset={held && !isHeld ? rowOffset(index, held.from, held.to, held.height) : 0}
            dragY={isHeld ? drag.dragY : null}
            heldStyle={isHeld ? { backgroundColor: colors.surface } : null}
            onHeight={(height) => drag.heights.set(key, height)}
          >
            {renderRow(item, index, handlers)}
          </Row>
        );
      })}
    </View>
  );
}

interface RowProps {
  index: number;
  /** How far it moves aside for the held row. */
  offset: number;
  /** The finger's travel, for the held row only. */
  dragY: Animated.Value | null;
  heldStyle: ViewStyle | null;
  onHeight: (height: number) => void;
  children: ReactNode;
}

function Row({ index, offset, dragY, heldStyle, onHeight, children }: RowProps) {
  const [shift] = useState(() => new Animated.Value(0));
  const shownAt = useRef(index);
  useEffect(() => {
    // After a drop the row is already laid out at its new place, so it snaps there instead of sliding back.
    if (shownAt.current !== index) {
      shownAt.current = index;
      shift.stopAnimation();
      shift.setValue(offset);
      return;
    }
    // The held row follows the finger from JS anyway, so the native driver gains nothing here.
    Animated.timing(shift, { toValue: offset, duration: 150, useNativeDriver: false }).start();
  }, [index, offset, shift]);

  return (
    <Animated.View
      onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
      style={
        dragY
          ? [styles.held, heldStyle, { transform: [{ translateY: dragY }, { scale: 1.03 }] }]
          : { transform: [{ translateY: shift }] }
      }
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  held: { zIndex: 1, borderRadius: 14 },
});
