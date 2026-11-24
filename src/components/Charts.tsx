import React, { useState } from 'react';
import type { ProcessCapacityRow } from '../types/erp';

interface DualSeriesPoint {
  label: string;
  seriesA: number;
  seriesB: number;
}

interface TrendChartProps {
  title: string;
  subtitle: string;
  unit: string;
  seriesALabel: string;
  seriesBLabel: string;
  colorA?: string;
  colorB?: string;
  data: DualSeriesPoint[];
  kind?: 'line' | 'bar';
}

export const DualMetricChart: React.FC<TrendChartProps> = ({
  title,
  subtitle,
  unit,
  seriesALabel,
  seriesBLabel,
  colorA = '#111827',
  colorB = '#10A37F',
  data,
  kind = 'line',
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 520;
  const height = 210;
  const padLeft = 44;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 30;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const maxVal = Math.max(
    10,
    ...data.flatMap((d) => [d.seriesA, d.seriesB])
  );
  const yTop = Math.ceil((maxVal * 1.15) / 100) * 100;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(yTop * r));

  const getX = (i: number) =>
    data.length === 1
      ? padLeft + innerW / 2
      : padLeft + (i / (data.length - 1)) * innerW;

  const getBarCenterX = (i: number) =>
    padLeft + ((i + 0.5) / data.length) * innerW;

  const getY = (val: number) => padTop + innerH - (val / yTop) * innerH;

  const pathA = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d.seriesA).toFixed(1)}`)
    .join(' ');
  const pathB = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d.seriesB).toFixed(1)}`)
    .join(' ');

  const activePoint = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
          <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#4B5563] shrink-0">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="w-2.5 h-2.5 rounded-xs inline-block"
              style={{ backgroundColor: colorA }}
            />
            {seriesALabel}
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="w-2.5 h-2.5 rounded-xs inline-block"
              style={{ backgroundColor: colorB }}
            />
            {seriesBLabel}
          </span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-52 overflow-visible select-none"
          role="img"
          aria-label={title}
        >
          {ticks.map((t) => {
            const y = getY(t);
            return (
              <g key={t}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#F3F4F6"
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-[#9CA3AF] text-[10px] font-mono-tabular"
                >
                  {t}
                </text>
              </g>
            );
          })}

          {kind === 'line' ? (
            <>
              <path
                d={pathA}
                fill="none"
                stroke={colorA}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={pathB}
                fill="none"
                stroke={colorB}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {data.map((d, i) => {
                const cx = getX(i);
                const isHover = hoverIdx === i;
                return (
                  <g
                    key={d.label}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    className="cursor-pointer"
                  >
                    {isHover && (
                      <line
                        x1={cx}
                        y1={padTop}
                        x2={cx}
                        y2={padTop + innerH}
                        stroke="#D1D5DB"
                        strokeDasharray="3 3"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={getY(d.seriesA)}
                      r={isHover ? 4.5 : 3}
                      fill={colorA}
                      stroke="#FFFFFF"
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={cx}
                      cy={getY(d.seriesB)}
                      r={isHover ? 4.5 : 3}
                      fill={colorB}
                      stroke="#FFFFFF"
                      strokeWidth={1.5}
                    />
                    <rect
                      x={cx - 24}
                      y={padTop}
                      width={48}
                      height={innerH + 20}
                      fill="transparent"
                    />
                    <text
                      x={cx}
                      y={height - 8}
                      textAnchor="middle"
                      className="fill-[#6B7280] text-[10px] font-mono-tabular"
                    >
                      {d.label.slice(2)}
                    </text>
                  </g>
                );
              })}
            </>
          ) : (
            data.map((d, i) => {
              const cx = getBarCenterX(i);
              const barW = 14;
              const yA = getY(d.seriesA);
              const yB = getY(d.seriesB);
              const hA = padTop + innerH - yA;
              const hB = padTop + innerH - yB;
              return (
                <g
                  key={d.label}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={cx - barW - 2}
                    y={yA}
                    width={barW}
                    height={hA}
                    rx={3}
                    fill={colorA}
                    opacity={hoverIdx === null || hoverIdx === i ? 0.92 : 0.45}
                  />
                  <rect
                    x={cx + 2}
                    y={yB}
                    width={barW}
                    height={hB}
                    rx={3}
                    fill={colorB}
                    opacity={hoverIdx === null || hoverIdx === i ? 0.92 : 0.45}
                  />
                  <text
                    x={cx}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-[#6B7280] text-[10px] font-mono-tabular"
                  >
                    {d.label.slice(2)}
                  </text>
                </g>
              );
            })
          )}
        </svg>

        {activePoint && (
          <div className="mt-1 flex items-center justify-between rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-1.5 text-xs text-[#374151] tabular-nums">
            <span className="font-mono-tabular font-medium text-[#111827]">
              {activePoint.label}
            </span>
            <div className="flex items-center gap-4">
              <span>
                {seriesALabel}:{' '}
                <strong className="font-mono-tabular text-[#111827]">
                  {activePoint.seriesA.toLocaleString()} {unit}
                </strong>
              </span>
              <span>
                {seriesBLabel}:{' '}
                <strong className="font-mono-tabular text-[#10A37F]">
                  {activePoint.seriesB.toLocaleString()} {unit}
                </strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ProcessLoadBarChart: React.FC<{
  rows: ProcessCapacityRow[];
  onInspectPlan?: () => void;
}> = ({ rows, onInspectPlan }) => {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#111827]">
            各工序本周负荷率与瓶颈标识
          </h3>
          <p className="text-xs text-[#6B7280] mt-0.5">
            口径：计划所需标准工时 / 设备可用班次工时（&gt;90% 预警，&gt;100% 瓶颈）
          </p>
        </div>
        {onInspectPlan && (
          <button
            type="button"
            onClick={onInspectPlan}
            className="text-xs font-medium text-[#111827] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            进入排产调优 →
          </button>
        )}
      </div>

      <div className="space-y-4">
        {rows.map((row) => {
          const pct = Math.min(130, row.loadRate);
          const barColor =
            row.status === '瓶颈'
              ? 'bg-[#DC2626]'
              : row.status === '预警'
              ? 'bg-[#D97706]'
              : 'bg-[#10A37F]';
          const textColor =
            row.status === '瓶颈'
              ? 'text-[#DC2626]'
              : row.status === '预警'
              ? 'text-[#B45309]'
              : 'text-[#047857]';

          return (
            <div key={row.process} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#111827]">
                    {row.process}车间
                  </span>
                  <span className="text-[#6B7280] tabular-nums">
                    {row.equipmentCount} 台在役设备
                  </span>
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="text-[#6B7280] font-mono-tabular">
                    {row.requiredHours.toFixed(1)}h / {row.availableHours.toFixed(1)}h
                  </span>
                  <span className={`font-mono-tabular font-semibold ${textColor}`}>
                    {row.loadRate.toFixed(1)}% · {row.status}
                  </span>
                </div>
              </div>
              <div className="relative h-2.5 w-full rounded-full bg-[#F3F4F6] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${barColor}`}
                  style={{ width: `${Math.min(100, (pct / 120) * 100)}%` }}
                />
                {/* 100% threshold marker */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-[#111827]/35"
                  style={{ left: `${(100 / 120) * 100}%` }}
                  title="100% 满负荷红线"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-[#F3F4F6] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6B7280]">
        <span className="whitespace-nowrap">竖线标尺：100% 满负荷红线</span>
        <span className="font-mono-tabular whitespace-nowrap">W48 排产 · 845 工时定额 · 72 台设备</span>
      </div>
    </div>
  );
};
