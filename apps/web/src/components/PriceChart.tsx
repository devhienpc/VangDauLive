// src/components/PriceChart.tsx – Recharts line chart cho lịch sử giá

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import type { HistoryItem } from '../types';
import { formatChartDate, formatPrice } from '../utils/format';
import { CHART_COLORS } from '../utils/categories';

interface PriceChartProps {
  data: HistoryItem[];
  symbol: string;
  name: string;
  category: string;
  unit: string;
  isLoading: boolean;
}

// Custom tooltip
function ChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: HistoryItem }>;
  unit: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  if (!item) return null;

  return (
    <div
      className="glass-card px-4 py-3"
      style={{ border: '1px solid var(--border-dim)', minWidth: 160 }}
    >
      <p className="text-xs text-[var(--text-muted)] mb-1">
        {formatChartDate(item.payload.recorded_at)}
      </p>
      <p className="mono font-semibold text-sm text-[var(--text-primary)]">
        {formatPrice(item.value, unit.includes('USD') ? 2 : 0)} {unit}
      </p>
    </div>
  );
}

export function PriceChart({
  data,
  symbol,
  name,
  category,
  unit,
  isLoading,
}: PriceChartProps) {
  const color = CHART_COLORS[category] ?? '#fbbf24';

  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="skeleton w-full h-full rounded-xl" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-48 flex flex-col items-center justify-center gap-2"
        style={{ color: 'var(--text-muted)' }}>
        <span className="text-3xl">📈</span>
        <p className="text-sm">Chưa có dữ liệu lịch sử</p>
        <p className="text-xs">Dữ liệu sẽ tích lũy theo thời gian</p>
      </div>
    );
  }

  // Tính min/max để reference line
  const prices = data.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

  const chartData = data.map((d) => ({
    ...d,
    date: formatChartDate(d.recorded_at),
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-52"
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {name}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {data.length} điểm dữ liệu (30 ngày)
          </p>
        </div>
        <div className="text-right">
          <p className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
            TB: {formatPrice(avgPrice, unit.includes('USD') ? 2 : 0)}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{unit}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />

          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />

          <YAxis
            hide
            domain={[minPrice * 0.998, maxPrice * 1.002]}
          />

          <Tooltip content={<ChartTooltip unit={unit} />} />

          <ReferenceLine
            y={avgPrice}
            stroke="rgba(255,255,255,0.1)"
            strokeDasharray="4 4"
          />

          <Line
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color, stroke: 'var(--bg-deep)', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
