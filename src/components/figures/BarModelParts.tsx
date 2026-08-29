import {
  FigureSvg,
  Label,
  STROKE,
  FILL_ACCENT,
  FILL_SURFACE,
  W_THIN,
  W_THICK,
} from './primitives.tsx';

/** KA-0110 — Bo as one box, Ana as three of the same size, with the total bracketed across all four. */
export function BarModelParts() {
  const box = 44;
  const height = 26;
  const pad = 34;
  const rowGap = 14;

  return (
    <FigureSvg width={4 * box + 2 * pad} height={2 * height + rowGap + 54}>
      <Label x={pad - 16} y={10 + height / 2}>
        Bo
      </Label>
      <rect
        x={pad}
        y={10}
        width={box}
        height={height}
        fill={FILL_SURFACE}
        stroke={STROKE}
        strokeWidth={W_THIN}
      />

      <Label x={pad - 16} y={10 + height + rowGap + height / 2}>
        Ana
      </Label>
      {[0, 1, 2].map((index) => (
        <rect
          key={index}
          x={pad + index * box}
          y={10 + height + rowGap}
          width={box}
          height={height}
          fill={FILL_ACCENT}
          stroke={STROKE}
          strokeWidth={W_THIN}
        />
      ))}

      {/* the bracket spanning all four equal boxes */}
      <path
        d={`M ${pad} ${2 * height + rowGap + 22} v 8 h ${4 * box} v -8`}
        fill="none"
        stroke={STROKE}
        strokeWidth={W_THICK}
      />
      <Label x={pad + 2 * box} y={2 * height + rowGap + 44}>
        48
      </Label>
    </FigureSvg>
  );
}
