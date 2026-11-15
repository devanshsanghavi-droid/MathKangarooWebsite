import { FigureSvg, Label, STROKE, GRID, W_THICK, W_THIN, W_HAIR } from './primitives.tsx';

/**
 * KA-0535 - a distance-from-home graph of a bike ride over 6 hours. The line rises to 12 km
 * after 1 hour, stays flat until hour 2, rises to 20 km at hour 3, stays flat until hour 4,
 * then falls steadily back to 0 km at hour 6.
 */
export function RideDistanceGraph() {
  const points: Array<[number, number]> = [
    [0, 0],
    [1, 12],
    [2, 12],
    [3, 20],
    [4, 20],
    [6, 0],
  ];
  const maxHours = 6;
  const maxKm = 20;
  const xUnit = 40; // pixels per hour
  const yUnit = 7; // pixels per km
  const left = 40;
  const top = 24;
  const baseline = top + maxKm * yUnit;
  const right = left + maxHours * xUnit;

  const px = (h: number) => left + h * xUnit;
  const py = (km: number) => baseline - km * yUnit;

  return (
    <FigureSvg width={right + 20} height={baseline + 40}>
      {Array.from({ length: maxKm / 4 + 1 }, (_, i) => i * 4).map((km) => (
        <g key={`km-${km}`}>
          <line
            x1={left - 4}
            y1={py(km)}
            x2={right}
            y2={py(km)}
            stroke={GRID}
            strokeWidth={W_HAIR}
          />
          <Label x={left - 16} y={py(km)}>
            {km}
          </Label>
        </g>
      ))}
      {Array.from({ length: maxHours + 1 }, (_, h) => h).map((h) => (
        <g key={`h-${h}`}>
          <line
            x1={px(h)}
            y1={top}
            x2={px(h)}
            y2={baseline + 4}
            stroke={GRID}
            strokeWidth={W_HAIR}
          />
          <Label x={px(h)} y={baseline + 14}>
            {h}
          </Label>
        </g>
      ))}
      <line x1={left} y1={top - 6} x2={left} y2={baseline} stroke={STROKE} strokeWidth={W_THIN} />
      <line
        x1={left}
        y1={baseline}
        x2={right + 6}
        y2={baseline}
        stroke={STROKE}
        strokeWidth={W_THIN}
      />
      <polyline
        points={points.map(([h, km]) => `${px(h)},${py(km)}`).join(' ')}
        fill="none"
        stroke={STROKE}
        strokeWidth={W_THICK}
        strokeLinejoin="round"
      />
      <Label x={left + 18} y={top - 14}>
        km from home
      </Label>
      <Label x={(left + right) / 2} y={baseline + 30}>
        time (hours)
      </Label>
    </FigureSvg>
  );
}
