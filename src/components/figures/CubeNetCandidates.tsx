import { FigureSvg, Cell, Label } from './primitives.tsx';

/**
 * KA-0048 — four arrangements of six squares. Only one of them (the straight line) cannot fold
 * into a closed cube, because a strip wrapped round a cube meets itself after four squares.
 */
const LAYOUTS: Array<{ label: string; cells: Array<[number, number]> }> = [
  // T shape: a row of three with a column of three hanging from the middle.
  {
    label: 'A',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
  },
  // A straight line of six.
  {
    label: 'B',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
    ],
  },
  // A staircase of three pairs.
  {
    label: 'C',
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
      [3, 2],
    ],
  },
  // The familiar cross.
  {
    label: 'D',
    cells: [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
      [1, 3],
    ],
  },
];

export function CubeNetCandidates() {
  const s = 16;
  const gap = 22;
  const blockWidth = 6 * s + gap;

  return (
    <FigureSvg width={LAYOUTS.length * blockWidth} height={4 * s + 26}>
      {LAYOUTS.map((layout, index) => {
        const originX = index * blockWidth + 8;
        return (
          <g key={layout.label}>
            {layout.cells.map(([col, row]) => (
              <Cell
                key={`${col}-${row}`}
                x={originX + col * s}
                y={6 + row * s}
                size={s}
                width={1}
              />
            ))}
            <Label x={originX + 2 * s} y={4 * s + 18}>
              {layout.label}
            </Label>
          </g>
        );
      })}
    </FigureSvg>
  );
}
