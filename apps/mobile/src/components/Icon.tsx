import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Stroke icons drawn exactly as on the design canvas (24×24, round caps).
const PATHS = {
  back: ['M15 18l-6-6 6-6'],
  forward: ['M9 18l6-6-6-6'],
  plus: ['M12 5v14', 'M5 12h14'],
  swap: ['M7 7h13l-3-3', 'M17 17H4l3 3'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  check: ['M20 6L9 17l-5-5'],
  // A pencil.
  edit: ['M4 20h4L19 9l-4-4L4 16v4z', 'M13.5 6.5l4 4'],
  calendar: [
    'M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    'M4 10h16',
    'M8 3v4',
    'M16 3v4',
  ],
  // Three dots: zero-length strokes drawn round with a thick pen.
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  // Tab bar. Circles are two arcs, since only <Path> is drawn.
  home: ['M3 10.5L12 3l9 7.5', 'M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9'],
  budget: [
    'M3 7a2 2 0 0 1 2-2h12v4',
    'M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2',
    'M16 14h.01',
  ],
  expenses: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M9 8h6', 'M9 12h6', 'M9 16h3'],
  stats: ['M4 20h16', 'M7 16v-5', 'M12 16V6', 'M17 16V9'],
  settings: [
    'M4 6h9',
    'M17 6h3',
    'M4 12h3',
    'M11 12h9',
    'M4 18h11',
    'M19 18h1',
    'M13 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
    'M7 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
    'M15 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  ],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = name === 'more' ? 3.6 : 2,
}: {
  name: IconName;
  size?: number;
  color: ColorValue;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
