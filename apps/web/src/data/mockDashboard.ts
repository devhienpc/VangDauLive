// src/data/mockDashboard.ts
// Tất cả dữ liệu giả dùng cho Dashboard – không được dùng trong production

export interface KpiItem {
  id: string;
  label: string;
  symbol: string;
  price: number;
  unit: string;
  changePct: number;       // % thay đổi so với ngày trước
  sparkline: number[];     // 10 điểm mini sparkline
  colorVar: string;        // CSS var token
}

export interface ChartPoint {
  date: string;            // "dd/MM"
  gold: number;            // USD/oz
  oil: number;             // USD/barrel
}

export interface NewsItem {
  id: string;
  category: 'gold' | 'oil' | 'forex' | 'fuel' | 'silver' | 'Năng lượng' | 'Vàng & Kim loại' | 'Vĩ mô / Fed' | 'Ngoại tệ' | string;
  categoryLabel: string;
  categoryColor: string;
  title: string;
  summary: string;
  source: string;
  url?: string;
  publishedAt: string;     // relative label: "2 giờ trước", "hôm qua", ...
}


export interface QuoteRow {
  symbol: string;
  name: string;
  category: string;
  bid: number | null;
  ask: number | null;
  unit: string;
  changePct: number;       // % số thực, + hoặc -
  status: 'Tăng' | 'Giảm' | 'Ổn định';
}

// ─── KPI Data ────────────────────────────────────────────────────────────────
export const MOCK_KPIS: KpiItem[] = [
  {
    id: 'kpi-sjc',
    label: 'Vàng SJC',
    symbol: 'SJC',
    price: 92_300_000,
    unit: 'VND/lượng',
    changePct: +0.84,
    sparkline: [90.1, 90.5, 91.2, 90.8, 91.4, 91.9, 91.6, 92.0, 92.1, 92.3],
    colorVar: '#F5A623',
  },
  {
    id: 'kpi-e5',
    label: 'Xăng E5 RON92',
    symbol: 'RON92_E5',
    price: 20_900,
    unit: 'VND/lít',
    changePct: 0,
    sparkline: [20.9, 20.9, 21.0, 20.9, 20.9, 20.9, 20.9, 20.9, 20.9, 20.9],
    colorVar: '#60a5fa',
  },
  {
    id: 'kpi-do',
    label: 'Dầu DO 0.05S',
    symbol: 'DO0005',
    price: 19_640,
    unit: 'VND/lít',
    changePct: -0.30,
    sparkline: [19.8, 19.75, 19.72, 19.7, 19.68, 19.66, 19.65, 19.64, 19.64, 19.64],
    colorVar: '#2dd4bf',
  },
  {
    id: 'kpi-silver',
    label: 'Bạc thế giới',
    symbol: 'XAG_USD',
    price: 31.4,
    unit: 'USD/oz',
    changePct: +1.29,
    sparkline: [30.8, 30.9, 31.0, 31.1, 31.15, 31.2, 31.25, 31.3, 31.35, 31.4],
    colorVar: '#94a3b8',
  },
  {
    id: 'kpi-usd',
    label: 'Tỷ giá USD/VND',
    symbol: 'USD_VND',
    price: 25_180,
    unit: 'VND',
    changePct: +0.12,
    sparkline: [25.05, 25.08, 25.10, 25.12, 25.13, 25.14, 25.15, 25.16, 25.17, 25.18],
    colorVar: '#a78bfa',
  },
];

// ─── Dual-axis Chart Data ────────────────────────────────────────────────────
function buildChartData(days: number): ChartPoint[] {
  const result: ChartPoint[] = [];
  const now = new Date(2026, 9, 12); // Oct 12 2026
  let gold = 2580;
  let oil = 78;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    gold += (Math.random() - 0.48) * 12;
    oil  += (Math.random() - 0.50) * 0.8;
    result.push({
      date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      gold: Math.round(gold * 10) / 10,
      oil:  Math.round(oil  * 10) / 10,
    });
  }
  return result;
}

export const MOCK_CHART_30D  = buildChartData(30);
export const MOCK_CHART_90D  = buildChartData(90);
export const MOCK_CHART_365D = buildChartData(365);

// ─── News ─────────────────────────────────────────────────────────────────────
export const MOCK_NEWS: NewsItem[] = [
  {
    id: 'n1',
    category: 'gold',
    categoryLabel: 'Vàng & Kim loại',
    categoryColor: '#F5A623',
    title: 'Vàng thế giới vượt 2.650 USD/oz, cao nhất trong 2 tháng',
    summary:
      'Căng thẳng địa chính trị leo thang tại Trung Đông và đồng đô la suy yếu đẩy vàng tăng mạnh trong phiên giao dịch New York, thu hút dòng vốn trú ẩn an toàn.',
    source: 'VnExpress',
    url: 'https://vnexpress.net/kinh-doanh',
    publishedAt: '1 giờ trước',
  },
  {
    id: 'n2',
    category: 'oil',
    categoryLabel: 'Năng lượng',
    categoryColor: '#2dd4bf',
    title: 'Dầu Brent giảm nhẹ sau quyết định duy trì sản lượng của OPEC+',
    summary:
      'Liên minh OPEC+ họp khẩn quyết định giữ nguyên mức cắt giảm tự nguyện 2,2 triệu thùng/ngày đến cuối năm, đẩy giá dầu điều chỉnh nhẹ về 77,5 USD/thùng.',
    source: 'VietnamBiz',
    url: 'https://vietnambiz.vn/hang-hoa',
    publishedAt: '4 giờ trước',
  },
  {
    id: 'n3',
    category: 'forex',
    categoryLabel: 'Ngoại tệ',
    categoryColor: '#a78bfa',
    title: 'Tỷ giá USD/VND ổn định quanh 25.180 sau báo cáo lạm phát Mỹ',
    summary:
      'Chỉ số CPI tháng 9 của Mỹ tăng 2,4% so với cùng kỳ, thấp hơn dự báo, giảm áp lực tăng lãi suất và tạm ổn định tỷ giá USD đồng thời củng cố tiền đồng.',
    source: 'CafeF',
    url: 'https://cafef.vn/tai-chinh-quoc-te',
    publishedAt: 'hôm qua',
  },
];

// ─── Quick-quote Table ─────────────────────────────────────────────────────────
export const MOCK_QUOTES: QuoteRow[] = [
  { symbol: 'SJC',      name: 'Vàng SJC (lượng)',        category: 'gold',   bid: 91_800_000, ask: 92_300_000, unit: 'VND/lượng',  changePct: +0.84,  status: 'Tăng' },
  { symbol: 'XAU_USD',  name: 'Vàng thế giới',            category: 'gold',   bid: 2_638,      ask: 2_651,      unit: 'USD/oz',      changePct: +0.61,  status: 'Tăng' },
  { symbol: 'XAG_USD',  name: 'Bạc thế giới',             category: 'silver', bid: 31.2,       ask: 31.4,       unit: 'USD/oz',      changePct: +1.29,  status: 'Tăng' },
  { symbol: 'RON95_III',name: 'Xăng RON 95-III',          category: 'fuel',   bid: null,       ask: 21_610,     unit: 'VND/lít',     changePct: 0,      status: 'Ổn định' },
  { symbol: 'RON92_E5', name: 'Xăng E5 RON 92',           category: 'fuel',   bid: null,       ask: 20_900,     unit: 'VND/lít',     changePct: 0,      status: 'Ổn định' },
  { symbol: 'DO0005',   name: 'Dầu DO 0.05S',             category: 'fuel',   bid: null,       ask: 19_640,     unit: 'VND/lít',     changePct: -0.30,  status: 'Giảm' },
  { symbol: 'BRENT',    name: 'Dầu Brent (USD/thùng)',     category: 'oil',    bid: null,       ask: 77.5,       unit: 'USD/thùng',   changePct: -0.51,  status: 'Giảm' },
  { symbol: 'USD_VND',  name: 'Đô la Mỹ',                 category: 'forex',  bid: 25_030,     ask: 25_180,     unit: 'VND/USD',     changePct: +0.12,  status: 'Tăng' },
  { symbol: 'EUR_VND',  name: 'Euro',                     category: 'forex',  bid: 27_580,     ask: 27_820,     unit: 'VND/EUR',     changePct: -0.08,  status: 'Giảm' },
  { symbol: 'JPY_VND',  name: 'Yên Nhật',                 category: 'forex',  bid: 163,        ask: 168,        unit: 'VND/JPY',     changePct: +0.30,  status: 'Tăng' },
  { symbol: 'GBP_VND',  name: 'Bảng Anh',                 category: 'forex',  bid: 32_300,     ask: 32_600,     unit: 'VND/GBP',     changePct: +0.46,  status: 'Tăng' },
  { symbol: 'CNY_VND',  name: 'Nhân dân tệ',              category: 'forex',  bid: 3_450,      ask: 3_500,      unit: 'VND/CNY',     changePct: -0.14,  status: 'Giảm' },
];

// ─── Updated timestamp ─────────────────────────────────────────────────────────
export const MOCK_UPDATED_AT = new Date(2026, 9, 12, 10, 0, 0); // 10:00 sáng Oct 12 2026
