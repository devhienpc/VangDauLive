// src/adapters/oil.ts
// Adapter giá dầu thô thế giới (Brent, WTI)
// - Nguồn chính: EIA API v2 (series RBRTE, RWTC) kèm ngày dữ liệu (period)
// - Nguồn dự phòng: Yahoo Finance chart API (BZ=F, CL=F) - chỉ dùng khi EIA lỗi
// - Lưu đúng cột source để không trộn 2 nguồn trong cùng một chuỗi biểu đồ.
// - BỎ Twelve Data.

import type { PriceRecord } from '../types.js';

const EIA_ENDPOINT = 'https://api.eia.gov/v2/petroleum/pri/spt/data/';

interface EiaDataItem {
  period: string;
  series: string;
  'series-description'?: string;
  value: string | number | null;
  units?: string;
}

interface EiaV2Response {
  response?: {
    data?: EiaDataItem[];
  };
  error?: unknown;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
      };
    }>;
    error?: unknown;
  };
}

/**
 * Định dạng period "YYYY-MM-DD" thành "dd/MM" (ví dụ 2026-10-06 -> 06/10)
 */
export function formatPeriodDayMonth(periodStr?: string | null): string {
  if (!periodStr) return '';
  const parts = periodStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return periodStr;
}

/**
 * Nguồn chính: EIA API v2
 */
async function fetchEiaOilPrices(apiKey: string): Promise<PriceRecord[]> {
  if (!apiKey) {
    throw new Error('EIA_API_KEY chưa được cấu hình');
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    frequency: 'daily',
    'data[0]': 'value',
    'facets[series][]': 'RBRTE',
    'sort[0][column]': 'period',
    'sort[0][direction]': 'desc',
    length: '4',
  });
  // Thêm facet thứ 2 cho WTI
  const url = `${EIA_ENDPOINT}?${params.toString()}&facets[series][]=RWTC`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`EIA API v2 trả về HTTP ${res.status}`);
  }

  const json = (await res.json()) as EiaV2Response;
  const entries = json.response?.data ?? [];

  if (entries.length === 0) {
    throw new Error('EIA API v2 trả về mảng dữ liệu rỗng');
  }

  const fetchedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const records: PriceRecord[] = [];

  // Tìm bản ghi mới nhất của Brent (RBRTE)
  const brentItem = entries.find((e) => e.series === 'RBRTE');
  if (brentItem && brentItem.value != null) {
    const val = typeof brentItem.value === 'string' ? parseFloat(brentItem.value) : brentItem.value;
    if (!isNaN(val) && val > 0) {
      const dayMonth = formatPeriodDayMonth(brentItem.period);
      records.push({
        symbol: 'BRENT',
        name: `Dầu Brent (Giá ngày ${dayMonth})`,
        category: 'oil',
        bid: null,
        ask: Math.round(val * 100) / 100,
        unit: 'USD/thùng',
        source: 'EIA',
        fetched_at: fetchedAt,
        period: brentItem.period,
      });
    }
  }

  // Tìm bản ghi mới nhất của WTI (RWTC)
  const wtiItem = entries.find((e) => e.series === 'RWTC');
  if (wtiItem && wtiItem.value != null) {
    const val = typeof wtiItem.value === 'string' ? parseFloat(wtiItem.value) : wtiItem.value;
    if (!isNaN(val) && val > 0) {
      const dayMonth = formatPeriodDayMonth(wtiItem.period);
      records.push({
        symbol: 'WTI',
        name: `Dầu WTI (Giá ngày ${dayMonth})`,
        category: 'oil',
        bid: null,
        ask: Math.round(val * 100) / 100,
        unit: 'USD/thùng',
        source: 'EIA',
        fetched_at: fetchedAt,
        period: wtiItem.period,
      });
    }
  }

  if (records.length === 0) {
    throw new Error('Không parse được giá hợp lệ từ EIA API');
  }

  return records;
}

/**
 * Nguồn dự phòng: Yahoo Finance Chart API (BZ=F cho Brent, CL=F cho WTI)
 */
export async function fetchYahooOilPrices(): Promise<PriceRecord[]> {
  const symbols = [
    { yahooSymbol: 'BZ=F', symbol: 'BRENT', name: 'Dầu Brent' },
    { yahooSymbol: 'CL=F', symbol: 'WTI',   name: 'Dầu WTI' },
  ];

  const fetchedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const records: PriceRecord[] = [];

  for (const s of symbols) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${s.yahooSymbol}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) continue;

    const data = (await res.json()) as YahooChartResponse;
    const meta = data.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;

    if (price != null && price > 0) {
      records.push({
        symbol: s.symbol,
        name: s.name,
        category: 'oil',
        bid: null,
        ask: Math.round(price * 100) / 100,
        unit: 'USD/thùng',
        source: 'Yahoo Finance',
        fetched_at: fetchedAt,
        period: null,
      });
    }
  }

  if (records.length === 0) {
    throw new Error('Nguồn dự phòng Yahoo Finance không lấy được giá dầu');
  }

  return records;
}

/**
 * Adapter thu thập giá dầu: thử EIA API v2 trước, nếu lỗi chuyển sang Yahoo Finance
 */
export async function fetchOilPrices(apiKey?: string): Promise<{
  records: PriceRecord[];
  sourceUsed: string;
}> {
  try {
    const records = await fetchEiaOilPrices(apiKey ?? '');
    return { records, sourceUsed: 'EIA' };
  } catch (err) {
    const backupRecords = await fetchYahooOilPrices();
    return { records: backupRecords, sourceUsed: 'Yahoo Finance (backup)' };
  }
}
