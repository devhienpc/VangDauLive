// src/utils/mockData.ts – Dữ liệu mẫu để dev/preview khi chưa có API

import type { PriceItem } from '../types';

const now = new Date().toISOString();

export const MOCK_PRICES: PriceItem[] = [
  // ── Vàng ─────────────────────────────────────────────────────────
  {
    id: 1, category: 'gold', symbol: 'XAU_VND',
    name: 'Vàng thế giới (quy đổi)',
    buy_price: 8_780_000, sell_price: 8_830_000,
    unit: 'VND/chỉ', source: 'MetalPriceAPI', fetched_at: now, created_at: now,
  },
  {
    id: 2, category: 'gold', symbol: 'XAU_USD',
    name: 'Vàng thế giới (USD/oz)',
    buy_price: 2_638, sell_price: 2_651,
    unit: 'USD/oz', source: 'MetalPriceAPI', fetched_at: now, created_at: now,
  },
  // ── Bạc ──────────────────────────────────────────────────────────
  {
    id: 3, category: 'silver', symbol: 'XAG_VND',
    name: 'Bạc thế giới (quy đổi)',
    buy_price: 788_000, sell_price: 793_000,
    unit: 'VND/oz', source: 'MetalPriceAPI', fetched_at: now, created_at: now,
  },
  {
    id: 4, category: 'silver', symbol: 'XAG_USD',
    name: 'Bạc thế giới (USD/oz)',
    buy_price: 31.2, sell_price: 31.4,
    unit: 'USD/oz', source: 'MetalPriceAPI', fetched_at: now, created_at: now,
  },
  // ── Xăng dầu ─────────────────────────────────────────────────────
  {
    id: 5, category: 'fuel', symbol: 'RON95_III',
    name: 'Xăng RON 95-III',
    buy_price: null, sell_price: 21_610,
    unit: 'VND/lít', source: 'BộCôngThương', fetched_at: now, created_at: now,
  },
  {
    id: 6, category: 'fuel', symbol: 'RON95_IV',
    name: 'Xăng RON 95-IV',
    buy_price: null, sell_price: 22_280,
    unit: 'VND/lít', source: 'BộCôngThương', fetched_at: now, created_at: now,
  },
  {
    id: 7, category: 'fuel', symbol: 'RON92_E5',
    name: 'Xăng E5 RON 92',
    buy_price: null, sell_price: 20_900,
    unit: 'VND/lít', source: 'BộCôngThương', fetched_at: now, created_at: now,
  },
  {
    id: 8, category: 'fuel', symbol: 'DO0005',
    name: 'Dầu diesel 0.05S',
    buy_price: null, sell_price: 19_640,
    unit: 'VND/lít', source: 'BộCôngThương', fetched_at: now, created_at: now,
  },
  {
    id: 9, category: 'fuel', symbol: 'DOHOA',
    name: 'Dầu hỏa',
    buy_price: null, sell_price: 18_730,
    unit: 'VND/lít', source: 'BộCôngThương', fetched_at: now, created_at: now,
  },
  // ── Dầu thô ──────────────────────────────────────────────────────
  {
    id: 10, category: 'oil', symbol: 'BRENT',
    name: 'Dầu thô Brent',
    buy_price: null, sell_price: 77.5,
    unit: 'USD/thùng', source: 'EIA', fetched_at: now, created_at: now,
  },
  {
    id: 11, category: 'oil', symbol: 'BRENT_VND',
    name: 'Dầu Brent (VND/thùng)',
    buy_price: null, sell_price: 1_953_000,
    unit: 'VND/thùng', source: 'EIA', fetched_at: now, created_at: now,
  },
  // ── Ngoại tệ ─────────────────────────────────────────────────────
  {
    id: 12, category: 'forex', symbol: 'USD_VND',
    name: 'Đô la Mỹ',
    buy_price: 25_030, sell_price: 25_180,
    unit: 'VND/USD', source: 'ExchangeRate-API', fetched_at: now, created_at: now,
  },
  {
    id: 13, category: 'forex', symbol: 'EUR_VND',
    name: 'Euro',
    buy_price: 27_580, sell_price: 27_820,
    unit: 'VND/EUR', source: 'ExchangeRate-API', fetched_at: now, created_at: now,
  },
  {
    id: 14, category: 'forex', symbol: 'JPY_VND',
    name: 'Yên Nhật',
    buy_price: 163, sell_price: 168,
    unit: 'VND/JPY', source: 'ExchangeRate-API', fetched_at: now, created_at: now,
  },
  {
    id: 15, category: 'forex', symbol: 'GBP_VND',
    name: 'Bảng Anh',
    buy_price: 32_300, sell_price: 32_600,
    unit: 'VND/GBP', source: 'ExchangeRate-API', fetched_at: now, created_at: now,
  },
  {
    id: 16, category: 'forex', symbol: 'CNY_VND',
    name: 'Nhân dân tệ',
    buy_price: 3_450, sell_price: 3_500,
    unit: 'VND/CNY', source: 'ExchangeRate-API', fetched_at: now, created_at: now,
  },
  {
    id: 17, category: 'forex', symbol: 'KRW_VND',
    name: 'Won Hàn Quốc',
    buy_price: 18.2, sell_price: 18.6,
    unit: 'VND/KRW', source: 'ExchangeRate-API', fetched_at: now, created_at: now,
  },
  {
    id: 18, category: 'forex', symbol: 'SGD_VND',
    name: 'Đô la Singapore',
    buy_price: 18_900, sell_price: 19_100,
    unit: 'VND/SGD', source: 'ExchangeRate-API', fetched_at: now, created_at: now,
  },
  {
    id: 19, category: 'forex', symbol: 'THB_VND',
    name: 'Baht Thái',
    buy_price: 690, sell_price: 710,
    unit: 'VND/THB', source: 'ExchangeRate-API', fetched_at: now, created_at: now,
  },
];
