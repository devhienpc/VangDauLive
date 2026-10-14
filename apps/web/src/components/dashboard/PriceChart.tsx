// src/components/dashboard/PriceChart.tsx
// Biểu đồ phong cách sàn giao dịch sử dụng TradingView Lightweight Charts (v5)
// Hỗ trợ Nến / Đường / Vùng / Bậc thang, Khung thời gian, Chỉ báo MA/EMA/Bollinger/RSI, So sánh mã

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  createChart,
  ColorType,
  LineType,
  PriceScaleMode,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
} from 'lightweight-charts';
import { useCandles } from '../../hooks/useMarketData';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { SkeletonChart } from './SkeletonCard';
import { ErrorRetry } from './ErrorRetry';
import {
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  calculateRSI,
  normalizeToPercentageChange,
  type CandlePoint,
} from '../../utils/indicators';
import { fetchCandles } from '../../api/client';

export type ChartType = 'candle' | 'line' | 'area' | 'stepline';
export type TimeRange = '1w' | '1m' | '3m' | '6m' | '1y' | 'all';

export interface SymbolOption {
  symbol: string;
  name: string;
  category: 'gold' | 'fuel' | 'forex';
  unit: string;
}

export const AVAILABLE_SYMBOLS: SymbolOption[] = [
  // Vàng & Kim loại
  { symbol: 'XAU_USD',   name: 'Vàng thế giới (XAU/USD)', category: 'gold',  unit: 'USD/oz' },
  { symbol: 'XAG_USD',   name: 'Bạc thế giới (XAG/USD)', category: 'gold',  unit: 'USD/oz' },
  { symbol: 'SJC-01',    name: 'Vàng SJC 1 lượng (TP.HCM)',category: 'gold', unit: 'VND/lượng' },
  { symbol: 'SJC-05',    name: 'Vàng SJC 5 chỉ',          category: 'gold',  unit: 'VND/lượng' },

  // Năng lượng & Dầu khí
  { symbol: 'BRENT',     name: 'Dầu Brent (Futures)',      category: 'fuel',  unit: 'USD/thùng' },
  { symbol: 'WTI',       name: 'Dầu WTI (Futures)',        category: 'fuel',  unit: 'USD/thùng' },
  { symbol: 'RON95_V',   name: 'Xăng E10 RON 95-V (Vùng 1)', category: 'fuel',  unit: 'VND/lít' },
  { symbol: 'RON95_III', name: 'Xăng RON 95-III (Vùng 1)',category: 'fuel',  unit: 'VND/lít' },
  { symbol: 'RON92_E5',  name: 'Xăng E5 RON 92-II (Vùng 1)',category: 'fuel', unit: 'VND/lít' },
  { symbol: 'DO0005',    name: 'Dầu Diesel 0.05S-II',     category: 'fuel',  unit: 'VND/lít' },
  { symbol: 'DO001',     name: 'Dầu Diesel 0.001S-V',     category: 'fuel',  unit: 'VND/lít' },

  // Ngoại tệ
  { symbol: 'USD_VND',   name: 'Đô la Mỹ (USD/VND)',       category: 'forex', unit: 'VND' },
  { symbol: 'EUR_VND',   name: 'Euro (EUR/VND)',          category: 'forex', unit: 'VND' },
  { symbol: 'GBP_VND',   name: 'Bảng Anh (GBP/VND)',       category: 'forex', unit: 'VND' },
  { symbol: 'JPY_VND',   name: 'Yên Nhật (JPY/VND)',       category: 'forex', unit: 'VND' },
  { symbol: 'CNY_VND',   name: 'Nhân dân tệ (CNY/VND)',    category: 'forex', unit: 'VND' },
];

const RANGE_LABELS: Record<TimeRange, string> = {
  '1w':  '1T',
  '1m':  '1Th',
  '3m':  '3Th',
  '6m':  '6Th',
  '1y':  '1N',
  'all': 'Tất cả',
};

const COMPARE_COLORS = ['#38bdf8', '#c084fc', '#f43f5e'];

// LocalStorage Keys
const STORAGE_PREFIX = 'vangdau_chart_';
const getStored = <T,>(key: string, fallback: T): T => {
  try {
    const val = localStorage.getItem(STORAGE_PREFIX + key);
    return val ? (JSON.parse(val) as T) : fallback;
  } catch {
    return fallback;
  }
};
const setStored = <T,>(key: string, val: T): void => {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
  } catch {
    // Ignore storage quota errors
  }
};

export function PriceChart() {
  // ── 1. States (có đồng bộ localStorage) ───────────────────────────────────
  const [symbol, setSymbol] = useState<string>(() => getStored('symbol', 'XAU_USD'));
  const [range, setRange] = useState<TimeRange>(() => getStored('range', '1y'));
  const [chartType, setChartType] = useState<ChartType>(() => getStored('chartType', 'candle'));
  const [isLogScale, setIsLogScale] = useState<boolean>(() => getStored('logScale', false));
  const [isPercentScale, setIsPercentScale] = useState<boolean>(() => getStored('percentScale', false));
  const [activeIndicators, setActiveIndicators] = useState<Record<string, boolean>>(() =>
    getStored('indicators', {
      ma20: false,
      ma50: false,
      ema20: false,
      bb: false,
      rsi: false,
    }),
  );
  const [compareSymbols, setCompareSymbols] = useState<string[]>(() => getStored('compare', []));
  const [compareDataMap, setCompareDataMap] = useState<Record<string, CandlePoint[]>>({});
  const [showIndicatorsMenu, setShowIndicatorsMenu] = useState(false);
  const [showCompareMenu, setShowCompareMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [priceFlash, setPriceFlash] = useState(false);

  // Crosshair Hover State
  const [hoveredData, setHoveredData] = useState<{
    time?: string;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    changePct?: number;
  } | null>(null);

  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);

  const chartApiRef = useRef<IChartApi | null>(null);
  const rsiChartApiRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const indSeriesRef = useRef<Record<string, ISeriesApi<SeriesType>>>({});
  const compareSeriesRef = useRef<Record<string, ISeriesApi<SeriesType>>>({});

  // ── 2. Data Fetching ──────────────────────────────────────────────────────
  const { data: candleResp, isLoading, isError, error, refetch } = useCandles(symbol, range);

  const candles: CandlePoint[] = useMemo(() => {
    return candleResp?.candles || [];
  }, [candleResp]);

  const hasOHLC = candleResp?.hasOHLC ?? false;
  const currentSource = candleResp?.source ?? 'Hệ thống';

  // Sử dụng lựa chọn chartType trực tiếp từ người dùng
  const effectiveChartType: ChartType = useMemo(() => {
    return chartType;
  }, [chartType]);

  const currentOption = useMemo(
    () => AVAILABLE_SYMBOLS.find((s) => s.symbol === symbol) ?? AVAILABLE_SYMBOLS[0],
    [symbol],
  );

  // Save to localStorage khi thay đổi
  useEffect(() => { setStored('symbol', symbol); }, [symbol]);
  useEffect(() => { setStored('range', range); }, [range]);
  useEffect(() => { setStored('chartType', chartType); }, [chartType]);
  useEffect(() => { setStored('logScale', isLogScale); }, [isLogScale]);
  useEffect(() => { setStored('percentScale', isPercentScale); }, [isPercentScale]);
  useEffect(() => { setStored('indicators', activeIndicators); }, [activeIndicators]);
  useEffect(() => { setStored('compare', compareSymbols); }, [compareSymbols]);

  // Price pulse animation khi có nến mới
  useEffect(() => {
    if (candles.length > 0 && !reducedMotion) {
      setPriceFlash(true);
      const t = setTimeout(() => setPriceFlash(false), 900);
      return () => clearTimeout(t);
    }
  }, [candles, reducedMotion]);

  // Fetch thêm dữ liệu cho các mã trong chế độ so sánh
  useEffect(() => {
    let isCancelled = false;
    async function loadCompares() {
      if (compareSymbols.length === 0) {
        setCompareDataMap({});
        return;
      }
      const newMap: Record<string, CandlePoint[]> = {};
      for (const compSym of compareSymbols) {
        try {
          const res = await fetchCandles(compSym, range);
          if (res.data?.candles) {
            newMap[compSym] = res.data.candles;
          }
        } catch {
          // ignore error for compare
        }
      }
      if (!isCancelled) {
        setCompareDataMap(newMap);
      }
    }
    loadCompares();
    return () => { isCancelled = true; };
  }, [compareSymbols, range]);

  // ── 3. Khởi tạo & cập nhật TradingView Lightweight Chart ──────────────────
  const initChart = useCallback(() => {
    if (!containerRef.current) return;

    // Hủy biểu đồ cũ nếu đã tồn tại
    if (chartApiRef.current) {
      chartApiRef.current.remove();
      chartApiRef.current = null;
    }
    if (rsiChartApiRef.current) {
      rsiChartApiRef.current.remove();
      rsiChartApiRef.current = null;
    }
    indSeriesRef.current = {};
    compareSeriesRef.current = {};

    const container = containerRef.current;
    const width = container.clientWidth || 340;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const height = isFullscreen
      ? Math.max(360, window.innerHeight - 90)
      : isMobile
        ? 340
        : Math.max(380, container.clientHeight || 420);

    // ── Biểu đồ chính ──
    const chart = createChart(container, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0b1628' },
        textColor: '#94a3b8',
        fontSize: 12,
        fontFamily: "'Roboto Mono', 'Be Vietnam Pro', -apple-system, sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        vertLine: {
          color: 'rgba(245, 166, 35, 0.4)',
          width: 1,
          style: 3, // Dotted
          labelBackgroundColor: '#142244',
        },
        horzLine: {
          color: 'rgba(245, 166, 35, 0.4)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#142244',
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: false,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: { top: 0.1, bottom: 0.15 },
        mode: isPercentScale
          ? PriceScaleMode.Percentage
          : isLogScale
            ? PriceScaleMode.Logarithmic
            : PriceScaleMode.Normal,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    chartApiRef.current = chart;

    // ── Thêm Series chính tùy theo effectiveChartType ──
    let mainSeries: ISeriesApi<SeriesType>;

    if (effectiveChartType === 'candle') {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
        priceLineVisible: true,
        priceLineWidth: 1,
        priceLineColor: '#F5A623',
      });
      mainSeries.setData(
        candles.map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
    } else if (effectiveChartType === 'area') {
      mainSeries = chart.addSeries(AreaSeries, {
        topColor: 'rgba(245, 166, 35, 0.35)',
        bottomColor: 'rgba(245, 166, 35, 0.02)',
        lineColor: '#F5A623',
        lineWidth: 2,
        priceLineVisible: true,
        priceLineColor: '#F5A623',
      });
      mainSeries.setData(candles.map((c) => ({ time: c.time, value: c.close })));
    } else if (effectiveChartType === 'stepline') {
      mainSeries = chart.addSeries(LineSeries, {
        color: '#60a5fa',
        lineWidth: 2,
        lineType: LineType.WithSteps,
        priceLineVisible: true,
        priceLineColor: '#60a5fa',
      });
      mainSeries.setData(candles.map((c) => ({ time: c.time, value: c.close })));
    } else {
      // Default: Line
      mainSeries = chart.addSeries(LineSeries, {
        color: '#F5A623',
        lineWidth: 2,
        priceLineVisible: true,
        priceLineColor: '#F5A623',
      });
      mainSeries.setData(candles.map((c) => ({ time: c.time, value: c.close })));
    }

    mainSeriesRef.current = mainSeries;

    // ── Chỉ báo kỹ thuật phía client ──
    if (candles.length > 0) {
      // MA 20
      if (activeIndicators.ma20) {
        const ma20Data = calculateSMA(candles, 20);
        if (ma20Data.length > 0) {
          const s = chart.addSeries(LineSeries, {
            color: '#38bdf8',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          s.setData(ma20Data);
          indSeriesRef.current.ma20 = s;
        }
      }

      // MA 50
      if (activeIndicators.ma50) {
        const ma50Data = calculateSMA(candles, 50);
        if (ma50Data.length > 0) {
          const s = chart.addSeries(LineSeries, {
            color: '#fbbf24',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          s.setData(ma50Data);
          indSeriesRef.current.ma50 = s;
        }
      }

      // EMA 20
      if (activeIndicators.ema20) {
        const emaData = calculateEMA(candles, 20);
        if (emaData.length > 0) {
          const s = chart.addSeries(LineSeries, {
            color: '#c084fc',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          s.setData(emaData);
          indSeriesRef.current.ema20 = s;
        }
      }

      // Bollinger Bands (20, 2)
      if (activeIndicators.bb) {
        const bbData = calculateBollingerBands(candles, 20, 2);
        if (bbData.middle.length > 0) {
          const sUpper = chart.addSeries(LineSeries, {
            color: 'rgba(45, 212, 191, 0.7)',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          sUpper.setData(bbData.upper);
          indSeriesRef.current.bbUpper = sUpper;

          const sMid = chart.addSeries(LineSeries, {
            color: 'rgba(45, 212, 191, 0.4)',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          sMid.setData(bbData.middle);
          indSeriesRef.current.bbMid = sMid;

          const sLower = chart.addSeries(LineSeries, {
            color: 'rgba(45, 212, 191, 0.7)',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          sLower.setData(bbData.lower);
          indSeriesRef.current.bbLower = sLower;
        }
      }
    }

    // ── Chế độ so sánh (Normalize % change) ──
    if (compareSymbols.length > 0 && Object.keys(compareDataMap).length > 0) {
      compareSymbols.forEach((compSym, idx) => {
        const compCandles = compareDataMap[compSym];
        if (compCandles && compCandles.length > 0) {
          const color = COMPARE_COLORS[idx % COMPARE_COLORS.length];
          const s = chart.addSeries(LineSeries, {
            color,
            lineWidth: 2,
            priceLineVisible: true,
            title: compSym,
          });
          // Nếu ở chế độ % scale thì chuẩn hóa % change từ điểm đầu
          if (isPercentScale) {
            s.setData(normalizeToPercentageChange(compCandles));
          } else {
            s.setData(compCandles.map((c) => ({ time: c.time, value: c.close })));
          }
          compareSeriesRef.current[compSym] = s;
        }
      });
    }

    // ── Lắng nghe Crosshair Move ──
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        setHoveredData(null);
        return;
      }
      const dataPoint = param.seriesData.get(mainSeries) as any;
      if (!dataPoint) {
        setHoveredData(null);
        return;
      }

      const timeStr = String(param.time);
      if ('open' in dataPoint && 'high' in dataPoint) {
        const o = dataPoint.open;
        const c = dataPoint.close;
        const pct = o > 0 ? Math.round(((c - o) / o) * 10000) / 100 : 0;
        setHoveredData({
          time: timeStr,
          open: dataPoint.open,
          high: dataPoint.high,
          low: dataPoint.low,
          close: dataPoint.close,
          changePct: pct,
        });
      } else if ('value' in dataPoint) {
        setHoveredData({
          time: timeStr,
          close: dataPoint.value,
        });
      }
    });

    chart.timeScale().fitContent();

    // ── Sub-panel: RSI(14) ──
    if (activeIndicators.rsi && rsiContainerRef.current && candles.length > 14) {
      const rsiContainer = rsiContainerRef.current;
      const rsiChart = createChart(rsiContainer, {
        width: rsiContainer.clientWidth || width,
        height: 120,
        layout: {
          background: { type: ColorType.Solid, color: '#070d19' },
          textColor: '#94a3b8',
          fontSize: 10,
          fontFamily: "'Roboto Mono', monospace",
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
        },
        timeScale: {
          visible: false,
        },
        rightPriceScale: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
      });

      rsiChartApiRef.current = rsiChart;

      const rsiSeries = rsiChart.addSeries(LineSeries, {
        color: '#f43f5e',
        lineWidth: 2,
        priceLineVisible: false,
      });

      const rsiData = calculateRSI(candles, 14);
      rsiSeries.setData(rsiData);

      // Thêm đường mốc 70 (quá mua) và 30 (quá bán)
      if (rsiData.length > 0) {
        const line70 = rsiChart.addSeries(LineSeries, {
          color: 'rgba(244, 63, 94, 0.3)',
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        line70.setData(rsiData.map((d) => ({ time: d.time, value: 70 })));

        const line30 = rsiChart.addSeries(LineSeries, {
          color: 'rgba(34, 197, 94, 0.3)',
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        line30.setData(rsiData.map((d) => ({ time: d.time, value: 30 })));
      }

      rsiChart.timeScale().fitContent();
    }
  }, [
    effectiveChartType,
    candles,
    hasOHLC,
    isLogScale,
    isPercentScale,
    activeIndicators,
    compareSymbols,
    compareDataMap,
  ]);

  // Khởi tạo biểu đồ khi dữ liệu hoặc cài đặt thay đổi
  useEffect(() => {
    if (!isLoading && candles.length > 0) {
      initChart();
    }
  }, [isLoading, candles, initChart]);

  // Xử lý Resize tự động theo container dùng ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0 && chartApiRef.current) {
          chartApiRef.current.applyOptions({ width: w });
          if (rsiContainerRef.current && rsiChartApiRef.current) {
            rsiChartApiRef.current.applyOptions({ width: w });
          }
        }
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [candles, isLoading]);

  // ── 4. Fullscreen & Screenshot Actions ───────────────────────────────────
  const toggleFullscreen = () => {
    if (!chartWrapperRef.current) return;
    if (!isFullscreen) {
      if (typeof chartWrapperRef.current.requestFullscreen === 'function') {
        chartWrapperRef.current.requestFullscreen().then(() => {
          setIsFullscreen(true);
        }).catch(() => {
          setIsFullscreen(true); // CSS fallback
        });
      } else {
        setIsFullscreen(true); // Fallback cho iOS Safari
      }
    } else {
      if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().then(() => {
          setIsFullscreen(false);
        }).catch(() => {
          setIsFullscreen(false);
        });
      } else {
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const downloadScreenshot = () => {
    if (!chartApiRef.current) return;
    try {
      const canvas = chartApiRef.current.takeScreenshot();
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `VangDau_${symbol}_${range}_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch (err) {
      console.warn('Lỗi tải ảnh:', err);
    }
  };

  // Nến mới nhất để hiển thị default khi không hover
  const latestCandle = candles[candles.length - 1];
  const displayData = hoveredData || (latestCandle ? {
    time: latestCandle.time,
    open: latestCandle.open,
    high: latestCandle.high,
    low: latestCandle.low,
    close: latestCandle.close,
    changePct: latestCandle.open > 0 ? Math.round(((latestCandle.close - latestCandle.open) / latestCandle.open) * 10000) / 100 : 0,
  } : null);

  const isUp = (displayData?.changePct ?? 0) >= 0;

  if (isLoading) {
    return <SkeletonChart />;
  }

  if (isError) {
    return (
      <section className="dash-card" style={{ padding: '24px' }}>
        <ErrorRetry
          title="Không thể tải biểu đồ sàn giao dịch"
          message={error instanceof Error ? error.message : 'Lỗi kết nối máy chủ'}
          onRetry={() => refetch()}
        />
      </section>
    );
  }

  return (
    <section
      ref={chartWrapperRef}
      className={`dash-card trade-chart-card ${isFullscreen ? 'trade-chart-card--fullscreen' : ''}`}
      id="chart"
      aria-label="Biểu đồ phân tích kỹ thuật sàn giao dịch"
    >
      {/* ── TOOLBAR TRÊN CÙNG ────────────────────────────────────────────── */}
      <div className="trade-toolbar">
        {/* Dropdown chọn mã giao dịch */}
        <div className="trade-symbol-selector">
          <label htmlFor="symbol-select" className="sr-only">Chọn mã hàng hóa</label>
          <select
            id="symbol-select"
            className="symbol-dropdown"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          >
            <optgroup label="Vàng & Bạc thế giới">
              {AVAILABLE_SYMBOLS.filter((s) => s.category === 'gold' && s.symbol.startsWith('X')).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Vàng SJC trong nước">
              {AVAILABLE_SYMBOLS.filter((s) => s.symbol.startsWith('SJC')).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Năng lượng & Xăng dầu">
              {AVAILABLE_SYMBOLS.filter((s) => s.category === 'fuel').map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Ngoại tệ">
              {AVAILABLE_SYMBOLS.filter((s) => s.category === 'forex').map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Nút chuyển Nến / Đường / Vùng / Bậc thang */}
        <div className="trade-type-group" role="group" aria-label="Kiểu biểu đồ">
          <button
            type="button"
            className={`pill-btn ${effectiveChartType === 'candle' ? 'pill-btn--active' : ''}`}
            onClick={() => setChartType('candle')}
            title="Biểu đồ Nến Nhật (Candlestick)"
          >
            Nến
          </button>
          <button
            type="button"
            className={`pill-btn ${effectiveChartType === 'line' ? 'pill-btn--active' : ''}`}
            onClick={() => setChartType('line')}
            title="Biểu đồ Đường (Line)"
          >
            Đường
          </button>
          <button
            type="button"
            className={`pill-btn ${effectiveChartType === 'area' ? 'pill-btn--active' : ''}`}
            onClick={() => setChartType('area')}
            title="Biểu đồ Vùng (Area)"
          >
            Vùng
          </button>
          {(symbol.includes('RON') || symbol.includes('DO')) && (
            <button
              type="button"
              className={`pill-btn ${effectiveChartType === 'stepline' ? 'pill-btn--active' : ''}`}
              onClick={() => setChartType('stepline')}
              title="Biểu đồ Bậc thang giá kỳ điều hành"
            >
              Bậc thang
            </button>
          )}
        </div>

        {/* Khung thời gian: 1T / 1Th / 3Th / 6Th / 1N / Tất cả */}
        <div className="trade-range-group" role="tablist" aria-label="Khung thời gian">
          {(['1w', '1m', '3m', '6m', '1y', 'all'] as TimeRange[]).map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              className={`pill-btn ${range === r ? 'pill-btn--active' : ''}`}
              onClick={() => setRange(r)}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        {/* Nút Menu Chỉ báo & So sánh */}
        <div className="trade-actions-group">
          {/* Menu Chỉ báo */}
          <div className="dropdown-container">
            <button
              type="button"
              className={`pill-btn ${Object.values(activeIndicators).some(Boolean) ? 'pill-btn--active' : ''}`}
              onClick={() => {
                setShowIndicatorsMenu(!showIndicatorsMenu);
                setShowCompareMenu(false);
              }}
              title="Cài đặt các chỉ báo kỹ thuật"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span>Chỉ báo</span>
            </button>

            {showIndicatorsMenu && (
              <div className="trade-dropdown-menu">
                <p className="dropdown-menu-title">Chỉ báo kỹ thuật (Client)</p>
                <label className="dropdown-item-check">
                  <input
                    type="checkbox"
                    checked={activeIndicators.ma20}
                    onChange={(e) =>
                      setActiveIndicators({ ...activeIndicators, ma20: e.target.checked })
                    }
                  />
                  <span>MA(20) – Trung bình 20 ngày</span>
                </label>
                <label className="dropdown-item-check">
                  <input
                    type="checkbox"
                    checked={activeIndicators.ma50}
                    onChange={(e) =>
                      setActiveIndicators({ ...activeIndicators, ma50: e.target.checked })
                    }
                  />
                  <span>MA(50) – Trung bình 50 ngày</span>
                </label>
                <label className="dropdown-item-check">
                  <input
                    type="checkbox"
                    checked={activeIndicators.ema20}
                    onChange={(e) =>
                      setActiveIndicators({ ...activeIndicators, ema20: e.target.checked })
                    }
                  />
                  <span>EMA(20) – Hàm mũ 20 ngày</span>
                </label>
                <label className="dropdown-item-check">
                  <input
                    type="checkbox"
                    checked={activeIndicators.bb}
                    onChange={(e) =>
                      setActiveIndicators({ ...activeIndicators, bb: e.target.checked })
                    }
                  />
                  <span>Bollinger Bands (20, 2)</span>
                </label>
                <label className="dropdown-item-check">
                  <input
                    type="checkbox"
                    checked={activeIndicators.rsi}
                    onChange={(e) =>
                      setActiveIndicators({ ...activeIndicators, rsi: e.target.checked })
                    }
                  />
                  <span>RSI(14) – Panel dưới</span>
                </label>
              </div>
            )}
          </div>

          {/* Menu So sánh */}
          <div className="dropdown-container">
            <button
              type="button"
              className={`pill-btn ${compareSymbols.length > 0 ? 'pill-btn--active' : ''}`}
              onClick={() => {
                setShowCompareMenu(!showCompareMenu);
                setShowIndicatorsMenu(false);
              }}
              title="So sánh với 1-3 mã khác"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>So sánh {compareSymbols.length > 0 ? `(${compareSymbols.length})` : ''}</span>
            </button>

            {showCompareMenu && (
              <div className="trade-dropdown-menu">
                <p className="dropdown-menu-title">Chọn thêm mã so sánh (%)</p>
                {AVAILABLE_SYMBOLS.filter((s) => s.symbol !== symbol).slice(0, 8).map((s) => {
                  const isChecked = compareSymbols.includes(s.symbol);
                  return (
                    <label key={s.symbol} className="dropdown-item-check">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!isChecked && compareSymbols.length >= 3}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCompareSymbols([...compareSymbols, s.symbol]);
                            setIsPercentScale(true); // Bật chế độ % scale khi so sánh
                          } else {
                            setCompareSymbols(compareSymbols.filter((item) => item !== s.symbol));
                          }
                        }}
                      />
                      <span>{s.symbol} – {s.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Nút Logarit */}
          <button
            type="button"
            className={`pill-btn ${isLogScale ? 'pill-btn--active' : ''}`}
            onClick={() => {
              const next = !isLogScale;
              setIsLogScale(next);
              if (chartApiRef.current) {
                chartApiRef.current.priceScale('right').applyOptions({
                  mode: next ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
                });
              }
            }}
            title="Bật/Tắt thang đo Logarit"
          >
            Log
          </button>

          {/* Nút % scale */}
          <button
            type="button"
            className={`pill-btn ${isPercentScale ? 'pill-btn--active' : ''}`}
            onClick={() => {
              const next = !isPercentScale;
              setIsPercentScale(next);
              if (chartApiRef.current) {
                chartApiRef.current.priceScale('right').applyOptions({
                  mode: next ? PriceScaleMode.Percentage : PriceScaleMode.Normal,
                });
              }
            }}
            title="Bật/Tắt thang đo phần trăm (%)"
          >
            %
          </button>

          {/* Nút Tải PNG */}
          <button
            type="button"
            className="pill-btn icon-only-btn"
            onClick={downloadScreenshot}
            title="Tải ảnh biểu đồ PNG"
            aria-label="Tải ảnh biểu đồ"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          {/* Nút Toàn màn hình */}
          <button
            type="button"
            className="pill-btn icon-only-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            aria-label="Chuyển chế độ toàn màn hình"
          >
            {isFullscreen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6m0 6v6h-6M9 21H3v-6M3 9V3h6" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── THÔNG TIN CROSSHAIR & LEGEND ─────────────────────────────────── */}
      <div className="trade-legend-bar">
        <div className="legend-symbol-info">
          <span className="legend-main-sym">{currentOption.name}</span>
          <span className="legend-unit">({currentOption.unit})</span>
          {priceFlash && <span className="legend-pulse-badge">Mới</span>}
        </div>

        {displayData && (
          <div className="legend-ohlc-values">
            {displayData.open != null && (
              <span className="ohlc-item">
                <span className="ohlc-label">O:</span>
                <span className="ohlc-val">{displayData.open.toLocaleString('vi-VN')}</span>
              </span>
            )}
            {displayData.high != null && (
              <span className="ohlc-item">
                <span className="ohlc-label">H:</span>
                <span className="ohlc-val text-up">{displayData.high.toLocaleString('vi-VN')}</span>
              </span>
            )}
            {displayData.low != null && (
              <span className="ohlc-item">
                <span className="ohlc-label">L:</span>
                <span className="ohlc-val text-down">{displayData.low.toLocaleString('vi-VN')}</span>
              </span>
            )}
            {displayData.close != null && (
              <span className="ohlc-item">
                <span className="ohlc-label">C:</span>
                <span className={`ohlc-val ${isUp ? 'text-up' : 'text-down'}`}>
                  {displayData.close.toLocaleString('vi-VN')}
                </span>
              </span>
            )}
            {displayData.changePct != null && (
              <span className={`ohlc-change ${isUp ? 'ohlc-change--up' : 'ohlc-change--down'}`}>
                {isUp ? '+' : ''}{displayData.changePct.toFixed(2)}%
              </span>
            )}
            {displayData.time && (
              <span className="ohlc-time">{displayData.time}</span>
            )}
          </div>
        )}
      </div>

      {/* ── KHU VỰC VẼ BIỂU ĐỒ TRADINGVIEW ───────────────────────────────── */}
      <div className="chart-canvas-container" ref={containerRef}>
        {/* TradingView Lightweight Charts canvas được vẽ tại đây */}
      </div>

      {/* ── SUB-PANEL: RSI(14) ───────────────────────────────────────────── */}
      {activeIndicators.rsi && (
        <div className="rsi-subpanel-wrap">
          <div className="rsi-header">
            <span className="rsi-title">RSI (14)</span>
            <span className="rsi-bounds">Quá mua: 70 | Quá bán: 30</span>
          </div>
          <div className="rsi-canvas-container" ref={rsiContainerRef} />
        </div>
      )}

      {/* ── FOOTER BIỂU ĐỒ: THÔNG TIN NGUỒN & TRADINGVIEW ATTRIBUTION ─────── */}
      <div className="trade-chart-footer">
        <div className="trade-footer-left">
          <span className="footer-status-dot" aria-hidden="true" />
          <span>
            Cập nhật lúc {candleResp?.updatedAt ? new Date(candleResp.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '23:59'} · Dữ liệu theo ngày
          </span>
          <span className="footer-divider">|</span>
          <span>Nguồn: <strong>{currentSource}</strong></span>
        </div>

        <div className="trade-footer-right">
          {/* Tuân thủ giấy phép TradingView Lightweight Charts */}
          <span className="tv-attribution" title="TradingView Lightweight Charts License Attribution">
            Biểu đồ sử dụng thư viện <strong>Lightweight Charts™</strong> của <strong>TradingView</strong>
          </span>
        </div>
      </div>
    </section>
  );
}
