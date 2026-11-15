import { FigureSvg, Cell, Label, STROKE, W_THIN } from './primitives.tsx';

/**
 * KA-0434 - a plan of a cube building seen from above. Each cell holds the number of cubes
 * stacked on it, and the front edge is marked so the solver knows which direction the front
 * view looks along. The arrow points the way the viewer looks, from the front towards the back.
 */
export function CubePlanFront() {
  const s = 34;
  const padX = 40;
  const top = 22;
  const heights: number[][] = [
    [1, 4, 1],
    [1, 1, 1],
    [2, 1, 3],
  ];
  const gridBottom = top + 3 * s;
  const arrowX = padX + 1.5 * s;

  return (
    <FigureSvg width={3 * s + 2 * padX} height={gridBottom + 52}>
      <Label x={arrowX} y={10}>
        back
      </Label>
      {heights.flatMap((row, r) =>
        row.map((h, c) => (
          <g key={`${r}-${c}`}>
            <Cell x={padX + c * s} y={top + r * s} size={s} />
            <Label x={padX + c * s + s / 2} y={top + r * s + s / 2}>
              {h}
            </Label>
          </g>
        )),
      )}
      <line
        x1={arrowX}
        y1={gridBottom + 30}
        x2={arrowX}
        y2={gridBottom + 8}
        stroke={STROKE}
        strokeWidth={W_THIN}
      />
      <polygon
        points={`${arrowX},${gridBottom + 5} ${arrowX - 4},${gridBottom + 12} ${arrowX + 4},${gridBottom + 12}`}
        fill={STROKE}
      />
      <Label x={arrowX} y={gridBottom + 42}>
        front
      </Label>
    </FigureSvg>
  );
}
