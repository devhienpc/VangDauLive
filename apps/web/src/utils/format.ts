// src/utils/format.ts – Hàm tiện ích định dạng số, ngày giờ

/**
 * Định dạng số tiền theo locale Việt Nam
 * VD: 7500000 → "7.500.000"
 */
export function formatPrice(
  value: number | null | undefined,
  decimals: number = 0,
): string {
  if (value == null) return '—';
  return value.toLocaleString('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Định dạng giá với đơn vị
 * VD: formatPriceWithUnit(7500000, 'VND/chỉ') → "7.500.000 VND/chỉ"
 */
export function formatPriceWithUnit(
  value: number | null | undefined,
  unit: string,
  decimals: number = 0,
): string {
  if (value == null) return '—';
  return `${formatPrice(value, decimals)} ${unit}`;
}

/**
 * Định dạng thời gian cập nhật
 * VD: "2024-10-05T08:00:00.000Z" → "08:00, 05/10/2024"
 */
export function formatUpdatedAt(isoString: string | null | undefined): string {
  if (!isoString) return 'Chưa có dữ liệu';
  const date = new Date(isoString);
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

/**
 * Định dạng ngắn chỉ hiờ:phút theo giờ Việt Nam
 */
export function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

/**
 * Tính % thay đổi giữa hai giá
 */
export function calcChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Rút ngắn số lớn (tr, tỷ)
 */
export function shortNumber(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} tr`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} k`;
  return String(value);
}

/**
 * Định dạng ngày cho trục X của chart
 */
export function formatChartDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('vi-VN', {
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}
