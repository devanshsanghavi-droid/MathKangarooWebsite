import { FigureSvg, Cell, Label, FILL_ACCENT } from './primitives.tsx';

/** KA-1193 - three square frames of tiles, 3 by 3, 4 by 4 and 5 by 5, each with the middle empty. */
export function TileFrameStages() {
  const size = 10;
  const sides = [3, 4, 5];
  const gap = 22;
  const top = 8;
  // Each frame starts one gap to the right of the previous one: 8, 60 and 122.
  const lefts = [8, 8 + 3 * size + gap, 8 + 3 * size + gap + 4 * size + gap];
  const width = 8 + 3 * size + gap + 4 * size + gap + 5 * size + 8;
  const height = top + 5 * size + 24;

  return (
    <FigureSvg width={width} height={height}>
      {sides.map((side, i) => {
        const left = lefts[i] ?? 0;
        const offsetY = top + (5 - side) * size;
        const cells: Array<{ x: number; y: number }> = [];
        for (let row = 0; row < side; row += 1) {
          for (let col = 0; col < side; col += 1) {
            const onEdge = row === 0 || col === 0 || row === side - 1 || col === side - 1;
            if (onEdge) cells.push({ x: left + col * size, y: offsetY + row * size });
          }
        }
        return (
          <g key={side}>
            {cells.map((c) => (
              <Cell key={`${c.x}-${c.y}`} x={c.x} y={c.y} size={size} fill={FILL_ACCENT} />
            ))}
            <Label x={left + (side * size) / 2} y={top + 5 * size + 14}>
              {i + 1}
            </Label>
          </g>
        );
      })}
    </FigureSvg>
  );
}
