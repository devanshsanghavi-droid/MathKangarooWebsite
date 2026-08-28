import { FigureSvg, Label, STROKE, W_THICK, W_THIN } from './primitives.tsx';

/** KA-0006 — a number line from 0 to 60 with seven equally spaced ticks; arrow on the fourth. */
export function NumberLineArrow() {
  const pad = 16;
  const width = 240;
  const y = 54;
  const ticks = 7; // 0, five unlabelled, 60
  const step = (width - 2 * pad) / (ticks - 1);
  const arrowTick = 3; // zero-based: the fourth tick from the left
  const ax = pad + arrowTick * step;
  return (
    <FigureSvg width={width} height={78}>
      <line x1={pad} y1={y} x2={width - pad} y2={y} stroke={STROKE} strokeWidth={W_THICK} />
      {Array.from({ length: ticks }, (_, i) => (
        <line
          key={i}
          x1={pad + i * step}
          y1={y - 7}
          x2={pad + i * step}
          y2={y + 7}
          stroke={STROKE}
          strokeWidth={W_THIN}
        />
      ))}
      <Label x={pad} y={y + 20}>
        0
      </Label>
      <Label x={width - pad} y={y + 20}>
        60
      </Label>
      <line x1={ax} y1={12} x2={ax} y2={y - 9} stroke={STROKE} strokeWidth={W_THICK} />
      <polygon points={`${ax},${y - 4} ${ax - 5},${y - 14} ${ax + 5},${y - 14}`} fill={STROKE} />
    </FigureSvg>
  );
}
