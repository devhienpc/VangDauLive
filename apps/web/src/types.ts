// src/types.ts – Định nghĩa kiểu dữ liệu toàn diện cho frontend

export type Category = 'gold' | 'silver' | 'fuel' | 'forex' | 'oil';

export interface PriceRecord {
  id: number;
  symbol: string;
  name: string;
  category: Category;
  bid: number | null;
  ask: number | null;
  unit: string;
  change_pct: number;
  source: string;
  fetched_at: string;
  effective_at?: string | null;
  stale?: number | boolean | null;
  period?: string | null;
  price_zone1?: number | null;
  price_zone2?: number | null;
}

// Tương thích ngược với các component cũ
export interface PriceItem {
  id: number;
  category: Category;
  symbol: string;
  name: string;
  buy_price: number | null;
  sell_price: number | null;
  unit: string;
  source: string;
  fetched_at: string;
  created_at?: string;
  change_pct?: number;
}

export interface HistoryPoint {
  date: string;
  price: number;
  unit: string;
  source: string;
}

export interface HistoryResponseData {
  [symbol: string]: HistoryPoint[];
}

export interface CandleDataPoint {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CandlesResponseData {
  symbol: string;
  source: string;
  hasOHLC: boolean;
  candles: CandleDataPoint[];
  updatedAt?: string | null;
}

export interface HistoryItem {
  symbol: string;
  price: number;
  recorded_at: string;
  source: string;
}

export interface NewsRecord {
  id: number;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: string;
  published_at: string;
}

export interface IngestSourceLog {
  source: string;
  status: 'ok' | 'error' | 'warning';
  message: string;
  createdAt: string;
}

export interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  stale: boolean;
  updatedAt: string | null;
  priceCount: number;
  workerVersion: string;
  serverTime: string;
  sources: IngestSourceLog[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  updatedAt?: string | null;
  meta?: Record<string, unknown>;
}

export interface CategoryMeta {
  key: Category;
  label: string;
  icon: string;
  color: string;
  badgeClass: string;
  description: string;
}
