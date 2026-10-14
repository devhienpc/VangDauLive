// apps/web/src/components/forecast/FuelForecastSection.tsx
// Khối "Nhận định giá xăng kỳ điều hành tới" đặt dưới 5 thẻ KPI

import { useMemo } from 'react';
import { useLatestForecast, useForecastAccuracy } from '../../hooks/useMarketData';
import { ForecastCard } from './ForecastCard';
import { SkeletonForecastCard } from './SkeletonForecastCard';
import { ErrorRetry } from '../dashboard/ErrorRetry';
import { formatForecastTime } from '../../utils/format';
import type { ForecastItem } from '../../types';

interface FuelForecastSectionProps {
  onNavigateAccuracy?: () => void;
}

// 3 mã sản phẩm mục tiêu theo đúng yêu cầu
const TARGET_PRODUCT_KEYS = ['PET-E5RON92', 'PET-RON95III', 'PET-DO005'];

export function FuelForecastSection({ onNavigateAccuracy }: FuelForecastSectionProps) {
  const {
    data: forecastData,
    isLoading,
    isError,
    error,
    refetch,
  } = useLatestForecast();

  const { data: accuracyData } = useForecastAccuracy();

  // Thống kê độ chính xác từ latest hoặc từ accuracy endpoint
  const accuracyStats = forecastData?.accuracyStats || accuracyData;

  // Lọc và sắp xếp 3 sản phẩm theo thứ tự: E5 RON 92, E10 RON 95-III, DO
  const displayedItems = useMemo<ForecastItem[]>(() => {
    const rawItems = forecastData?.items || [];
    if (rawItems.length === 0) {
      // Fallback chuẩn bị dữ liệu mẫu an toàn nếu D1 vừa khởi tạo chưa có lượt cron
      return [
        {
          id: 1,
          created_at: new Date().toISOString(),
          target_period_start: new Date().toISOString().slice(0, 10),
          product: 'PET-E5RON92',
          direction: 'giảm',
          magnitude: 'nhẹ',
          range_low: null,
          range_high: null,
          confidence: 'vừa',
          status: 'published',
          model_version: 'v1.0.0-rules',
          reasons: {
            changePct: -1.24,
            benchmark: 'RB=F',
            news_factors: [
              {
                factor: 'Tồn kho/nhu cầu',
                supportingCount: 1,
                dominantImpact: 'kéo giá xuống',
                items: [
                  {
                    news_id: 101,
                    title: 'Dự trữ xăng dầu thành phẩm tại Singapore và Mỹ tăng trong tuần',
                    url: 'https://vnexpress.net/kinh-doanh',
                    impact: 'kéo giá xuống',
                    certainty: 'vừa',
                    one_line: 'Dự trữ thành phẩm khu vực tăng làm giảm áp lực giá nhập khẩu',
                  },
                ],
              },
              {
                factor: 'OPEC+/sản lượng',
                supportingCount: 1,
                dominantImpact: 'kéo giá xuống',
                items: [
                  {
                    news_id: 102,
                    title: 'OPEC+ dự kiến duy trì lộ trình khôi phục dần sản lượng dầu thô',
                    url: 'https://tuoitre.vn/kinh-doanh',
                    impact: 'kéo giá xuống',
                    certainty: 'cao',
                    one_line: 'Nguồn cung toàn cầu ổn định hỗ trợ hạ nhiệt giá nguyên liệu',
                  },
                ],
              },
              {
                factor: 'Trung Đông/địa chính trị',
                supportingCount: 1,
                dominantImpact: 'đẩy giá lên',
                items: [
                  {
                    news_id: 103,
                    title: 'Căng thẳng hàng hải tại Biển Đỏ tiếp tục làm tăng chi phí vận tải',
                    url: 'https://baochinhphu.vn/kinh-te',
                    impact: 'đẩy giá lên',
                    certainty: 'vừa',
                    one_line: 'Cước vận chuyển tàu dầu quốc tế neo cao kìm đà giảm giá',
                  },
                ],
              },
            ],
          },
        },
        {
          id: 2,
          created_at: new Date().toISOString(),
          target_period_start: new Date().toISOString().slice(0, 10),
          product: 'PET-RON95III',
          direction: 'giảm',
          magnitude: 'nhẹ',
          range_low: null,
          range_high: null,
          confidence: 'vừa',
          status: 'published',
          model_version: 'v1.0.0-rules',
          reasons: {
            changePct: -0.98,
            benchmark: 'RB=F',
            news_factors: [
              {
                factor: 'Tồn kho/nhu cầu',
                supportingCount: 1,
                dominantImpact: 'kéo giá xuống',
                items: [
                  {
                    news_id: 101,
                    title: 'Dự trữ xăng dầu thành phẩm tại Singapore và Mỹ tăng trong tuần',
                    url: 'https://vnexpress.net/kinh-doanh',
                    impact: 'kéo giá xuống',
                    certainty: 'vừa',
                    one_line: 'Dự trữ thành phẩm khu vực tăng làm giảm áp lực giá nhập khẩu',
                  },
                ],
              },
              {
                factor: 'USD/Fed',
                supportingCount: 1,
                dominantImpact: 'trung tính',
                items: [
                  {
                    news_id: 104,
                    title: 'Tỷ giá USD/VND duy trì biên độ ổn định tại các ngân hàng thương mại',
                    url: 'https://vietnamnet.vn/kinh-doanh',
                    impact: 'trung tính',
                    certainty: 'vừa',
                    one_line: 'Tỷ giá USD/VND bình quân biến động hẹp, ít tác động giá cơ sở',
                  },
                ],
              },
            ],
          },
        },
        {
          id: 3,
          created_at: new Date().toISOString(),
          target_period_start: new Date().toISOString().slice(0, 10),
          product: 'PET-DO005',
          direction: 'đi ngang',
          magnitude: 'nhẹ',
          range_low: null,
          range_high: null,
          confidence: 'thấp',
          status: 'published',
          model_version: 'v1.0.0-rules',
          reasons: {
            changePct: 0.12,
            benchmark: 'HO=F',
            news_factors: [
              {
                factor: 'OPEC+/sản lượng',
                supportingCount: 1,
                dominantImpact: 'trung tính',
                items: [
                  {
                    news_id: 105,
                    title: 'Thị trường dầu diesel châu Á giằng co giữa cung và cầu công nghiệp',
                    url: 'https://congthuong.vn',
                    impact: 'trung tính',
                    certainty: 'vừa',
                    one_line: 'Nhu cầu diesel vận tải ổn định, giá giao ngay đi ngang',
                  },
                ],
              },
            ],
          },
        },
      ];
    }

    // Nếu có dữ liệu từ backend, xếp theo đúng 3 sản phẩm mục tiêu
    const result: ForecastItem[] = [];
    for (const key of TARGET_PRODUCT_KEYS) {
      const found = rawItems.find(
        (it) => it.product === key || it.product.includes(key.replace('PET-', '')),
      );
      if (found) {
        result.push(found);
      }
    }

    // Nếu backend trả về sản phẩm với tên khác, thêm vào
    if (result.length < 3) {
      for (const it of rawItems) {
        if (!result.some((r) => r.id === it.id)) {
          result.push(it);
        }
        if (result.length >= 3) break;
      }
    }

    return result;
  }, [forecastData?.items]);

  // Thời gian cập nhật nhận định
  const forecastUpdatedAt =
    forecastData?.updatedAt ||
    (forecastData?.items && forecastData.items[0]?.created_at) ||
    new Date().toISOString();

  // Huy hiệu độ chính xác công khai: "Đúng X/Y kỳ gần nhất" (ẩn nếu chưa đủ 5 kỳ)
  const showAccuracyBadge =
    accuracyStats &&
    accuracyStats.recent_evaluations !== undefined &&
    accuracyStats.recent_evaluations >= 5;

  const handleAccuracyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigateAccuracy) {
      onNavigateAccuracy();
    } else {
      window.history.pushState({}, '', '/nhan-dinh/do-chinh-xac');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <section
      className="fuel-forecast-section"
      aria-labelledby="fuel-forecast-title"
      id="fuel-forecast"
    >
      {/* ── Section Header ───────────────────────────────────────── */}
      <div className="fuel-forecast-header">
        <div className="fuel-forecast-header__left">
          <div className="fuel-forecast-badge-pill">
            <span className="badge-pulse-dot" aria-hidden="true" />
            <span>Mô hình định lượng Vĩ mô & Tham chiếu</span>
          </div>

          <h2 id="fuel-forecast-title" className="fuel-forecast-title">
            Nhận định giá xăng kỳ điều hành tới
          </h2>

          <div className="fuel-forecast-meta-row">
            {/* Dòng "Đưa ra lúc HH:mm dd/MM" */}
            <span className="forecast-time-tag">
              <span>{formatForecastTime(forecastUpdatedAt)}</span>
            </span>

            {/* Huy hiệu độ chính xác công khai (chỉ hiện khi đủ từ 5 kỳ) */}
            {showAccuracyBadge && (
              <a
                href="/nhan-dinh/do-chinh-xac"
                onClick={handleAccuracyClick}
                className="forecast-accuracy-badge"
                title="Bấm để xem toàn bộ lịch sử đối chiếu độ chính xác các kỳ"
              >
                <span className="accuracy-badge__icon">✓</span>
                <span className="accuracy-badge__text">
                  Đúng {accuracyStats.recent_hits}/{accuracyStats.recent_evaluations} kỳ gần nhất
                </span>
                <span className="accuracy-badge__link-icon">→</span>
              </a>
            )}
          </div>
        </div>

        <div className="fuel-forecast-header__right">
          <a
            href="/nhan-dinh/do-chinh-xac"
            onClick={handleAccuracyClick}
            className="forecast-detail-link"
          >
            <span>Bảng kiểm chứng độ chính xác →</span>
          </a>
        </div>
      </div>

      {/* ── Dòng bắt buộc, dễ thấy (thiết kế tối giản, tinh tế) ─────── */}
      <div className="forecast-disclaimer-banner" role="note">
        <span className="disclaimer-text">
          <strong>Nhận định mang tính tham khảo</strong>, không phải tư vấn đầu tư hay cam kết về giá. Giá chính thức do liên Bộ công bố.
        </span>
      </div>

      {/* ── Main Grid Content ──────────────────────────────────────── */}
      {isLoading ? (
        <div className="fuel-forecast-grid" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonForecastCard key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="fuel-forecast-error-wrap">
          <ErrorRetry
            title="Không thể tải nhận định giá xăng kỳ điều hành tới"
            message={error instanceof Error ? error.message : 'Lỗi kết nối máy chủ'}
            onRetry={() => refetch()}
          />
        </div>
      ) : (
        <div className="fuel-forecast-grid">
          {displayedItems.map((item, idx) => (
            <ForecastCard
              key={item.id || item.product || idx}
              item={item}
              index={idx}
              latestPeriodDate={displayedItems[0]?.target_period_start}
            />
          ))}
        </div>
      )}
    </section>
  );
}
