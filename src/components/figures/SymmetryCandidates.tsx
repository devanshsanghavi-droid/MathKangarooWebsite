import { FigureSvg, Label, STROKE, FILL_NONE, W_THIN } from './primitives.tsx';

/** KA-0004 — four candidate shapes: rectangle, isosceles triangle, five-pointed star, arrow. */
function starPoints(cx: number, cy: number, outer: number, inner: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

export function SymmetryCandidates() {
  const box = 74;
  const shape = { fill: FILL_NONE, stroke: STROKE, strokeWidth: W_THIN };
  return (
    <FigureSvg width={4 * box} height={box + 22}>
      <rect x={12} y={22} width={50} height={32} {...shape} />
      <polygon points={`${box + 37},18 ${box + 64},58 ${box + 10},58`} {...shape} />
      <polygon points={starPoints(2 * box + 37, 40, 26, 11)} {...shape} />
      <polygon
        points={`${3 * box + 10},32 ${3 * box + 42},32 ${3 * box + 42},20 ${3 * box + 64},40 ${3 * box + 42},60 ${3 * box + 42},48 ${3 * box + 10},48`}
        {...shape}
      />
      {['A', 'B', 'C', 'D'].map((letter, i) => (
        <Label key={letter} x={i * box + 37} y={80}>
          {letter}
        </Label>
      ))}
    </FigureSvg>
  );
}
