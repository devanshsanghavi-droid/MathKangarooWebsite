import { FigureSvg, IsoCube, sortIsometric } from './primitives.tsx';

/** KA-0038 - a solid 4 by 3 by 2 block of unit cubes, drawn so both layers are visible. */
export function UnitCubeBlock() {
  const cubes: Array<[number, number, number]> = [];
  for (let c = 0; c < 4; c += 1)
    for (let r = 0; r < 3; r += 1) for (let l = 0; l < 2; l += 1) cubes.push([c, r, l]);

  return (
    <FigureSvg width={200} height={160}>
      <g transform="translate(0, 8)">
        {sortIsometric(cubes).map(([c, r, l]) => (
          <IsoCube
            key={`${c}-${r}-${l}`}
            col={c}
            row={r}
            level={l}
            unit={16}
            originX={72}
            originY={30}
          />
        ))}
      </g>
    </FigureSvg>
  );
}
