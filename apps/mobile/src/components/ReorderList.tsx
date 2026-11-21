import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import {
  Animated,
  type GestureResponderEvent,
  type HostInstance,
  PanResponder,
  type PanResponderInstance,
  type ScrollViewInstance,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useColors } from '@/appearance/AppearanceContext';
import { dropIndex, edgeStep, rowOffset } from '@/data/reorder';

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
  /**
   * The scroll view the list sits in, scrolled while a held row is near its top or bottom. The list must be a direct
   * child of its content.
   */
  scrollRef?: RefObject<ScrollViewInstance | null>;
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
  scrollRef: RefObject<ScrollViewInstance | null> | undefined;
  listRef: RefObject<HostInstance | null>;
}

/** The scroll view's edges in the window and how far it's scrolled, measured at pick-up. */
interface Edges {
  top: number;
  bottom: number;
  offset: number;
  maxOffset: number;
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
  /** The finger's latest page y. */
  private moveY = 0;
  /** How far the list scrolled under the held row since the pick-up. */
  private scrolled = 0;
  /** The list's y in the scroll view's content, from its layout. */
  private listTop = 0;
  private edges: Edges | null = null;
  private frame = 0;

  constructor(private readonly show: (held: Held | null) => void) {
    this.responder = PanResponder.create({
      // Only while a row is held: otherwise touches go to the rows and the scroll view as before.
      onMoveShouldSetPanResponderCapture: () => this.held !== null,
      onPanResponderGrant: () => {
        this.granted = true;
      },
      onPanResponderMove: (_event, gesture) => {
        this.moveY = gesture.moveY;
        this.follow();
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

  setListTop(contentY: number) {
    this.listTop = contentY;
  }

  pickUp(key: number, from: number, pageY: number) {
    this.granted = false;
    this.startY = pageY;
    this.moveY = pageY;
    this.scrolled = 0;
    this.dragY.setValue(0);
    this.set({ key, from, to: from, height: this.heights.get(key) ?? 0 });
    this.latest?.onDragChange(true);
    this.measure();
  }

  /** Stops the edge scrolling; for unmount. */
  stop() {
    cancelAnimationFrame(this.frame);
    this.edges = null;
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

  /** The held row follows the finger, plus whatever the list scrolled under it. */
  private follow() {
    if (!this.held || !this.latest) return;
    const travel = this.moveY - this.startY + this.scrolled;
    this.dragY.setValue(travel);
    const to = dropIndex(this.latest.heights(), this.held.from, travel);
    if (to !== this.held.to) this.set({ ...this.held, to });
  }

  /** Measures the scroll view and the list, then starts the edge scrolling. */
  private measure() {
    const scrollView = this.latest?.scrollRef?.current;
    const list = this.latest?.listRef.current;
    if (!scrollView || !list) return;
    scrollView.measureInWindow((_x, scrollY, _width, viewportHeight) => {
      list.measureInWindow((_listX, listY, _listWidth, listHeight) => {
        if (!this.held) return;
        const offset = this.listTop - (listY - scrollY);
        this.edges = {
          top: scrollY,
          bottom: scrollY + viewportHeight,
          offset,
          maxOffset: Math.max(0, this.listTop + listHeight - viewportHeight),
        };
        this.scrollAtEdges();
      });
    });
  }

  /** Each frame while a row is held: scroll a step if the finger is near an edge. */
  private scrollAtEdges() {
    this.frame = requestAnimationFrame(() => {
      const edges = this.edges;
      const scrollView = this.latest?.scrollRef?.current;
      if (!this.held || !edges || !scrollView) return;
      const step = edgeStep(this.moveY, edges.top, edges.bottom);
      const next = Math.min(Math.max(edges.offset + step, 0), edges.maxOffset);
      if (next !== edges.offset) {
        scrollView.scrollTo({ y: next, animated: false });
        this.scrolled += next - edges.offset;
        edges.offset = next;
        this.follow();
      }
      this.scrollAtEdges();
    });
  }

  private finish() {
    const done = this.held;
    if (!done) return;
    this.stop();
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
export function ReorderList<T>(props: Props<T>) {
  const { items, keyOf, renderRow, onMove, disabled, onDragChange, scrollRef, style } = props;
  const colors = useColors();
  const [held, setHeld] = useState<Held | null>(null);
  const [drag] = useState(() => new Drag(setHeld));
  const listRef = useRef<HostInstance>(null);
  useEffect(() => {
    drag.update({
      heights: () => items.map((item) => drag.heights.get(keyOf(item)) ?? 0),
      onMove,
      onDragChange,
      scrollRef,
      listRef,
    });
  });
  useEffect(() => () => drag.stop(), [drag]);

  return (
    <View
      ref={listRef}
      {...drag.responder.panHandlers}
      onLayout={(event) => drag.setListTop(event.nativeEvent.layout.y)}
      style={style}
    >
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
