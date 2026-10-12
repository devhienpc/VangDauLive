// src/api/client.ts – Client API kết nối backend Hono / Cloudflare D1
import type {
  ApiResponse,
  PriceRecord,
  HistoryResponseData,
  CandlesResponseData,
  NewsRecord,
  HealthData,
  Category,
} from '../types';

/**
 * Tự động phân giải URL API chính xác
 */
function getBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.replace(/\/$/, '');
  }

  // Khi chạy trên domain Cloudflare (workers.dev hoặc pages.dev)
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Nếu chạy trên subdomain .workers.dev của user (ví dụ: vangdau-live.hienpcthichlamit.workers.dev)
    if (host.includes('workers.dev')) {
      const match = host.match(/vangdau-(?:live|ui|web)\.([a-z0-9_-]+)\.workers\.dev/i);
      if (match && match[1]) {
        return `https://vangdau-api.${match[1]}.workers.dev/api`;
      }
      return 'https://vangdau-api.hienpcthichlamit.workers.dev/api';
    }
    // Nếu chạy trên pages.dev
    if (host.includes('pages.dev')) {
      return 'https://vangdau-api.hienpcthichlamit.workers.dev/api';
    }
  }

  return envUrl ?? '/api';
}

async function request<T>(path: string): Promise<ApiResponse<T>> {
  const base = getBaseUrl();
  const url = `${base}${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Máy chủ không trả về JSON (nhận về ${contentType || 'HTML'}). Vui lòng kiểm tra endpoint API: ${url}`,
    );
  }

  if (!res.ok) {
    let errMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errData = await res.json();
      if (errData && errData.error) {
        errMessage = errData.error;
      }
    } catch {
      // Bỏ qua lỗi parse
    }
    throw new Error(errMessage);
  }

  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success && json.error) {
    throw new Error(json.error);
  }
  return json;
}

/**
 * Lấy danh sách giá mới nhất
 * @param category Lọc theo danh mục (tuỳ chọn)
 */
export async function fetchAllPrices(category?: Category | string): Promise<ApiResponse<PriceRecord[]>> {
  const query = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
  return request<PriceRecord[]>(`/prices${query}`);
}

/**
 * Lấy lịch sử giá theo ngày cho biểu đồ
 * @param symbols Mảng symbol hoặc chuỗi comma-separated
 * @param range '30d' | '90d' | '1y'
 */
export async function fetchPriceHistory(
  symbols: string[] | string,
  range: '30d' | '90d' | '1y' = '30d',
): Promise<ApiResponse<HistoryResponseData>> {
  const symStr = Array.isArray(symbols) ? symbols.join(',') : symbols;
  return request<HistoryResponseData>(`/history?symbols=${encodeURIComponent(symStr)}&range=${range}`);
}

/**
 * Lấy tin tức tài chính, thị trường mới nhất
 * @param category Danh mục tin
 * @param limit Số lượng bài viết (1 - 50)
 */
export async function fetchNews(
  category?: string,
  limit: number = 20,
): Promise<ApiResponse<NewsRecord[]>> {
  const params = new URLSearchParams();
  if (category && category !== 'all') params.set('category', category);
  if (limit) params.set('limit', String(limit));
  const query = params.toString() ? `?${params.toString()}` : '';
  return request<NewsRecord[]>(`/news${query}`);
}

/**
 * Lấy trạng thái hoạt động của hệ thống và thời điểm cập nhật mới nhất
 */
export async function fetchHealth(): Promise<ApiResponse<HealthData>> {
  return request<HealthData>('/health');
}

/**
 * Lấy nến OHLC phục vụ biểu đồ TradingView Lightweight Charts
 * @param symbol Mã hàng hóa (ví dụ: XAU_USD, BRENT, SJC-01)
 * @param range '1w' | '1m' | '3m' | '6m' | '1y' | 'all'
 */
export async function fetchCandles(
  symbol: string = 'XAU_USD',
  range: string = '1y',
): Promise<ApiResponse<CandlesResponseData>> {
  return request<CandlesResponseData>(
    `/candles?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`,
  );
}
