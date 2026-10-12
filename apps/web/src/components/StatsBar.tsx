// src/components/StatsBar.tsx – Thanh thống kê tổng quan ở đầu trang

import { motion } from 'framer-motion';
import type { PriceItem } from '../types';
import { formatPrice } from '../utils/format';

interface StatsBarProps {
  prices: PriceItem[];
}

export function StatsBar({ prices }: StatsBarProps) {
  const gold = prices.find((p) => p.symbol === 'XAU_VND');
  const goldUsd = prices.find((p) => p.symbol === 'XAU_USD');
  const usd = prices.find((p) => p.symbol === 'USD_VND');
  const brent = prices.find((p) => p.symbol === 'BRENT');
  const ron95 = prices.find((p) => p.symbol === 'RON95_III');

  const stats = [
    {
      id: 'stat-gold-vnd',
      icon: '🥇',
      label: 'Vàng (VND/chỉ)',
      value: formatPrice(gold?.sell_price),
      color: '#fbbf24',
    },
    {
      id: 'stat-gold-usd',
      icon: '📊',
      label: 'Vàng (USD/oz)',
      value: formatPrice(goldUsd?.sell_price, 0),
      color: '#fcd34d',
    },
    {
      id: 'stat-usd-vnd',
      icon: '💵',
      label: 'USD/VND',
      value: formatPrice(usd?.sell_price),
      color: '#a78bfa',
    },
    {
      id: 'stat-brent',
      icon: '🛢️',
      label: 'Dầu Brent (USD)',
      value: formatPrice(brent?.sell_price, 2),
      color: '#2dd4bf',
    },
    {
      id: 'stat-ron95',
      icon: '⛽',
      label: 'RON 95',
      value: `${formatPrice(ron95?.sell_price)} đ/L`,
      color: '#60a5fa',
    },
  ];

  if (prices.length === 0) return null;

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-3 min-w-max px-1">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.id}
            id={stat.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass-card flex items-center gap-3 px-4 py-3 min-w-[170px]"
            style={{ border: `1px solid rgba(255,255,255,0.06)` }}
          >
            <span className="text-xl">{stat.icon}</span>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
              <p
                className="mono font-bold text-base"
                style={{ color: stat.color }}
              >
                {stat.value}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
