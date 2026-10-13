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
  effective_at?: string | null;
  stale?: number | null;
  period?: string | null;
}

export interface FuelManualRecord {
  id?: number;
  symbol: string;
  price_zone1: number;
  price_zone2?: number | null;
  effective_at: string;
  note?: string | null;
  created_at?: string;
}

export interface FuelSuggestionRecord {
  id?: number;
  source: string;
  symbol: string;
  name?: string | null;
  price_zone1: number;
  price_zone2?: number | null;
  effective_at?: string | null;
  raw_text?: string | null;
  status?: 'pending' | 'approved' | 'dismissed';
  image_url?: string | null;
  needs_review?: number | null;
  flags?: string | null;
  created_at?: string;
}

export interface PriceHistoryRecord {
  symbol: string;
  price: number;
  recordedAt: string;
  source: string;
}

export interface DailyCandle {
  symbol: string;
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  source: string;
}

export interface CandlesResult {
  symbol: string;
  source: string;
  hasOHLC: boolean;
  candles: Array<{
    time: string; // YYYY-MM-DD
    open: number;
    high: number;
    low: number;
    close: number;
  }>;
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
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  AI?: any;
  ANTHROPIC_API_KEY?: string;
}

