import { FigureSvg, Cell, Label, FILL_ACCENT } from './primitives.tsx';

/**
 * KA-1139 - a staircase cube net of six squares stepping down to the right. The top-left
 * square is shaded; then M to its right, K below M, F to the right of K, W below F and H to
 * the right of W.
 */
export function CubeNetStaircase() {
  const s = 36;
  const pad = 6;
  const squares: Array<{ label: string; col: number; row: number; shaded?: boolean }> = [
    { label: '', col: 0, row: 0, shaded: true },
    { label: 'M', col: 1, row: 0 },
    { label: 'K', col: 1, row: 1 },
    { label: 'F', col: 2, row: 1 },
    { label: 'W', col: 2, row: 2 },
    { label: 'H', col: 3, row: 2 },
  ];
  return (
    <FigureSvg width={4 * s + 2 * pad} height={3 * s + 2 * pad}>
      {squares.map((sq) => {
        const x = pad + sq.col * s;
        const y = pad + sq.row * s;
        return (
          <g key={`${sq.col}-${sq.row}`}>
            <Cell x={x} y={y} size={s} fill={sq.shaded ? FILL_ACCENT : undefined} />
            {sq.label ? (
              <Label x={x + s / 2} y={y + s / 2}>
                {sq.label}
              </Label>
            ) : null}
          </g>
        );
      })}
    </FigureSvg>
  );
}
