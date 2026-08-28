import { FigureSvg, Label, STROKE } from './primitives.tsx';

/** KA-0008 — three pattern stages of 3, 5 and 7 dots: n columns of two, plus one on top. */
export function DotStages() {
  const gap = 16;
  const stageWidth = 74;
  const r = 5;
  const stages = [1, 2, 3];
  return (
    <FigureSvg width={3 * stageWidth} height={82}>
      {stages.map((columns, index) => {
        const left = index * stageWidth + 14;
        const dots: Array<{ cx: number; cy: number }> = [];
        for (let c = 0; c < columns; c += 1) {
          dots.push({ cx: left + c * gap, cy: 44 });
          dots.push({ cx: left + c * gap, cy: 44 + gap });
        }
        dots.push({ cx: left + ((columns - 1) * gap) / 2, cy: 24 });
        return (
          <g key={columns}>
            {dots.map((d) => (
              <circle key={`${d.cx}-${d.cy}`} cx={d.cx} cy={d.cy} r={r} fill={STROKE} />
            ))}
            <Label x={left + ((columns - 1) * gap) / 2} y={76}>
              {columns}
            </Label>
          </g>
        );
      })}
    </FigureSvg>
  );
}
