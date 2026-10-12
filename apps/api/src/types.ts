// src/types.ts – Các kiểu dữ liệu dùng chung trong API

export type Category = 'gold' | 'silver' | 'fuel' | 'forex' | 'oil';

export interface PriceRecord {
  id?: number;
  symbol: string;
  name: string;
  category: Category;
  bid?: number | null;
  ask?: number | null;
  buyPrice?: number | null;
  sellPrice?: number | null;
  unit: string;
  change_pct?: number | null;
  source: string;
  fetched_at?: string;
  fetchedAt?: string;
  period?: string | null;
}

export interface PriceHistoryRecord {
  symbol: string;
  price: number;
  recordedAt: string;
  source: string;
}

export interface NewsRecord {
  id?: number;
  title: string;
  summary?: string | null;
  category?: string | null;
  url: string;
  source: string;
  published_at: string;
}

export interface IngestLogRecord {
  id?: number;
  source: string;
  status: string;
  message?: string | null;
  created_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  updatedAt?: string;
}

// Env bindings từ wrangler.toml + secrets
export interface Env {
  DB: D1Database;
  APP_ENV: string;
  EIA_API_KEY: string;
  METALS_API_KEY: string;
  ADMIN_KEY?: string;
  EXCHANGE_API_KEY?: string;
}

