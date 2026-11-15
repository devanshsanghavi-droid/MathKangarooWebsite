import { FigureSvg, Cell, Label } from './primitives.tsx';

/**
 * KA-0499 - three plus-shaped stages of a growing pattern, labelled 1, 2 and 3. Each is a
 * centre square with four equal arms: arms of 1, 2 and 3 squares, so 5, 9 and 13 squares.
 */
export function PlusStages() {
  const s = 13;
  const pad = 8;
  const gap = 20;
  const labelSpace = 18;
  const stages = [1, 2, 3];
  const maxSpan = (2 * 3 + 1) * s;

  let left = pad;
  const drawn = stages.map((arm) => {
    const span = (2 * arm + 1) * s;
    const x0 = left;
    const y0 = pad + (maxSpan - span) / 2;
    left += span + gap;
    const cells: Array<[number, number]> = [[arm, arm]];
    for (let k = 1; k <= arm; k += 1) {
      cells.push([arm - k, arm], [arm + k, arm], [arm, arm - k], [arm, arm + k]);
    }
    return { arm, x0, y0, span, cells };
  });

  const width = left - gap + pad;
  return (
    <FigureSvg width={width} height={pad + maxSpan + labelSpace}>
      {drawn.map(({ arm, x0, y0, span, cells }) => (
        <g key={arm}>
          {cells.map(([c, r]) => (
            <Cell key={`${c}-${r}`} x={x0 + c * s} y={y0 + r * s} size={s} />
          ))}
          <Label x={x0 + span / 2} y={pad + maxSpan + labelSpace / 2 + 2}>
            {arm}
          </Label>
        </g>
      ))}
    </FigureSvg>
  );
}
