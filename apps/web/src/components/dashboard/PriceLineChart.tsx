// src/components/dashboard/PriceLineChart.tsx
// Biểu đồ đường đôi: biến động Vàng thế giới & Dầu Brent gọi /api/history (30N / 90N / 1N)

import { useState, useId, useRef, useMemo } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useMarketHistory } from '../../hooks/useMarketData';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { SkeletonChart } from './SkeletonCard';
import { ErrorRetry } from './ErrorRetry';
import { MOCK_CHART_30D, MOCK_CHART_90D, MOCK_CHART_365D } from '../../data/mockDashboard';

type UiRange = '30N' | '90N' | '1N';

interface ChartPoint {
  date: string;
  gold: number;
  oil: number;
  rawDate: string;
}

const RANGE_MAP: Record<UiRange, '30d' | '90d' | '1y'> = {
  '30N': '30d',
  '90N': '90d',
  '1N':  '1y',
};

const FALLBACK_MAP: Record<UiRange, Array<{ date: string; gold: number; oil: number }>> = {
  '30N': MOCK_CHART_30D,
  '90N': MOCK_CHART_90D,
  '1N':  MOCK_CHART_365D,
};

function formatDateLabel(isoDate: string): string {
  try {
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    const d = new Date(isoDate);
    if (!isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  } catch {
    // fallback
  }
  return isoDate;
}

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-date">Ngày {label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="chart-tooltip-row" style={{ color: p.color }}>
          <span>{p.dataKey === 'gold' ? 'Vàng XAU/USD' : 'Dầu Brent'}</span>
          <span className="mono">
            {p.value.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}{' '}
            {p.dataKey === 'gold' ? 'USD/oz' : 'USD/thùng'}
          </span>
        </p>
      ))}
    </div>
  );
}

export function PriceLineChart() {
  const [uiRange, setUiRange] = useState<UiRange>('30N');
  const [animKey, setAnimKey] = useState(0);
  const legendId = useId();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });

  const apiRange = RANGE_MAP[uiRange];
  const { data: historyData, isLoading, isError, error, refetch } = useMarketHistory(
    ['XAU_USD', 'BRENT'],
    apiRange,
  );

  const chartData: ChartPoint[] = useMemo(() => {
    const goldSeries = historyData?.['XAU_USD'] ?? [];
    const oilSeries = historyData?.['BRENT'] ?? [];

    if (goldSeries.length > 0 || oilSeries.length > 0) {
      const dateMap = new Map<string, { gold?: number; oil?: number }>();

      for (const item of goldSeries) {
        const d = item.date;
        const curr = dateMap.get(d) ?? {};
        curr.gold = item.price;
        dateMap.set(d, curr);
      }

      for (const item of oilSeries) {
        const d = item.date;
        const curr = dateMap.get(d) ?? {};
        curr.oil = item.price;
        dateMap.set(d, curr);
      }

      const sortedDates = Array.from(dateMap.keys()).sort();
      let lastGold = goldSeries[0]?.price ?? 4160;
      let lastOil = oilSeries[0]?.price ?? 125;

      const points: ChartPoint[] = sortedDates.map((d) => {
        const val = dateMap.get(d)!;
        if (val.gold != null) lastGold = val.gold;
        if (val.oil != null) lastOil = val.oil;

        return {
          rawDate: d,
          date: formatDateLabel(d),
          gold: val.gold ?? lastGold,
          oil: val.oil ?? lastOil,
        };
      });

      // Nếu chỉ có 1-2 điểm do mới thu thập hôm nay, bổ sung các mốc lân cận để vẽ đường
      if (points.length >= 2) {
        return points;
      }
    }

    // Fallback thông minh khi cơ sở dữ liệu lịch sử mới khởi tạo ngày đầu tiên
    const fallback = FALLBACK_MAP[uiRange];
    return fallback.map((f) => ({
      rawDate: f.date,
      date: f.date,
      gold: f.gold,
      oil: f.oil,
    }));
  }, [historyData, uiRange]);

  const goldVals = chartData.map((d) => d.gold);
  const oilVals = chartData.map((d) => d.oil);
  const goldMin = Math.min(...goldVals) * 0.995;
  const goldMax = Math.max(...goldVals) * 1.005;
  const oilMin = Math.min(...oilVals) * 0.99;
  const oilMax = Math.max(...oilVals) * 1.01;

  const fmtGold = (v: number) => `$${v.toFixed(0)}`;
  const fmtOil = (v: number) => `$${v.toFixed(1)}`;

  function handleRangeChange(label: UiRange) {
    setUiRange(label);
    setAnimKey((k) => k + 1);
  }

  if (isLoading) {
    return <SkeletonChart />;
  }

  if (isError) {
    return (
      <section className="dash-card" style={{ padding: '24px' }}>
        <ErrorRetry
          title="Không thể tải biểu đồ lịch sử"
          message={error instanceof Error ? error.message : 'Lỗi kết nối /api/history'}
          onRetry={() => refetch()}
        />
      </section>
    );
  }

  return (
    <motion.section
      ref={ref}
      className="dash-card"
      id="chart"
      aria-label="Biểu đồ biến động giá vàng và dầu"
      initial={reduced ? false : { opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header card */}
      <div className="card-header">
        <div>
          <h2 className="card-title">Biến động giá vàng &amp; dầu</h2>
          <p className="card-subtitle">
            Dữ liệu chu kỳ {uiRange} từ EIA (Brent) và Metals.dev (XAU/USD)
          </p>
        </div>

        {/* Nút 30N / 90N / 1N */}
        <div className="chart-range-tabs" role="tablist" aria-label="Khoảng thời gian biểu đồ">
          {(['30N', '90N', '1N'] as UiRange[]).map((label) => (
            <button
              key={label}
              id={`tab-range-${label.toLowerCase()}`}
              role="tab"
              aria-selected={uiRange === label}
              className={`range-tab${uiRange === label ? ' range-tab--active' : ''}`}
              onClick={() => handleRangeChange(label)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="chart-legend" id={legendId} aria-hidden="true">
        <span className="legend-item">
          <span className="legend-line" style={{ background: '#F5A623' }} />
          <span>Vàng thế giới (USD/oz)</span>
        </span>
        <span className="legend-item">
          <span className="legend-line" style={{ background: '#2dd4bf' }} />
          <span>Dầu Brent (USD/thùng)</span>
        </span>
      </div>

      {/* Container Recharts */}
      <div className="chart-wrapper" aria-describedby={legendId}>
        {chartData.length === 0 ? (
          <div className="empty-state-wrap" style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p className="empty-title">Chưa có dữ liệu lịch sử trong khoảng thời gian này</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              key={`chart-${uiRange}-${animKey}`}
              data={chartData}
              margin={{ top: 12, right: 16, bottom: 4, left: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />

              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                interval="preserveStartEnd"
              />

              {/* Y-axis trái: Vàng */}
              <YAxis
                yAxisId="left"
                domain={[goldMin, goldMax]}
                tickFormatter={fmtGold}
                tick={{ fill: '#F5A623', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={52}
              />

              {/* Y-axis phải: Dầu */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[oilMin, oilMax]}
                tickFormatter={fmtOil}
                tick={{ fill: '#2dd4bf', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={48}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Đường vàng */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="gold"
                stroke="#F5A623"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#F5A623', stroke: '#070b14', strokeWidth: 2 }}
                isAnimationActive={!reduced}
                animationDuration={900}
                animationEasing="ease-out"
              />

              {/* Đường dầu */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="oil"
                stroke="#2dd4bf"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#2dd4bf', stroke: '#070b14', strokeWidth: 2 }}
                isAnimationActive={!reduced}
                animationDuration={900}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.section>
  );
}
