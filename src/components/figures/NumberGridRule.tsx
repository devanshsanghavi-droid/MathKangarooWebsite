import { FigureSvg, Cell, Label, FILL_ACCENT } from './primitives.tsx';

/**
 * KA-0105 — the first two rows of the grid filled in, the rest blank, and the target cell
 * shaded. Showing two rows is deliberate: it gives the reader a cell to check their rule
 * against before they use it on the one they cannot see.
 */
export function NumberGridRule() {
  const s = 34;
  const pad = 8;
  const known: Array<number[]> = [
    [1, 2, 3, 4],
    [4, 5, 6, 7],
  ];
  const targetRow = 3;
  const targetCol = 2;

  return (
    <FigureSvg width={4 * s + 2 * pad} height={4 * s + 2 * pad}>
      {[0, 1, 2, 3].flatMap((r) =>
        [0, 1, 2, 3].map((c) => {
          const value = known[r]?.[c];
          const target = r === targetRow && c === targetCol;
          return (
            <g key={`${r}-${c}`}>
              <Cell
                x={pad + c * s}
                y={pad + r * s}
                size={s}
                fill={target ? FILL_ACCENT : undefined}
              />
              {value === undefined ? null : (
                <Label x={pad + c * s + s / 2} y={pad + r * s + s / 2}>
                  {value}
                </Label>
              )}
              {target ? (
                <Label x={pad + c * s + s / 2} y={pad + r * s + s / 2}>
                  ?
                </Label>
              ) : null}
            </g>
          );
        }),
      )}
    </FigureSvg>
  );
}
