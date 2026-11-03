import { FigureSvg, Label, STROKE, GRID, W_THIN, W_THICK } from './primitives.tsx';

/**
 * KA-0031 - a street grid with junctions 4 across and 4 down. The junction one step right and
 * one step down from the top-left is closed, marked with a cross.
 */
export function BlockedGridPaths() {
  const n = 4;
  const step = 40;
  const pad = 20;
  const size = (n - 1) * step;
  const px = (i: number) => pad + i * step;
  const closed = { col: 1, row: 1 };

  return (
    <FigureSvg width={size + 2 * pad} height={size + 2 * pad + 12}>
      {Array.from({ length: n }, (_, i) => (
        <g key={`line-${i}`}>
          <line
            x1={px(0)}
            y1={px(i)}
            x2={px(n - 1)}
            y2={px(i)}
            stroke={GRID}
            strokeWidth={W_THIN}
          />
          <line
            x1={px(i)}
            y1={px(0)}
            x2={px(i)}
            y2={px(n - 1)}
            stroke={GRID}
            strokeWidth={W_THIN}
          />
        </g>
      ))}
      {Array.from({ length: n }, (_, r) =>
        Array.from({ length: n }, (_, c) => (
          <circle key={`j-${r}-${c}`} cx={px(c)} cy={px(r)} r={3} fill={STROKE} />
        )),
      )}
      <g>
        <line
          x1={px(closed.col) - 7}
          y1={px(closed.row) - 7}
          x2={px(closed.col) + 7}
          y2={px(closed.row) + 7}
          stroke={STROKE}
          strokeWidth={W_THICK}
        />
        <line
          x1={px(closed.col) + 7}
          y1={px(closed.row) - 7}
          x2={px(closed.col) - 7}
          y2={px(closed.row) + 7}
          stroke={STROKE}
          strokeWidth={W_THICK}
        />
      </g>
      <Label x={px(0)} y={px(0) - 12}>
        start
      </Label>
      <Label x={px(n - 1)} y={px(n - 1) + 14}>
        end
      </Label>
    </FigureSvg>
  );
}
