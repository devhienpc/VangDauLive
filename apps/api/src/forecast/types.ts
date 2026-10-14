// apps/api/src/forecast/types.ts
// Các định nghĩa kiểu dữ liệu cho module nhận định giá xăng dầu

export type ForecastDirection = 'tăng' | 'giảm' | 'đi ngang';
export type ForecastMagnitude = 'nhẹ' | 'vừa' | 'mạnh';
export type ForecastConfidence = 'thấp' | 'trung bình' | 'cao';
export type ForecastStatus = 'published' | 'draft' | 'ready' | 'insufficient_data';

export interface NewsInterventionSignal {
  hasIntervention: boolean;
  reason?: string;
  interventionFactor?: number; // Hệ số can thiệp quỹ BOG (ví dụ 0.5 làm giảm độ tin cậy)
}

export interface PeriodWindow {
  cycleIndex: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  isCurrentCycle: boolean;
}

export interface ReferenceChangeMetric {
  symbol: string;
  benchmarkSymbol: string;
  brentSymbol: string;
  fxSymbol: string;
  currentAvgVND: number;
  prevAvgVND: number;
  changePct: number;
  brentChangePct: number;
  consistentWithBrent: boolean;
  validDaysInCurrentPeriod: number;
}

export interface ProductBacktestMetrics {
  product: string;
  benchmark: string;
  totalPeriods: number;
  correctCount: number;
  accuracyPct: number;
  confusionMatrix: {
    tăng: { tăng: number; giảm: number; 'đi ngang': number };
    giảm: { tăng: number; giảm: number; 'đi ngang': number };
    'đi ngang': { tăng: number; giảm: number; 'đi ngang': number };
  };
  ols: {
    alpha: number;
    beta: number;
    r2: number;
    stdError: number;
  };
}

export interface BacktestReport {
  generatedAt: string;
  totalPeriods: number;
  evaluatedPairs: number;
  optimalThresholdPct: number;
  overallAccuracyPct: number;
  meetsAccuracyThreshold: boolean; // >= 60%
  meetsR2Threshold: boolean;       // >= 0.5
  percentile33Pct: number;
  percentile67Pct: number;
  productMetrics: Record<string, ProductBacktestMetrics>;
}

export interface ForecastConfig {
  thresholdPct: number;
  r2: number;
  overallAccuracyPct: number;
  p33Magnitude: number;
  p67Magnitude: number;
  minRequiredPeriods: number;
  minAccuracyThreshold: number;
  minR2Threshold: number;
  actualDeltaThreshold?: number;
  modelVersion: string;
}

export interface ForecastResult {
  id?: number;
  created_at?: string;
  target_period_start: string;
  product: string;
  direction: ForecastDirection | null;
  magnitude: ForecastMagnitude | null;
  range_low: number | null;
  range_high: number | null;
  confidence: ForecastConfidence;
  status: ForecastStatus;
  reasons_json: string;
  model_version: string;
}

export interface ForecastEvaluationResult {
  id?: number;
  forecast_id: number;
  product: string;
  target_period_start: string;
  forecast_direction: ForecastDirection;
  actual_delta: number;
  actual_direction: ForecastDirection;
  hit: number;
  evaluated_at: string;
}

export interface ForecastAccuracyStats {
  total_evaluations: number;
  total_hits: number;
  overall_accuracy_pct: number;
  recent_evaluations: number;
  recent_hits: number;
  recent_accuracy_pct: number;
  is_auto_shutoff: boolean;
  display_status: 'Hoạt động bình thường' | 'Chưa đủ cơ sở nhận định';
  items: ForecastEvaluationResult[];
}

