import { FigureSvg, Label, STROKE, W_THIN, FILL_ACCENT, FILL_SURFACE } from './primitives.tsx';

/** KA-0067 — a tree: one start, three main courses, two puddings on each, six endings. */
export function MenuTree() {
  const startX = 22;
  const midX = 100;
  const endX = 190;
  const mains = [26, 70, 114];
  const puddingOffset = 16;

  return (
    <FigureSvg width={230} height={140}>
      {mains.map((y, index) => (
        <g key={y}>
          <line x1={startX + 8} y1={70} x2={midX - 8} y2={y} stroke={STROKE} strokeWidth={W_THIN} />
          <circle cx={midX} cy={y} r={7} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={W_THIN} />
          <Label x={midX} y={y}>
            {`M${index + 1}`}
          </Label>
          {[-puddingOffset, puddingOffset].map((offset, pudding) => (
            <g key={offset}>
              <line
                x1={midX + 8}
                y1={y}
                x2={endX - 8}
                y2={y + offset}
                stroke={STROKE}
                strokeWidth={W_THIN}
              />
              <circle
                cx={endX}
                cy={y + offset}
                r={7}
                fill={FILL_SURFACE}
                stroke={STROKE}
                strokeWidth={W_THIN}
              />
              <Label x={endX} y={y + offset}>
                {`P${pudding + 1}`}
              </Label>
            </g>
          ))}
        </g>
      ))}
      <circle cx={startX} cy={70} r={7} fill={FILL_SURFACE} stroke={STROKE} strokeWidth={W_THIN} />
    </FigureSvg>
  );
}
