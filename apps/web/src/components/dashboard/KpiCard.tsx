// src/components/dashboard/KpiCard.tsx
// Thẻ KPI với: count-up, sparkline draw, stagger fade+slide, hover nổi, price flash

import { useEffect, useId, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import type { KpiItem } from '../../data/mockDashboard';
import { useCountUp } from '../../hooks/useCountUp';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { usePrevious } from '../../hooks/usePrevious';

interface KpiCardProps {
  item: KpiItem;
  index?: number;  // stagger delay index
}

// ── Animated sparkline ──────────────────────────────────────────────────────
function AnimatedSparkline({
  data,
  color,
  animate,
}: {
  data: number[];
  color: string;
  animate: boolean;
}) {
  const pathRef   = useRef<SVGPolylineElement>(null);
  const [ready, setReady] = useState(false);
  const [length, setLength] = useState(0);
  const gradId = useId();

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 32;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  const fillPath = `M${pts[0]} L${pts.join(' L')} L${w},${h} L0,${h} Z`;

  useEffect(() => {
    if (pathRef.current) {
      const l = pathRef.current.getTotalLength?.() ?? 200;
      setLength(l);
      setReady(true);
    }
  }, []);

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      className="kpi-sparkline"
    >
      <defs>
        <linearGradient id={`sp-fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>

      {/* Fill luôn hiện */}
      <path d={fillPath} fill={`url(#sp-fill-${gradId})`} />

      {/* Stroke chạy từ trái sang phải */}
      <polyline
        ref={pathRef}
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={
          ready && animate && length > 0
            ? {
                strokeDasharray: length,
                strokeDashoffset: 0,
                animation: `spark-draw 1s ease forwards`,
                ['--spark-len' as string]: length,
              }
            : {}
        }
      />
    </svg>
  );
}

// ── KpiCard ─────────────────────────────────────────────────────────────────
export function KpiCard({ item, index = 0 }: KpiCardProps) {
  const reduced  = useReducedMotion();
  const ref      = useRef<HTMLElement>(null);
  const inView   = useInView(ref, { once: true, margin: '-40px' });

  const isUp   = item.changePct > 0;
  const isDown = item.changePct < 0;
  const changeClass = isUp ? 'change-up' : isDown ? 'change-down' : 'change-neutral';
  const changeSign  = isUp ? '+' : '';

  // Count-up: chỉ chạy khi vào viewport
  const animated = useCountUp({
    target: item.price,
    duration: reduced ? 0 : 1100,
    enabled: inView,
  });

  // Giá hiện tại (count-up or static nếu reduced)
  const formattedPrice = (reduced ? item.price : Math.round(animated)).toLocaleString('vi-VN');

  // Price flash khi giá thay đổi
  const prevPrice  = usePrevious(item.price);
  const [flashCls, setFlashCls] = useState('');
  useEffect(() => {
    if (prevPrice === undefined || prevPrice === item.price || reduced) return;
    const cls = item.price > prevPrice ? 'flash-up' : 'flash-down';
    setFlashCls(cls);
    const t = setTimeout(() => setFlashCls(''), 700);
    return () => clearTimeout(t);
  }, [item.price, prevPrice, reduced]);

  // Stagger delay
  const delay = reduced ? 0 : index * 0.08;

  return (
    <motion.article
      ref={ref}
      className={`kpi-card kpi-card--motion ${flashCls}`}
      id={`kpi-${item.id}`}
      aria-label={`${item.label}: ${item.price.toLocaleString('vi-VN')} ${item.unit}`}
      initial={reduced ? false : { opacity: 0, y: 22 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduced ? {} : { y: -4, boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px ${item.colorVar}33` }}
    >
      {/* Top row */}
      <div className="kpi-top">
        <span className="kpi-label">{item.label}</span>
        <span
          className={`kpi-change ${changeClass}`}
          aria-label={`Thay đổi ${changeSign}${item.changePct}%`}
        >
          {isUp && (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M5 2L9 8H1L5 2Z" fill="currentColor" />
            </svg>
          )}
          {isDown && (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M5 8L9 2H1L5 8Z" fill="currentColor" />
            </svg>
          )}
          {changeSign}{item.changePct.toFixed(2)}%
        </span>
      </div>

      {/* Price + sparkline */}
      <div className="kpi-body">
        <div>
          <p className="kpi-price" style={{ color: item.colorVar }}>
            {formattedPrice}
          </p>
          <p className="kpi-unit">{item.unit}</p>
        </div>
        <AnimatedSparkline
          data={item.sparkline}
          color={item.colorVar}
          animate={inView && !reduced}
        />
      </div>

      {/* Bottom accent */}
      <div className="kpi-accent-line" style={{ background: item.colorVar }} aria-hidden="true" />
    </motion.article>
  );
}
