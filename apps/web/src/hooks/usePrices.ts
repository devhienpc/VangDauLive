// src/hooks/usePrices.ts – Custom hook tải dữ liệu giá

import { useState, useEffect, useCallback } from 'react';
import type { PriceItem, Category } from '../types';
import { fetchAllPrices } from '../api/client';

interface UsePricesState {
  data: PriceItem[];
  isLoading: boolean;
  error: string | null;
  updatedAt: string | null;
  refresh: () => void;
}

export function usePrices(): UsePricesState {
  const [data, setData] = useState<PriceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAllPrices();
      if (res.success && res.data) {
        setData(
          res.data.map((r) => ({
            id: r.id,
            category: r.category,
            symbol: r.symbol,
            name: r.name,
            buy_price: r.bid,
            sell_price: r.ask,
            unit: r.unit,
            source: r.source,
            fetched_at: r.fetched_at,
            change_pct: r.change_pct,
          })),
        );
        setUpdatedAt(res.updatedAt ?? null);
      } else {
        setError(res.error ?? 'Không thể tải dữ liệu');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, updatedAt, refresh: load };
}

/** Lọc data theo category */
export function filterByCategory(
  data: PriceItem[],
  category: Category,
): PriceItem[] {
  return data.filter((item) => item.category === category);
}
