// apps/api/src/forecast/config.ts
// Cấu hình tham số mô hình nhận định giá xăng dầu và kết quả backtest thực tế

import type { ForecastConfig } from './types.ts';

export const FORECAST_CONFIG: ForecastConfig = {
  // Ngưỡng tối ưu toàn cục tìm được từ thuật toán quét Grid Search trên 52 kỳ lịch sử
  thresholdPct: 0.1,

  // Hệ số xác định hồi quy OLS cao nhất trong các sản phẩm (0.016 < 0.5)
  r2: 0.016,

  // Độ chính xác hướng thực tế đạt được từ backtest (44.62% < 60%)
  overallAccuracyPct: 44.62,

  // Phân vị độ lớn biến động (|refChangePct|)
  p33Magnitude: 1.68, // Dưới 1.68% là biến động nhẹ
  p67Magnitude: 4.73, // Từ 1.68% đến 4.73% là vừa, trên 4.73% là mạnh

  // Điều kiện bắt buộc của hệ thống
  minRequiredPeriods: 30,      // Phải có ít nhất 30 kỳ lịch sử
  minAccuracyThreshold: 60.0,  // Độ chính xác backtest hướng phải đạt tối thiểu 60%
  minR2Threshold: 0.5,         // R² phải đạt tối thiểu 0.5 mới hiển thị khoảng ước lượng VND/lít
  actualDeltaThreshold: 50,    // Ngưỡng biến động giá thực tế trong nước: |delta| <= 50 coi là đi ngang

  modelVersion: 'v1.0.0-rules',
};

export const ACTUAL_DELTA_THRESHOLD = FORECAST_CONFIG.actualDeltaThreshold ?? 50;

