import Svg, { Path } from 'react-native-svg';

// Stroke icons drawn exactly as on the design canvas (24×24, round caps).
const PATHS = {
  back: ['M15 18l-6-6 6-6'],
  forward: ['M9 18l6-6-6-6'],
  plus: ['M12 5v14', 'M5 12h14'],
  swap: ['M7 7h13l-3-3', 'M17 17H4l3 3'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  check: ['M20 6L9 17l-5-5'],
  // Three dots: zero-length strokes drawn round with a thick pen.
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
} as const;

type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = name === 'more' ? 3.6 : 2,
}: {
  name: IconName;
  size?: number;
  color: string;
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
