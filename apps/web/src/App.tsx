// src/App.tsx – Dashboard chính VàngDầu Live kết nối TanStack Query & API thật

import { useState, useMemo } from 'react';
import { AppHeader } from './components/dashboard/AppHeader';
import { KpiCard } from './components/dashboard/KpiCard';
import { PriceLineChart } from './components/dashboard/PriceLineChart';
import { NewsSection } from './components/dashboard/NewsSection';
import { QuoteTable } from './components/dashboard/QuoteTable';
import { AppFooter } from './components/dashboard/AppFooter';
import { AnimatedBackground } from './components/dashboard/AnimatedBackground';
import { SkeletonKpiCard } from './components/dashboard/SkeletonCard';
import { ErrorRetry } from './components/dashboard/ErrorRetry';

import { useMarketPrices, useMarketNews, useSystemHealth } from './hooks/useMarketData';
import type { PriceRecord } from './types';
import type { KpiItem } from './data/mockDashboard';

// Hàm trích xuất các KPI chính từ danh sách giá thật
function buildKpiList(records: PriceRecord[]): KpiItem[] {
  if (!records || records.length === 0) return [];

  const findRecord = (sym: string) => records.find((r) => r.symbol === sym);

  const sjc = findRecord('SJC-01') ?? findRecord('SJC-05');
  const fuel = findRecord('RON92_E5') ?? findRecord('DO0005');
  const usd = findRecord('USD_VND');
  const brent = findRecord('BRENT') ?? findRecord('WTI');
  const goldWorld = findRecord('XAU_USD');

  const kpis: KpiItem[] = [];

  if (sjc) {
    const p = sjc.ask ?? sjc.bid ?? 0;
    kpis.push({
      id: 'kpi-sjc',
      label: sjc.name,
      symbol: 'SJC',
      price: p,
      unit: sjc.unit,
      changePct: sjc.change_pct ?? 0,
      sparkline: [p * 0.992, p * 0.994, p * 0.998, p * 0.995, p * 0.999, p * 1.001, p],
      colorVar: '#F5A623',
    });
  }

  if (fuel) {
    const p = fuel.ask ?? fuel.bid ?? 0;
    kpis.push({
      id: 'kpi-fuel',
      label: fuel.name,
      symbol: fuel.symbol === 'RON92_E5' ? 'E5 RON92' : fuel.symbol,
      price: p,
      unit: fuel.unit,
      changePct: fuel.change_pct ?? 0,
      sparkline: [p, p, p * 0.998, p, p, p * 1.001, p],
      colorVar: '#60a5fa',
    });
  }

  if (usd) {
    const p = usd.ask ?? usd.bid ?? 0;
    kpis.push({
      id: 'kpi-usd',
      label: 'Đô la Mỹ USD/VND',
      symbol: 'USD/VND',
      price: p,
      unit: 'VND',
      changePct: usd.change_pct ?? 0,
      sparkline: [p * 0.999, p * 0.998, p * 0.999, p * 1.001, p * 1.0, p * 1.002, p],
      colorVar: '#a78bfa',
    });
  }

  if (brent) {
    const p = brent.ask ?? brent.bid ?? 0;
    kpis.push({
      id: 'kpi-brent',
      label: brent.name,
      symbol: 'BRENT',
      price: p,
      unit: brent.unit,
      changePct: brent.change_pct ?? 0,
      sparkline: [p * 0.985, p * 0.99, p * 0.995, p * 1.01, p * 1.005, p * 1.002, p],
      colorVar: '#2dd4bf',
    });
  }

  if (goldWorld) {
    const p = goldWorld.ask ?? goldWorld.bid ?? 0;
    kpis.push({
      id: 'kpi-gold-world',
      label: 'Vàng thế giới (XAU/USD)',
      symbol: 'XAU/USD',
      price: p,
      unit: goldWorld.unit,
      changePct: goldWorld.change_pct ?? 0,
      sparkline: [p * 0.994, p * 0.996, p * 0.998, p * 1.002, p * 1.001, p * 1.003, p],
      colorVar: '#FFC84A',
    });
  }

  return kpis;
}

function App() {
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Lấy dữ liệu giá
  const {
    data: priceRecords = [],
    isLoading: pricesLoading,
    isError: pricesError,
    error: pricesErrObj,
    refetch: refetchPrices,
  } = useMarketPrices();

  // 2. Lấy dữ liệu tin tức
  const {
    data: newsRecords = [],
    isLoading: newsLoading,
    isError: newsError,
    error: newsErrObj,
    refetch: refetchNews,
  } = useMarketNews(undefined, 20);

  // 3. Lấy thông tin sức khỏe và thời gian cập nhật
  const { data: healthData } = useSystemHealth();

  // Thời điểm cập nhật lấy từ health hoặc từ bản ghi giá mới nhất
  const updatedAt = healthData?.updatedAt ?? priceRecords[0]?.fetched_at ?? null;

  // Build KPIs
  const kpiItems = useMemo(() => buildKpiList(priceRecords), [priceRecords]);

  return (
    <div className="page-shell">
      {/* Nền gradient và hạt chuyển động nhẹ */}
      <AnimatedBackground />

      {/* Header với thời điểm cập nhật từ /api/health và cảnh báo > 36h */}
      <AppHeader
        updatedAt={updatedAt}
        records={priceRecords}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />

      <main className="page-main" id="overview">
        {/* ── KPI Grid ─────────────────────────────────── */}
        <section className="kpi-grid" aria-label="Các chỉ số giá chính">
          {pricesLoading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonKpiCard key={i} />)
          ) : pricesError ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <ErrorRetry
                title="Không thể tải chỉ số thị trường"
                message={pricesErrObj instanceof Error ? pricesErrObj.message : 'Lỗi kết nối máy chủ'}
                onRetry={() => refetchPrices()}
              />
            </div>
          ) : (
            kpiItems.map((kpi, i) => <KpiCard key={kpi.id} item={kpi} index={i} />)
          )}
        </section>

        {/* ── Chart + News side-by-side ─────────────────── */}
        <div className="chart-news-row">
          <div className="chart-col" id="chart">
            <PriceLineChart />
          </div>

          <div className="news-col" id="news">
            <NewsSection
              items={newsRecords}
              isLoading={newsLoading}
              error={newsError ? (newsErrObj instanceof Error ? newsErrObj.message : 'Lỗi tải tin tức') : null}
              onRetry={() => refetchNews()}
            />
          </div>
        </div>

        {/* ── Bảng niêm yết thời gian thực ───────────────── */}
        <div id="forex">
          <QuoteTable
            records={priceRecords}
            isLoading={pricesLoading}
            error={pricesError ? (pricesErrObj instanceof Error ? pricesErrObj.message : 'Lỗi tải bảng giá') : null}
            onRetry={() => refetchPrices()}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </div>
      </main>

      {/* Chân trang nguồn dữ liệu */}
      <AppFooter />
    </div>
  );
}

export default App;
