// src/api/client.ts – Client API kết nối backend Hono / Cloudflare D1
import type {
  ApiResponse,
  PriceRecord,
  HistoryResponseData,
  NewsRecord,
  HealthData,
  Category,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

async function request<T>(path: string): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    let errMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errData = await res.json();
      if (errData && errData.error) {
        errMessage = errData.error;
      }
    } catch {
      // Bỏ qua lỗi parse JSON error
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
