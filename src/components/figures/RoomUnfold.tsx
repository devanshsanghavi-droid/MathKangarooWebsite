import { FigureSvg, Label, STROKE, GRID, FILL_NONE, W_THICK, W_THIN, W_HAIR } from './primitives.tsx';

/**
 * KA-0082 — the floor and one wall of a room, unfolded flat, with the straight line an ant
 * would take across them. Unfolding is the whole method: a path that curves round a corner in
 * three dimensions is a straight line once the surfaces are laid out.
 */
export function RoomUnfold() {
  const u = 20; // pixels per metre
  const pad = 20;
  const floorW = 8 * u;
  const floorD = 4 * u;
  const wallH = 2 * u;

  const top = pad;
  const floorTop = top + wallH;

  return (
    <FigureSvg width={floorW + 2 * pad} height={wallH + floorD + 2 * pad + 14}>
      {/* the wall, folded up above the floor */}
      <rect
        x={pad}
        y={top}
        width={floorW}
        height={wallH}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={W_THIN}
      />
      {/* the floor */}
      <rect
        x={pad}
        y={floorTop}
        width={floorW}
        height={floorD}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={W_THICK}
      />
      {/* the fold line between them */}
      <line
        x1={pad}
        y1={floorTop}
        x2={pad + floorW}
        y2={floorTop}
        stroke={GRID}
        strokeWidth={W_HAIR}
        strokeDasharray="4 3"
      />
      {/* the shortest path: a straight line once the surfaces are flat */}
      <line
        x1={pad}
        y1={floorTop + floorD}
        x2={pad + floorW}
        y2={top}
        stroke={STROKE}
        strokeWidth={W_THICK}
      />
      <circle cx={pad} cy={floorTop + floorD} r={3.5} fill={STROKE} />
      <circle cx={pad + floorW} cy={top} r={3.5} fill={STROKE} />

      <Label x={pad + floorW / 2} y={floorTop + floorD + 16}>
        8 m
      </Label>
      <Label x={pad - 10} y={floorTop + floorD / 2}>
        4
      </Label>
      <Label x={pad - 10} y={top + wallH / 2}>
        2
      </Label>
    </FigureSvg>
  );
}
