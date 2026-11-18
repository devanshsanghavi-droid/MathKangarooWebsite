import { FigureSvg, Cell, Label, FILL_ACCENT } from './primitives.tsx';

/**
 * KA-1085 - shapes 1, 2 and 3 of a growing T pattern of square tiles. Shape n has a top row
 * of 2n + 1 tiles and a column of n tiles below the middle tile, so 4, 7 and 10 tiles.
 */
export function TeeTileStages() {
  const s = 12;
  const pad = 8;
  const gap = 20;
  const labelSpace = 18;
  const stages = [1, 2, 3];
  const maxRows = 3 + 1;

  let left = pad;
  const drawn = stages.map((n) => {
    const across = 2 * n + 1;
    const x0 = left;
    left += across * s + gap;
    const cells: Array<{ x: number; y: number }> = [];
    for (let col = 0; col < across; col += 1) {
      cells.push({ x: x0 + col * s, y: pad });
    }
    for (let row = 1; row <= n; row += 1) {
      cells.push({ x: x0 + n * s, y: pad + row * s });
    }
    return { n, x0, across, cells };
  });

  const baseline = pad + maxRows * s;
  return (
    <FigureSvg width={left - gap + pad} height={baseline + labelSpace}>
      {drawn.map(({ n, x0, across, cells }) => (
        <g key={n}>
          {cells.map((c) => (
            <Cell key={`${c.x}-${c.y}`} x={c.x} y={c.y} size={s} fill={FILL_ACCENT} />
          ))}
          <Label x={x0 + (across * s) / 2} y={baseline + labelSpace / 2 + 2}>
            {n}
          </Label>
        </g>
      ))}
    </FigureSvg>
  );
}
