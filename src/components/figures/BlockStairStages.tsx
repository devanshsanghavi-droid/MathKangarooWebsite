import { FigureSvg, Cell, Label, FILL_ACCENT } from './primitives.tsx';

/**
 * KA-0385 - steps 1, 2 and 3 of a growing pattern of block staircases. Step n has columns
 * of 1, 2, ..., n blocks standing on a common base line, so 1, 3 and 6 blocks.
 */
export function BlockStairStages() {
  const s = 18;
  const pad = 8;
  const gap = 24;
  const labelSpace = 20;
  const stages = [1, 2, 3];
  const maxHeight = 3 * s;
  const base = pad + maxHeight;

  let left = pad;
  const drawn = stages.map((n) => {
    const x0 = left;
    left += n * s + gap;
    const cells: Array<{ x: number; y: number }> = [];
    for (let col = 0; col < n; col += 1) {
      for (let h = 0; h <= col; h += 1) {
        cells.push({ x: x0 + col * s, y: base - (h + 1) * s });
      }
    }
    return { n, x0, cells };
  });

  return (
    <FigureSvg width={left - gap + pad} height={base + labelSpace}>
      {drawn.map(({ n, x0, cells }) => (
        <g key={n}>
          {cells.map((c) => (
            <Cell key={`${c.x}-${c.y}`} x={c.x} y={c.y} size={s} fill={FILL_ACCENT} />
          ))}
          <Label x={x0 + (n * s) / 2} y={base + 13}>
            {`step ${n}`}
          </Label>
        </g>
      ))}
    </FigureSvg>
  );
}
