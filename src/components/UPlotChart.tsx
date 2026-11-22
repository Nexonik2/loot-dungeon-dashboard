import { useEffect, useRef } from 'react';
import uPlot from 'uplot';

interface UPlotChartProps {
  data: uPlot.AlignedData;
  series: uPlot.Series[];
  height?: number;
  axes?: uPlot.Axis[];
  scales?: uPlot.Scales;
}

export function UPlotChart({
  data,
  series,
  height = 240,
  axes,
  scales,
}: UPlotChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const initialWidth = Math.max(260, Math.floor(el.clientWidth));

    const opts: uPlot.Options = {
      width: initialWidth,
      height,
      series,
      scales: scales ?? {
        x: { time: true },
      },
      axes: axes ?? [
        {
          stroke: '#94a3b8',
          grid: { stroke: 'rgba(148, 163, 184, 0.12)', width: 1 },
          ticks: { stroke: 'rgba(148, 163, 184, 0.2)', width: 1 },
        },
        {
          stroke: '#94a3b8',
          grid: { stroke: 'rgba(148, 163, 184, 0.12)', width: 1 },
          ticks: { stroke: 'rgba(148, 163, 184, 0.2)', width: 1 },
          size: 56,
        },
      ],
      cursor: {
        drag: { x: false, y: false },
      },
      legend: {
        show: true,
      },
    };

    const plot = new uPlot(opts, data, el);
    plotRef.current = plot;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !plotRef.current) return;
      const nextWidth = Math.max(260, Math.floor(entry.contentRect.width));
      plotRef.current.setSize({ width: nextWidth, height });
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [data, series, height, axes, scales]);

  return <div ref={containerRef} className="w-full overflow-hidden" />;
}