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

/**
 * Định dạng thời điểm đưa ra nhận định: "Đưa ra lúc HH:mm dd/MM"
 */
export function formatForecastTime(isoString?: string | null): string {
  if (!isoString) return 'Đưa ra lúc —';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Đưa ra lúc —';

  const pad = (n: number) => String(n).padStart(2, '0');
  // Chuyển sang múi giờ Việt Nam (+07:00)
  const vnTime = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const hh = pad(vnTime.getHours());
  const mm = pad(vnTime.getMinutes());
  const day = pad(vnTime.getDate());
  const month = pad(vnTime.getMonth() + 1);

  return `Đưa ra lúc ${hh}:${mm} ${day}/${month}`;
}

/**
 * Tính và định dạng: "Dự kiến kỳ điều hành: chiều thứ Năm dd/MM" (suy từ lịch sử hoặc ngày tới)
 */
export function formatEstimatedPeriod(targetDateStr?: string | null): string {
  const pad = (n: number) => String(n).padStart(2, '0');

  if (targetDateStr) {
    const cleanStr = targetDateStr.trim().slice(0, 10);
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const targetDate = new Date(year, month, day);

      if (!isNaN(targetDate.getTime())) {
        // Kiểm tra xem có rơi vào thứ Năm (day 4) hay không
        return `Dự kiến kỳ điều hành: chiều thứ Năm ${pad(day)}/${pad(month + 1)}`;
      }
    }
  }

  // Nếu không có hoặc không hợp lệ, tính thứ Năm tiếp theo từ hôm nay
  const now = new Date();
  const currentDay = now.getDay(); // 0: Sun, 1: Mon, ..., 4: Thu, 5: Fri, 6: Sat
  let daysUntilThursday = (4 - currentDay + 7) % 7;
  // Nếu hôm nay là thứ Năm nhưng đã qua buổi chiều (sau 15:00), lấy thứ Năm tuần kế tiếp
  if (daysUntilThursday === 0 && now.getHours() >= 15) {
    daysUntilThursday = 7;
  }

  const nextThursday = new Date(now.getTime() + daysUntilThursday * 24 * 60 * 60 * 1000);
  const dd = pad(nextThursday.getDate());
  const mm = pad(nextThursday.getMonth() + 1);

  return `Dự kiến kỳ điều hành: chiều thứ Năm ${dd}/${mm}`;
}

/**
 * Trích xuất tên nguồn báo chí từ URL
 */
export function extractSourceName(url?: string | null, fallback: string = 'Nguồn tin'): string {
  if (!url) return fallback;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (host.includes('vnexpress')) return 'VnExpress';
    if (host.includes('tuoitre')) return 'Tuổi Trẻ';
    if (host.includes('thanhnien')) return 'Thanh Niên';
    if (host.includes('dantri')) return 'Dân Trí';
    if (host.includes('vietnamnet')) return 'VietNamNet';
    if (host.includes('baochinhphu')) return 'Báo Chính Phủ';
    if (host.includes('cafef')) return 'CafeF';
    if (host.includes('congthuong')) return 'Báo Công Thương';
    if (host.includes('petrolimex')) return 'Petrolimex';
    if (host.includes('reuters')) return 'Reuters';
    if (host.includes('bloomberg')) return 'Bloomberg';
    if (host.includes('vtv')) return 'VTV';
    return host;
  } catch {
    return fallback;
  }
}

