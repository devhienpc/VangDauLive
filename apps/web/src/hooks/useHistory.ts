// src/hooks/useHistory.ts – Custom hook tải lịch sử giá cho chart

import { useState, useEffect } from 'react';
import type { HistoryItem } from '../types';
import { fetchPriceHistory } from '../api/client';

interface UseHistoryState {
  data: HistoryItem[];
  isLoading: boolean;
  error: string | null;
}

export function useHistory(symbol: string, days: number = 30): UseHistoryState {
  const [data, setData] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    const rangeStr = days <= 30 ? '30d' : days <= 90 ? '90d' : '1y';
    fetchPriceHistory(symbol, rangeStr)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          const list = res.data[symbol] ?? [];
          setData(
            list.map((p) => ({
              symbol,
              price: p.price,
              recorded_at: p.date,
              source: p.source,
            })),
          );
        } else {
          setError(res.error ?? 'Không thể tải lịch sử');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Lỗi kết nối');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [symbol, days]);

  return { data, isLoading, error };
}
