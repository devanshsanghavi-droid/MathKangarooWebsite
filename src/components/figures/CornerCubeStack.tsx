import { FigureSvg, IsoCube, sortIsometric } from './primitives.tsx';

/**
 * KA-0009 - a stepped stack: a 3 by 3 bottom layer, a 2 by 2 layer on one corner of it, and a
 * single cube on top. Fourteen cubes in all, several of them hidden from this viewpoint.
 */
export function CornerCubeStack() {
  const cubes: Array<[number, number, number]> = [];
  for (let c = 0; c < 3; c += 1) for (let r = 0; r < 3; r += 1) cubes.push([c, r, 0]);
  for (let c = 0; c < 2; c += 1) for (let r = 0; r < 2; r += 1) cubes.push([c, r, 1]);
  cubes.push([0, 0, 2]);

  return (
    <FigureSvg width={160} height={160}>
      <g transform="translate(0, 6)">
        {sortIsometric(cubes).map(([c, r, l]) => (
          <IsoCube
            key={`${c}-${r}-${l}`}
            col={c}
            row={r}
            level={l}
            unit={17}
            originX={80}
            originY={34}
          />
        ))}
      </g>
    </FigureSvg>
  );
}
