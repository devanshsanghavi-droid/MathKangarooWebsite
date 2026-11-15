import { FigureSvg, Label, STROKE, FILL_SURFACE, W_THIN } from './primitives.tsx';

/**
 * KA-0353 - a map of three places. Three paths join Home to the Park, two paths join the Park
 * to School, and one path runs straight from Home to School without passing the Park.
 */
export function PathsHomeParkSchool() {
  const home = { x: 34, y: 104 };
  const park = { x: 130, y: 30 };
  const school = { x: 226, y: 104 };
  const curve = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    cx: number,
    cy: number,
  ) => `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;

  const paths = [
    curve(home, park, 52, 40),
    curve(home, park, 82, 67),
    curve(home, park, 112, 94),
    curve(park, school, 196, 44),
    curve(park, school, 164, 94),
    curve(home, school, 130, 164),
  ];
  const places = [
    { ...home, name: 'Home' },
    { ...park, name: 'Park' },
    { ...school, name: 'School' },
  ];

  return (
    <FigureSvg width={260} height={150}>
      {paths.map((d) => (
        <path key={d} d={d} fill="none" stroke={STROKE} strokeWidth={W_THIN} />
      ))}
      {places.map((place) => (
        <g key={place.name}>
          <rect
            x={place.x - 26}
            y={place.y - 11}
            width={52}
            height={22}
            rx={5}
            fill={FILL_SURFACE}
            stroke={STROKE}
            strokeWidth={W_THIN}
          />
          <Label x={place.x} y={place.y}>
            {place.name}
          </Label>
        </g>
      ))}
    </FigureSvg>
  );
}
