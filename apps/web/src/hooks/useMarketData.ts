// src/hooks/useMarketData.ts – TanStack Query hooks cho dữ liệu thị trường
import { useQuery } from '@tanstack/react-query';
import {
  fetchAllPrices,
  fetchPriceHistory,
  fetchNews,
  fetchHealth,
} from '../api/client';
import type { Category } from '../types';

/**
 * Hook lấy toàn bộ danh sách giá mới nhất
 */
export function useMarketPrices(category?: Category | string) {
  return useQuery({
    queryKey: ['prices', category ?? 'all'],
    queryFn: async () => {
      const res = await fetchAllPrices(category);
      return res.data ?? [];
    },
    staleTime: 10 * 60 * 1000, // 10 phút
  });
}

/**
 * Hook lấy lịch sử giá nhiều mã theo khoảng thời gian
 */
export function useMarketHistory(
  symbols: string[] = ['SJC-01', 'BRENT', 'XAU_USD'],
  range: '30d' | '90d' | '1y' = '30d',
) {
  return useQuery({
    queryKey: ['history', symbols.sort().join(','), range],
    queryFn: async () => {
      const res = await fetchPriceHistory(symbols, range);
      return res.data ?? {};
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook lấy tin tức tài chính, năng lượng, vĩ mô
 */
export function useMarketNews(category?: string, limit: number = 20) {
  return useQuery({
    queryKey: ['news', category ?? 'all', limit],
    queryFn: async () => {
      const res = await fetchNews(category, limit);
      return res.data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook lấy thông tin trạng thái hệ thống và thời điểm cập nhật cuối
 */
export function useSystemHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetchHealth();
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 phút cho health
    refetchInterval: 5 * 60 * 1000,
  });
}
