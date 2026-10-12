// src/components/dashboard/PriceTicker.tsx
// Ticker giá chạy ngang dưới header, dừng khi hover, hỗ trợ dữ liệu thật từ API

import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { PriceRecord } from '../../types';

interface TickerDisplayItem {
  symbol: string;
  price: string;
  change: string;
  up: boolean;
}

const DEFAULT_TICKERS: TickerDisplayItem[] = [
  { symbol: 'SJC',      price: '144.300.000', change: '+0,00%', up: true  },
  { symbol: 'XAU/USD',  price: '4.166,80',    change: '+0,00%', up: true  },
  { symbol: 'XAG/USD',  price: '60,40',       change: '+0,00%', up: true  },
  { symbol: 'BRENT',    price: '125,44',      change: '+0,00%', up: true  },
  { symbol: 'WTI',      price: '96,24',       change: '+0,00%', up: true  },
  { symbol: 'RON92',    price: '26.390',      change: '0,00%',  up: true  },
  { symbol: 'USD/VND',  price: '26.120',      change: '+0,00%', up: true  },
  { symbol: 'EUR/VND',  price: '29.769',      change: '+0,00%', up: true  },
  { symbol: 'JPY/VND',  price: '168,4',       change: '+0,00%', up: true  },
];

function formatTickerNumber(val: number | null, unit: string): string {
  if (val == null) return '—';
  if (unit === 'USD/oz' || unit === 'USD/thùng') {
    return val.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return val.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

function mapRecordsToTicker(records: PriceRecord[]): TickerDisplayItem[] {
  if (!records || records.length === 0) return DEFAULT_TICKERS;

  return records.map((r) => {
    const val = r.ask ?? r.bid ?? 0;
    const change = (r.change_pct ?? 0) >= 0 ? `+${(r.change_pct ?? 0).toFixed(2)}%` : `${(r.change_pct ?? 0).toFixed(2)}%`;
    let cleanSym = r.symbol.replace('_VND', '').replace('-01', '');
    if (cleanSym === 'XAU_USD') cleanSym = 'XAU/USD';
    if (cleanSym === 'XAG_USD') cleanSym = 'XAG/USD';
    if (cleanSym === 'RON92_E5') cleanSym = 'RON92 E5';

    return {
      symbol: cleanSym,
      price: formatTickerNumber(val, r.unit),
      change,
      up: (r.change_pct ?? 0) >= 0,
    };
  });
}

function TickerItemBadge({ item }: { item: TickerDisplayItem }) {
  return (
    <span className="ticker-item">
      <span className="ticker-symbol">{item.symbol}</span>
      <span className="ticker-price">{item.price}</span>
      <span className={`ticker-change ${item.up ? 'ticker-up' : 'ticker-down'}`}>
        {item.up ? '▲' : '▼'} {item.change}
      </span>
      <span className="ticker-sep" aria-hidden="true">·</span>
    </span>
  );
}

export function PriceTicker({ records }: { records?: PriceRecord[] }) {
  const reduced = useReducedMotion();
  const tickerList = records && records.length > 0 ? mapRecordsToTicker(records) : DEFAULT_TICKERS;

  // Lặp đôi danh sách để tạo cuộn ngang mượt mà liên tục
  const allItems = [...tickerList, ...tickerList];

  return (
    <div
      className="price-ticker"
      role="marquee"
      aria-label="Giá hàng hóa thời gian thực"
      aria-live="off"
    >
      <div className={`ticker-track ${reduced ? 'ticker-track--paused' : ''}`}>
        {allItems.map((item, i) => (
          <TickerItemBadge key={`${item.symbol}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
