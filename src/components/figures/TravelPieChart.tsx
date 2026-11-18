import { FigureSvg, Label, STROKE, FILL_SURFACE, FILL_ACCENT, W_THIN } from './primitives.tsx';

/**
 * KA-1382 - a pie chart of how 120 pupils travel to school. Going clockwise from the top: Walk
 * 105 degrees, Bus (angle not marked, 135 degrees as drawn), Car 75 degrees, Bike 45 degrees.
 * The bus angle is left unlabelled on purpose: the solver must work it out from the other three.
 */
export function TravelPieChart() {
  const cx = 110;
  const cy = 100;
  const r = 84;
  const sectors: Array<{ name: string; degrees: number; label: string | null }> = [
    { name: 'Walk', degrees: 105, label: '105°' },
    { name: 'Bus', degrees: 135, label: null },
    { name: 'Car', degrees: 75, label: '75°' },
    { name: 'Bike', degrees: 45, label: '45°' },
  ];

  // Angles are measured clockwise from 12 o'clock.
  const point = (deg: number, radius: number): [number, number] => {
    const rad = (deg * Math.PI) / 180;
    return [cx + radius * Math.sin(rad), cy - radius * Math.cos(rad)];
  };

  let start = 0;
  const drawn = sectors.map((sector, index) => {
    const end = start + sector.degrees;
    const [x1, y1] = point(start, r);
    const [x2, y2] = point(end, r);
    const large = sector.degrees > 180 ? 1 : 0;
    const [lx, ly] = point(start + sector.degrees / 2, r * 0.6);
    const shape = (
      <g key={sector.name}>
        <path
          d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
          fill={index % 2 === 0 ? FILL_SURFACE : FILL_ACCENT}
          stroke={STROKE}
          strokeWidth={W_THIN}
        />
        <Label x={lx} y={sector.label ? ly - 7 : ly}>
          {sector.name}
        </Label>
        {sector.label ? (
          <Label x={lx} y={ly + 8}>
            {sector.label}
          </Label>
        ) : null}
      </g>
    );
    start = end;
    return shape;
  });

  return (
    <FigureSvg width={cx * 2} height={cy * 2}>
      {drawn}
    </FigureSvg>
  );
}
