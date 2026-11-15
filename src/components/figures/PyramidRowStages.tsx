import { FigureSvg, Cell, Label } from './primitives.tsx';

/**
 * KA-0789 - figures 1, 2 and 3 of a growing pattern of centred square pyramids. Figure n has
 * n rows: 1 square on top, and each row below has two more squares, sticking out by one
 * square at each end. So 1, 4 and 9 squares.
 */
export function PyramidRowStages() {
  const s = 14;
  const pad = 8;
  const gap = 22;
  const labelSpace = 18;
  const stages = [1, 2, 3];
  const maxRows = 3;
  const maxHeight = maxRows * s;

  let left = pad;
  const drawn = stages.map((n) => {
    const width = (2 * n - 1) * s;
    const x0 = left;
    const y0 = pad + maxHeight - n * s;
    left += width + gap;
    const cells: Array<[number, number]> = [];
    for (let row = 0; row < n; row += 1) {
      // Row `row` (0 at the top) has 2 * row + 1 squares, centred on the figure.
      const first = n - 1 - row;
      for (let c = 0; c < 2 * row + 1; c += 1) {
        cells.push([first + c, row]);
      }
    }
    return { n, x0, y0, width, cells };
  });

  const totalWidth = left - gap + pad;
  return (
    <FigureSvg width={totalWidth} height={pad + maxHeight + labelSpace}>
      {drawn.map(({ n, x0, y0, width, cells }) => (
        <g key={n}>
          {cells.map(([c, r]) => (
            <Cell key={`${c}-${r}`} x={x0 + c * s} y={y0 + r * s} size={s} />
          ))}
          <Label x={x0 + width / 2} y={pad + maxHeight + labelSpace / 2 + 2}>
            {n}
          </Label>
        </g>
      ))}
    </FigureSvg>
  );
}
