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
  diff_amount?: number | null;
}

export interface FuelHistoryItem {
  symbol: string;
  name: string;
  price_zone1: number;
  price_zone2?: number | null;
  diff_zone1?: number | null;
  diff_zone2?: number | null;
  change_pct?: number | null;
}

export interface FuelPeriodHistory {
  effective_at: string;
  period_label: string;
  note: string;
  items: FuelHistoryItem[];
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

// ─── Kiểu dữ liệu nhận định giá xăng dầu ──────────────────────────────────
export type ForecastDirection = 'tăng' | 'giảm' | 'đi ngang';
export type ForecastMagnitude = 'nhẹ' | 'vừa' | 'mạnh';
export type ForecastConfidence = 'thấp' | 'vừa' | 'trung bình' | 'cao';
export type ForecastStatus = 'published' | 'draft' | 'ready' | 'insufficient_data';

export interface NewsFactorItem {
  news_id: number;
  title: string;
  url: string;
  impact: 'đẩy giá lên' | 'kéo giá xuống' | 'trung tính';
  certainty: 'thấp' | 'vừa' | 'cao';
  one_line: string;
}

export interface NewsFactorGroup {
  factor: string;
  supportingCount: number;
  dominantImpact: 'đẩy giá lên' | 'kéo giá xuống' | 'trung tính';
  items: NewsFactorItem[];
}

export interface ForecastCycleInfo {
  cycleIndex: number;
  startDate: string;
  endDate: string;
  isCurrentCycle: boolean;
}

export interface ForecastReasons {
  status?: string;
  benchmark?: string;
  changePct?: number;
  brentChangePct?: number;
  consistentWithBrent?: boolean;
  validDaysInCurrentPeriod?: number;
  thresholdUsed?: number;
  backtestAccuracy?: number;
  r2?: number;
  r2Explanation?: string;
  reasons?: string[];
  currentCycle?: ForecastCycleInfo;
  previousCycle?: ForecastCycleInfo;
  news_factors?: NewsFactorGroup[];
}

export interface ForecastItem {
  id: number;
  created_at: string;
  target_period_start: string;
  product: string;
  direction: ForecastDirection | null;
  magnitude: ForecastMagnitude | null;
  range_low: number | null;
  range_high: number | null;
  confidence: ForecastConfidence;
  status: ForecastStatus;
  reasons_json?: string;
  reasons?: ForecastReasons;
  model_version: string;
  display_status?: string;
}

export interface ForecastAccuracySummary {
  total_evaluations: number;
  total_hits: number;
  overall_accuracy_pct: number;
  recent_evaluations: number;
  recent_hits: number;
  recent_accuracy_pct: number;
  is_auto_shutoff?: boolean;
  display_status?: 'Hoạt động bình thường' | 'Chưa đủ cơ sở nhận định' | string;
}

export interface ForecastAccuracyRecord {
  id: number;
  forecast_id: number;
  product: string;
  target_period_start: string;
  forecast_direction: ForecastDirection;
  actual_delta: number;
  actual_direction: ForecastDirection;
  hit: number; // 1: đúng, 0: sai
  evaluated_at: string;
}

export interface ForecastAccuracyResponseData extends ForecastAccuracySummary {
  items: ForecastAccuracyRecord[];
}

export interface LatestForecastResponseData {
  count: number;
  is_auto_shutoff: boolean;
  display_status?: string;
  items: ForecastItem[];
  accuracyStats?: ForecastAccuracySummary;
  updatedAt: string;
}

