import { scaleLinear } from 'd3-scale';
import type { CurvePoint } from '../../lib/auctionCurve';

interface PoolSparklineProps {
  points: CurvePoint[];
  stroke: string;
  fill: string;
  seedEth?: number | null;
}

export function PoolSparkline({
  points,
  stroke,
  fill,
  seedEth,
}: PoolSparklineProps) {
  if (points.length < 2) {
    return (
      <div className="flex h-14 items-center justify-center rounded-md bg-bg/70 text-[11px] text-ink-faint">
        No curve data
      </div>
    );
  }

  const width = 240;
  const height = 56;
  const padY = 4;

  const minTs = points[0].ts;
  const maxTs = points[points.length - 1].ts;
  let minEth = Math.min(...points.map((p) => p.eth));
  let maxEth = Math.max(...points.map((p) => p.eth));
  if (seedEth && seedEth > 0) {
    minEth = Math.min(minEth, seedEth);
    maxEth = Math.max(maxEth, seedEth);
  }
  if (maxEth <= minEth) {
    maxEth = minEth * 1.1 || 1;
  }

  const xScale = scaleLinear().domain([minTs, maxTs]).range([0, width]);
  const yScale = scaleLinear()
    .domain([minEth, maxEth])
    .range([height - padY, padY]);

  const linePath = points
    .map((p, idx) => {
      const x = xScale(p.ts).toFixed(1);
      const y = yScale(p.eth).toFixed(1);
      return `${idx === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');

  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const seedY = seedEth && seedEth > 0 ? yScale(seedEth) : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-14 w-full overflow-visible rounded-md bg-bg/60"
      aria-hidden="true"
    >
      {seedY !== null && (
        <line
          x1={0}
          x2={width}
          y1={seedY}
          y2={seedY}
          stroke="rgba(148, 163, 184, 0.3)"
          strokeDasharray="3 3"
          strokeWidth={1}
        />
      )}
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.75} />
    </svg>
  );
}