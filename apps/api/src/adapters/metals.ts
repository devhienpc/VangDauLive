// src/adapters/metals.ts
// Adapter giá vàng & bạc thế giới (XAU/USD, XAG/USD)
// - Nguồn chính: Metals.dev (dùng METALS_API_KEY)
// - Nguồn dự phòng: Yahoo Finance chart API (GC=F, SI=F)
// - BỎ GoldAPI.

import type { PriceRecord } from '../types.js';

const METALS_DEV_URL = 'https://api.metals.dev/v1/latest';

interface MetalsDevResponse {
  status: string;
  currency: string;
  unit: string;
  metals?: {
    gold?: number;
    silver?: number;
    platinum?: number;
    palladium?: number;
  };
  error?: string;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
      };
    }>;
  };
}

/**
 * Nguồn chính: Metals.dev
 */
async function fetchMetalsDev(apiKey: string): Promise<PriceRecord[]> {
  if (!apiKey) {
    throw new Error('METALS_API_KEY chưa được cấu hình');
  }

  const url = `${METALS_DEV_URL}?api_key=${apiKey}&currency=USD&unit=toz`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Metals.dev trả về HTTP ${res.status}`);
  }

  const data = (await res.json()) as MetalsDevResponse;
  if (data.status !== 'success' || !data.metals) {
    throw new Error(`Metals.dev không trả về status success: ${data.error ?? 'Unknown'}`);
  }

  const gold = data.metals.gold;
  const silver = data.metals.silver;
  const fetchedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const records: PriceRecord[] = [];

  if (gold != null && gold > 0) {
    records.push({
      symbol: 'XAU_USD',
      name: 'Vàng thế giới XAU/USD',
      category: 'gold',
      bid: Math.round(gold * 0.999 * 100) / 100,
      ask: Math.round(gold * 100) / 100,
      unit: 'USD/oz',
      source: 'Metals.dev',
      fetched_at: fetchedAt,
    });
  }

  if (silver != null && silver > 0) {
    records.push({
      symbol: 'XAG_USD',
      name: 'Bạc thế giới XAG/USD',
      category: 'silver',
      bid: Math.round(silver * 0.998 * 100) / 100,
      ask: Math.round(silver * 100) / 100,
      unit: 'USD/oz',
      source: 'Metals.dev',
      fetched_at: fetchedAt,
    });
  }

  if (records.length === 0) {
    throw new Error('Metals.dev không chứa dữ liệu vàng bạc hợp lệ');
  }

  return records;
}

/**
 * Nguồn dự phòng: Yahoo Finance (GC=F cho Vàng, SI=F cho Bạc)
 */
export async function fetchYahooMetals(): Promise<PriceRecord[]> {
  const targets = [
    { yahooSymbol: 'GC=F', symbol: 'XAU_USD', name: 'Vàng thế giới XAU/USD', category: 'gold' as const },
    { yahooSymbol: 'SI=F', symbol: 'XAG_USD', name: 'Bạc thế giới XAG/USD', category: 'silver' as const },
  ];

  const fetchedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const records: PriceRecord[] = [];

  for (const t of targets) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${t.yahooSymbol}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) continue;

    const data = (await res.json()) as YahooChartResponse;
    const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;

    if (price != null && price > 0) {
      records.push({
        symbol: t.symbol,
        name: t.name,
        category: t.category,
        bid: Math.round(price * 0.999 * 100) / 100,
        ask: Math.round(price * 100) / 100,
        unit: 'USD/oz',
        source: 'Yahoo Finance',
        fetched_at: fetchedAt,
      });
    }
  }

  if (records.length === 0) {
    throw new Error('Nguồn dự phòng Yahoo Finance không lấy được giá kim loại');
  }

  return records;
}

/**
 * Adapter thu thập giá vàng / bạc: thử Metals.dev trước, lỗi chuyển sang Yahoo Finance
 */
export async function fetchMetalPrices(apiKey?: string): Promise<{
  records: PriceRecord[];
  sourceUsed: string;
}> {
  try {
    const records = await fetchMetalsDev(apiKey ?? '');
    return { records, sourceUsed: 'Metals.dev' };
  } catch (err) {
    const backupRecords = await fetchYahooMetals();
    return { records: backupRecords, sourceUsed: 'Yahoo Finance (backup)' };
  }
}
