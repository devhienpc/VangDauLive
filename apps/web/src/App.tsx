import { useState, useMemo, useEffect } from 'react';
import { AppHeader } from './components/dashboard/AppHeader';
import { KpiCard } from './components/dashboard/KpiCard';
import { PriceChart } from './components/dashboard/PriceChart';
import { NewsSection } from './components/dashboard/NewsSection';
import { QuoteTable } from './components/dashboard/QuoteTable';
import { AppFooter } from './components/dashboard/AppFooter';
import { AnimatedBackground } from './components/dashboard/AnimatedBackground';
import { SkeletonKpiCard } from './components/dashboard/SkeletonCard';
import { ErrorBoundary } from './components/dashboard/ErrorBoundary';
import { AdminFuelPage } from './pages/AdminFuelPage';
import { ForecastAccuracyPage } from './pages/ForecastAccuracyPage';
import { FuelForecastSection } from './components/forecast/FuelForecastSection';

import { useMarketPrices, useMarketNews, useSystemHealth } from './hooks/useMarketData';
import type { PriceRecord } from './types';
import { MOCK_KPIS, type KpiItem } from './data/mockDashboard';

// Hàm trích xuất các KPI chính từ danh sách giá thật
function buildKpiList(records: PriceRecord[]): KpiItem[] {
  if (!records || records.length === 0) return MOCK_KPIS;

  const findRecord = (sym: string) => records.find((r) => r.symbol === sym);

  const sjc = findRecord('SJC-01') ?? findRecord('SJC-05');
  // Ưu tiên xăng E10 RON 95 (loại phổ biến nhất tại Việt Nam)
  const fuel = findRecord('RON95_III') ?? findRecord('RON95_V') ?? findRecord('RON92_E5') ?? findRecord('DO0005');
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
    const isStale = fuel.stale === 1 || fuel.stale === true;
    const displayName = fuel.symbol === 'RON95_III'
      ? 'Xăng E10 RON 95-III'
      : fuel.symbol === 'RON95_V'
      ? 'Xăng E10 RON 95-V'
      : fuel.name;
    const displaySymbol = fuel.symbol.startsWith('RON95')
      ? 'E10 RON 95'
      : fuel.symbol === 'RON92_E5'
      ? 'E5 RON 92'
      : fuel.symbol;

    kpis.push({
      id: 'kpi-fuel',
      label: displayName,
      symbol: displaySymbol,
      price: p,
      unit: fuel.unit,
      changePct: fuel.change_pct ?? 0,
      sparkline: [p, p, p * 0.998, p, p, p * 1.001, p],
      colorVar: '#60a5fa',
      effectiveAt: fuel.effective_at ?? undefined,
      isStale,
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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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

  const [isAdminPage, setIsAdminPage] = useState(() => {
    return window.location.pathname.startsWith('/admin') || window.location.hash === '#admin';
  });

  const [isAccuracyPage, setIsAccuracyPage] = useState(() => {
    return (
      window.location.pathname.startsWith('/nhan-dinh/do-chinh-xac') ||
      window.location.hash === '#nhan-dinh/do-chinh-xac' ||
      window.location.hash === '#accuracy'
    );
  });

  // Phím tắt bí mật để mở trang quản trị: Ctrl + Shift + A
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        window.history.pushState({}, '', '/admin');
        setIsAdminPage(true);
        setIsAccuracyPage(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleLocation = () => {
      setIsAdminPage(window.location.pathname.startsWith('/admin') || window.location.hash === '#admin');
      setIsAccuracyPage(
        window.location.pathname.startsWith('/nhan-dinh/do-chinh-xac') ||
        window.location.hash === '#nhan-dinh/do-chinh-xac' ||
        window.location.hash === '#accuracy'
      );
    };
    window.addEventListener('popstate', handleLocation);
    window.addEventListener('hashchange', handleLocation);

    // Bắt sự kiện click link admin / độ chính xác / trang chủ
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (target && target.getAttribute('href') === '/admin') {
        e.preventDefault();
        window.history.pushState({}, '', '/admin');
        setIsAdminPage(true);
        setIsAccuracyPage(false);
      } else if (
        target &&
        (target.getAttribute('href') === '/nhan-dinh/do-chinh-xac' ||
          target.getAttribute('href')?.startsWith('/nhan-dinh/do-chinh-xac'))
      ) {
        e.preventDefault();
        window.history.pushState({}, '', '/nhan-dinh/do-chinh-xac');
        setIsAccuracyPage(true);
        setIsAdminPage(false);
      } else if (target && target.getAttribute('href') === '/') {
        if (isAdminPage || isAccuracyPage) {
          e.preventDefault();
          refetchPrices();
          window.history.pushState({}, '', '/');
          setIsAdminPage(false);
          setIsAccuracyPage(false);
        }
      }
    };
    document.addEventListener('click', handleAnchorClick);

    return () => {
      window.removeEventListener('popstate', handleLocation);
      window.removeEventListener('hashchange', handleLocation);
      document.removeEventListener('click', handleAnchorClick);
    };
  }, [isAdminPage, isAccuracyPage, refetchPrices]);

  if (isAccuracyPage) {
    return (
      <div className="page-shell">
        <AnimatedBackground />
        <AppHeader
          updatedAt={updatedAt}
          records={priceRecords}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onRefresh={refetchPrices}
        />
        <main className="page-main">
          <ForecastAccuracyPage
            onBack={() => {
              refetchPrices();
              window.history.pushState({}, '', '/');
              setIsAccuracyPage(false);
            }}
          />
        </main>
        <AppFooter />
      </div>
    );
  }


  if (isAdminPage) {
    return (
      <div className="page-shell">
        <AnimatedBackground />
        <AppHeader
          updatedAt={updatedAt}
          records={priceRecords}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onRefresh={refetchPrices}
        />
        <main className="page-main">
          <AdminFuelPage
            onBack={() => {
              refetchPrices();
              window.history.pushState({}, '', '/');
              setIsAdminPage(false);
            }}
          />
        </main>
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="page-shell">
      {/* Nền gradient và hạt chuyển động nhẹ */}
      <AnimatedBackground />

      {/* Header với thời điểm cập nhật từ /api/health */}
      <AppHeader
        updatedAt={updatedAt}
        records={priceRecords}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onRefresh={refetchPrices}
      />

      <main className="page-main" id="overview">
        {/* ── KPI Grid ─────────────────────────────────── */}
        <section className="kpi-grid" aria-label="Các chỉ số giá chính">
          {pricesLoading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonKpiCard key={i} />)
          ) : (
            (kpiItems.length > 0 ? kpiItems : MOCK_KPIS).map((kpi, i) => (
              <KpiCard key={kpi.id} item={kpi} index={i} />
            ))
          )}
        </section>

        {/* ── Chart + News side-by-side (Trọng tâm giao diện) ── */}
        <div className="chart-news-row">
          <div className="chart-col" id="chart">
            <ErrorBoundary fallbackTitle="Không thể tải biểu đồ lịch sử">
              <PriceChart />
            </ErrorBoundary>
          </div>

          <div className="news-col" id="news">
            <ErrorBoundary fallbackTitle="Không thể tải tin tức thị trường">
              <NewsSection
                items={newsRecords}
                isLoading={newsLoading}
                error={newsError ? (newsErrObj instanceof Error ? newsErrObj.message : 'Lỗi tải tin tức') : null}
                onRetry={() => refetchNews()}
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* ── Bảng niêm yết thời gian thực ───────────────── */}
        <div id="quote-table-wrap">
          <ErrorBoundary fallbackTitle="Không thể tải bảng niêm yết">
            <QuoteTable
              records={priceRecords}
              isLoading={pricesLoading}
              error={pricesError ? (pricesErrObj instanceof Error ? pricesErrObj.message : 'Lỗi tải bảng giá') : null}
              onRetry={() => refetchPrices()}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </ErrorBoundary>
        </div>

        {/* ── Khối Nhận định giá xăng kỳ điều hành tới (đặt phía dưới) ── */}
        <FuelForecastSection
          onNavigateAccuracy={() => {
            window.history.pushState({}, '', '/nhan-dinh/do-chinh-xac');
            setIsAccuracyPage(true);
          }}
        />
      </main>

      {/* Chân trang nguồn dữ liệu */}
      <AppFooter />
    </div>
  );
}

export default App;
