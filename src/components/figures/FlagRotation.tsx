import { FigureSvg, Label, STROKE, FILL_ACCENT, W_THICK, W_THIN } from './primitives.tsx';

/**
 * KA-0039 — a flag: an upright pole with a triangle on its upper right, standing on a marked
 * corner point. The marked point is the centre of the rotation.
 */
export function FlagRotation() {
  const baseX = 48;
  const baseY = 104;
  const poleTop = 18;

  return (
    <FigureSvg width={120} height={124}>
      <line
        x1={baseX}
        y1={baseY}
        x2={baseX}
        y2={poleTop}
        stroke={STROKE}
        strokeWidth={W_THICK}
        strokeLinecap="round"
      />
      <polygon
        points={`${baseX},${poleTop} ${baseX + 40},${poleTop + 12} ${baseX},${poleTop + 24}`}
        fill={FILL_ACCENT}
        stroke={STROKE}
        strokeWidth={W_THIN}
      />
      <circle cx={baseX} cy={baseY} r={4} fill={STROKE} />
      <Label x={baseX + 26} y={baseY - 2}>
        turn here
      </Label>
    </FigureSvg>
  );
}
