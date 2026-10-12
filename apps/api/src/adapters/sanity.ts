// src/adapters/sanity.ts
// Kiểm tra tính hợp lệ (sanity check) và bảo vệ dữ liệu chống sốc giá (>20%)

import type { PriceRecord } from '../types.js';

export interface SanityRange {
  min: number;
  max: number;
}

/** Giới hạn giá hợp lý cho từng nhóm symbol để ngăn chặn parse nhầm rác */
export const SANITY_RANGES: Record<string, SanityRange> = {
  // Ngoại tệ (VND)
  USD_VND:   { min: 20_000, max: 35_000 },
  EUR_VND:   { min: 22_000, max: 40_000 },
  JPY_VND:   { min: 100,    max: 280 },
  GBP_VND:   { min: 25_000, max: 45_000 },
  CNY_VND:   { min: 2_500,  max: 5_500 },
  SGD_VND:   { min: 14_000, max: 26_000 },

  // Dầu thô thế giới (USD/thùng)
  BRENT:     { min: 30, max: 200 },
  WTI:       { min: 30, max: 200 },

  // Kim loại quý thế giới (USD/oz)
  XAU_USD:   { min: 1_000, max: 10_000 },
  XAG_USD:   { min: 10,    max: 200 },

  // Vàng trong nước (VND/lượng)
  'SJC-01':  { min: 50_000_000, max: 250_000_000 },
  'SJC-05':  { min: 25_000_000, max: 125_000_000 },

  // Xăng dầu nội địa (VND/lít)
  RON95_III: { min: 10_000, max: 50_000 },
  RON92_E5:  { min: 10_000, max: 50_000 },
  DO0005:    { min: 10_000, max: 50_000 },
  DO001:     { min: 10_000, max: 50_000 },
};

export interface GuardCheckResult {
  valid: boolean;
  reason?: string;
  isWarning?: boolean;
}

/**
 * Kiểm tra giá mới:
 * 1. Giá <= 0 hoặc NaN
 * 2. Vi phạm biên giới hạn sanity
 * 3. Lệch quá 20% so với giá trước đó (nếu có bản ghi trước)
 */
export function checkPriceSanity(
  record: PriceRecord,
  previousPrice?: number | null,
): GuardCheckResult {
  const currentPrice = record.ask ?? record.bid ?? record.sellPrice ?? record.buyPrice;

  if (currentPrice == null || isNaN(currentPrice) || currentPrice <= 0) {
    return {
      valid: false,
      reason: `Giá không hợp lệ (<= 0 hoặc rỗng): ${currentPrice}`,
      isWarning: true,
    };
  }

  // Kiểm tra biên sanity nếu có cấu hình
  const range = SANITY_RANGES[record.symbol];
  if (range) {
    if (currentPrice < range.min || currentPrice > range.max) {
      return {
        valid: false,
        reason: `Giá ${record.symbol} (${currentPrice}) nằm ngoài biên hợp lý [${range.min} - ${range.max}]`,
        isWarning: true,
      };
    }
  }

  // Kiểm tra lệch quá 20% so với bản ghi trước
  if (previousPrice != null && previousPrice > 0) {
    const diffRatio = Math.abs(currentPrice - previousPrice) / previousPrice;
    if (diffRatio > 0.20) {
      const pct = (diffRatio * 100).toFixed(1);
      return {
        valid: false,
        reason: `Giá ${record.symbol} (${currentPrice}) lệch quá 20% (${pct}%) so với bản ghi trước (${previousPrice})`,
        isWarning: true,
      };
    }
  }

  return { valid: true };
}
