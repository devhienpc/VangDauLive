// src/utils/categories.ts – Metadata cho từng danh mục

import type { CategoryMeta } from '../types';

export const CATEGORIES: CategoryMeta[] = [
  {
    key: 'gold',
    label: 'Vàng',
    icon: '🥇',
    color: '#fbbf24',
    badgeClass: 'badge-gold',
    description: 'Giá vàng trong nước và quốc tế',
  },
  {
    key: 'silver',
    label: 'Bạc',
    icon: '🥈',
    color: '#94a3b8',
    badgeClass: 'badge-silver',
    description: 'Giá bạc thế giới',
  },
  {
    key: 'fuel',
    label: 'Xăng dầu',
    icon: '⛽',
    color: '#60a5fa',
    badgeClass: 'badge-fuel',
    description: 'Giá xăng dầu Việt Nam',
  },
  {
    key: 'oil',
    label: 'Dầu thô',
    icon: '🛢️',
    color: '#2dd4bf',
    badgeClass: 'badge-oil',
    description: 'Giá dầu thô thế giới',
  },
  {
    key: 'forex',
    label: 'Ngoại tệ',
    icon: '💱',
    color: '#a78bfa',
    badgeClass: 'badge-forex',
    description: 'Tỉ giá ngoại tệ',
  },
];

export function getCategoryMeta(key: string): CategoryMeta {
  return (
    CATEGORIES.find((c) => c.key === key) ?? {
      key: 'gold',
      label: key,
      icon: '📊',
      color: '#94a3b8',
      badgeClass: 'badge-silver',
      description: '',
    }
  );
}

/** Màu đường chart cho mỗi category */
export const CHART_COLORS: Record<string, string> = {
  gold: '#fbbf24',
  silver: '#94a3b8',
  fuel: '#60a5fa',
  oil: '#2dd4bf',
  forex: '#a78bfa',
};
