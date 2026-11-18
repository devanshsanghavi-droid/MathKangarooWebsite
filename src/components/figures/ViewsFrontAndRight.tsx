import { FigureSvg, Cell, Label, FILL_ACCENT, STROKE, W_THICK } from './primitives.tsx';

/**
 * KA-1157 - a solid of stacked cubes seen from the front (columns 2, 3, 1 tall) and from the
 * right (columns 1, 3 tall). With every square holding at least one cube, the two silhouettes
 * pin down every stack.
 */
export function ViewsFrontAndRight() {
  const s = 24;
  const pad = 12;
  const top = 8;
  const floor = top + 3 * s;
  const gap = 56;
  const front = [2, 3, 1];
  const right = [1, 3];
  const rightX = pad + front.length * s + gap;
  const width = rightX + right.length * s + pad;

  return (
    <FigureSvg width={width} height={floor + 30}>
      {front.flatMap((h, c) =>
        Array.from({ length: h }, (_, k) => (
          <Cell
            key={`front-${c}-${k}`}
            x={pad + c * s}
            y={floor - (k + 1) * s}
            size={s}
            fill={FILL_ACCENT}
          />
        )),
      )}
      <line
        x1={pad - 6}
        y1={floor}
        x2={pad + front.length * s + 6}
        y2={floor}
        stroke={STROKE}
        strokeWidth={W_THICK}
      />
      <Label x={pad + (front.length * s) / 2} y={floor + 18}>
        from the front
      </Label>

      {right.flatMap((h, c) =>
        Array.from({ length: h }, (_, k) => (
          <Cell
            key={`right-${c}-${k}`}
            x={rightX + c * s}
            y={floor - (k + 1) * s}
            size={s}
            fill={FILL_ACCENT}
          />
        )),
      )}
      <line
        x1={rightX - 6}
        y1={floor}
        x2={rightX + right.length * s + 6}
        y2={floor}
        stroke={STROKE}
        strokeWidth={W_THICK}
      />
      <Label x={rightX + (right.length * s) / 2} y={floor + 18}>
        from the right
      </Label>
    </FigureSvg>
  );
}
