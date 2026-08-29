import { FigureSvg, Cell, Label, FILL_SOLID } from './primitives.tsx';

/**
 * KA-0081 — the view from above and the view from the front of a solid built on a 2 by 2 base.
 * Together they pin the shape down enough to ask for the smallest number of cubes.
 */
export function TwoViewsOfSolid() {
  const s = 30;
  const pad = 10;
  const gap = 54;
  const secondX = pad + 2 * s + gap;

  return (
    <FigureSvg width={secondX + 2 * s + pad} height={2 * s + 34}>
      {[0, 1].flatMap((r) => [0, 1].map((c) => (
        <Cell key={`top-${r}-${c}`} x={pad + c * s} y={6 + r * s} size={s} fill={FILL_SOLID} />
      )))}
      <Label x={pad + s} y={2 * s + 22}>
        from above
      </Label>

      {[0, 1].flatMap((r) => [0, 1].map((c) => (
        <Cell key={`front-${r}-${c}`} x={secondX + c * s} y={6 + r * s} size={s} fill={FILL_SOLID} />
      )))}
      <Label x={secondX + s} y={2 * s + 22}>
        from the front
      </Label>
    </FigureSvg>
  );
}
