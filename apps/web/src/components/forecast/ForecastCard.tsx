// apps/web/src/components/forecast/ForecastCard.tsx
// Thẻ hiển thị nhận định giá xăng dầu kỳ điều hành tới cho từng sản phẩm

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { ForecastItem, NewsFactorItem } from '../../types';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import {
  formatEstimatedPeriod,
  extractSourceName,
} from '../../utils/format';

interface ForecastCardProps {
  item: ForecastItem;
  index: number;
  latestPeriodDate?: string | null;
}

export function getProductDisplayMeta(productKey: string) {
  const norm = productKey.toUpperCase();
  if (norm.includes('E5') || norm.includes('92')) {
    return {
      title: 'Xăng E5 RON 92',
      shortTitle: 'E5 RON 92',
      typeLabel: 'Xăng sinh học E5',
      accentColor: '#f59e0b',
      badgeClass: 'badge-e5',
    };
  }
  if (norm.includes('95')) {
    return {
      title: 'Xăng E10 RON 95-III',
      shortTitle: 'E10 RON 95-III',
      typeLabel: 'Xăng cao cấp',
      accentColor: '#fbbf24',
      badgeClass: 'badge-ron95',
    };
  }
  if (norm.includes('DO') || norm.includes('DIESEL') || norm.includes('DẦU')) {
    return {
      title: 'Dầu Diesel DO 0.05S-II',
      shortTitle: 'Dầu DO 0.05S-II',
      typeLabel: 'Nhiên liệu Diesel',
      accentColor: '#60a5fa',
      badgeClass: 'badge-do',
    };
  }
  return {
    title: productKey,
    shortTitle: productKey,
    typeLabel: 'Nhiên liệu xăng dầu',
    accentColor: '#f59e0b',
    badgeClass: 'badge-e5',
  };
}

export function ForecastCard({ item, index, latestPeriodDate }: ForecastCardProps) {
  const prefersReduced = useReducedMotion();
  const meta = useMemo(() => getProductDisplayMeta(item.product), [item.product]);

  // Trích xuất tối đa 3 yếu tố tác động từ tin tức
  const topFactors = useMemo<NewsFactorItem[]>(() => {
    const factors: NewsFactorItem[] = [];
    const groups = item.reasons?.news_factors || [];

    for (const group of groups) {
      if (group.items && Array.isArray(group.items)) {
        for (const it of group.items) {
          if (factors.length < 3) {
            factors.push(it);
          }
        }
      }
    }
    return factors;
  }, [item.reasons?.news_factors]);

  // Kiểm tra trạng thái "chưa đủ cơ sở"
  const isInsufficient = item.status === 'insufficient_data' || !item.direction;

  // Ngày dự kiến kỳ điều hành: suy từ target_period_start hoặc latestPeriodDate
  const estimatedPeriodText = formatEstimatedPeriod(
    item.target_period_start || latestPeriodDate,
  );

  // Mức tin cậy
  const confidenceNorm = (item.confidence || 'thấp').toLowerCase();
  let confidencePct = 33;
  let confidenceLabel = 'Thấp';
  let confidenceColorClass = 'confidence-low';

  if (confidenceNorm === 'cao') {
    confidencePct = 100;
    confidenceLabel = 'Cao';
    confidenceColorClass = 'confidence-high';
  } else if (confidenceNorm === 'vừa' || confidenceNorm === 'trung bình') {
    confidencePct = 66;
    confidenceLabel = 'Vừa';
    confidenceColorClass = 'confidence-medium';
  }

  // Mức độ biến động
  const magnitudeText = item.magnitude ? `(${item.magnitude})` : '';

  // Khoảng ước lượng đồng/lít: CHỈ hiển thị khi backend trả về cả 2 giá trị hợp lệ
  const rangeLow = item.range_low;
  const rangeHigh = item.range_high;
  const hasRange =
    rangeLow !== null &&
    rangeLow !== undefined &&
    rangeHigh !== null &&
    rangeHigh !== undefined;

  const rangeText =
    hasRange && rangeLow !== null && rangeHigh !== null
      ? `${rangeLow > 0 ? '+' : ''}${rangeLow} ~ ${rangeHigh > 0 ? '+' : ''}${rangeHigh} đ/lít`
      : null;

  // Hướng nhận định
  const directionNorm = item.direction || 'đi ngang';
  const isUp = directionNorm === 'tăng';
  const isDown = directionNorm === 'giảm';

  // Animation variants
  const cardVariants = {
    hidden: { opacity: 0, y: prefersReduced ? 0 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReduced ? 0 : 0.45,
        delay: prefersReduced ? 0 : index * 0.12,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  };

  // Mũi tên nảy nhẹ 1 lần (bounce once)
  const bounceVariants = {
    initial: { y: 0, scale: 0.92, opacity: 0 },
    animate: {
      y: prefersReduced ? 0 : [0, -8, 0],
      scale: 1,
      opacity: 1,
      transition: {
        y: {
          duration: prefersReduced ? 0 : 0.65,
          delay: prefersReduced ? 0 : 0.25 + index * 0.1,
          ease: 'easeOut',
          times: [0, 0.4, 1],
        },
        opacity: { duration: 0.3 },
        scale: { duration: 0.3 },
      },
    },
  };

  // Lý do chưa đủ cơ sở nhận định (ưu tiên lý do trực tiếp từ mô hình, không lấy r2Explanation)
  const insufficientReasonText = useMemo(() => {
    const rawReason = item.reasons?.reasons && item.reasons.reasons[0];
    if (rawReason) {
      return rawReason.replace(/^Chưa đủ cơ sở nhận định:\s*/i, '');
    }
    if (item.display_status) return item.display_status;
    return 'Chưa đủ dữ liệu chu kỳ tham chiếu để đưa ra nhận định tin cậy.';
  }, [item.reasons?.reasons, item.display_status]);

  return (
    <motion.article
      className={`forecast-card ${isInsufficient ? 'forecast-card--insufficient' : ''} ${
        isUp ? 'forecast-card--up' : isDown ? 'forecast-card--down' : 'forecast-card--neutral'
      }`}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      aria-label={`Nhận định giá cho ${meta.title}`}
    >
      {/* ── Card Header ────────────────────────────────────────────── */}
      <header className="forecast-card__header">
        <div className="forecast-card__identity">
          <span className={`forecast-card__type-tag ${meta.badgeClass}`}>
            {meta.typeLabel}
          </span>
          <h3 className="forecast-card__title">{meta.title}</h3>
        </div>

        {/* Dự kiến kỳ điều hành (thiết kế tối giản, không lạm dụng icon) */}
        <div className="forecast-card__schedule">
          <span>{estimatedPeriodText}</span>
        </div>
      </header>

      {/* ── Card Body ──────────────────────────────────────────────── */}
      {isInsufficient ? (
        // ── Trạng thái: Chưa đủ cơ sở để nhận định ──────────────────
        <div className="forecast-card__insufficient-box">
          <div className="insufficient-badge">
            <span className="insufficient-badge__text">
              Chưa đủ cơ sở để nhận định kỳ này
            </span>
          </div>

          <p className="insufficient-reason">
            {insufficientReasonText}
          </p>
        </div>
      ) : (
        // ── Trạng thái: Có nhận định ────────────────────────────────
        <div className="forecast-card__content">
          {/* Focal Hero Direction Box */}
          <div className="forecast-hero-box">
            {/* Animated Direction Arrow */}
            <motion.div
              className={`forecast-arrow-wrap ${
                isUp ? 'arrow-up' : isDown ? 'arrow-down' : 'arrow-neutral'
              }`}
              variants={bounceVariants}
              initial="initial"
              animate="animate"
              aria-hidden="true"
            >
              {isUp ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              ) : isDown ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M15 7l5 5-5 5" />
                </svg>
              )}
            </motion.div>

            <div className="forecast-direction-text-group">
              <div className="forecast-direction-main">
                <span className={`direction-keyword ${isUp ? 'text-up' : isDown ? 'text-down' : 'text-neutral'}`}>
                  Có xu hướng {directionNorm}
                </span>
                {magnitudeText && (
                  <span className="direction-magnitude">{magnitudeText}</span>
                )}
              </div>

              {/* Khoảng ước lượng đồng/lít (chỉ hiện khi backend trả về) */}
              {hasRange && rangeText && (
                <div className="forecast-range-badge" title="Khoảng ước lượng dựa trên mô hình hồi quy">
                  <span className="range-num">{rangeText}</span>
                </div>
              )}
            </div>
          </div>

          {/* Thanh mức tin cậy chạy đầy dần */}
          <div className="forecast-confidence-section">
            <div className="forecast-confidence-header">
              <span className="confidence-label">Mức tin cậy:</span>
              <span className={`confidence-badge ${confidenceColorClass}`}>
                {confidenceLabel}
              </span>
            </div>

            <div
              className="confidence-track"
              role="progressbar"
              aria-valuenow={confidencePct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Mức tin cậy: ${confidenceLabel}`}
            >
              <motion.div
                className={`confidence-bar ${confidenceColorClass}`}
                initial={{ width: 0 }}
                animate={{ width: `${confidencePct}%` }}
                transition={{
                  duration: prefersReduced ? 0 : 0.8,
                  delay: prefersReduced ? 0 : 0.3 + index * 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            </div>
          </div>

          {/* Tối đa 3 yếu tố tác động từ tin tức */}
          <div className="forecast-factors-section">
            <h4 className="factors-heading">
              <span>Yếu tố tác động</span>
              {topFactors.length > 0 && (
                <span className="factors-count">({topFactors.length})</span>
              )}
            </h4>

            {topFactors.length === 0 ? (
              <p className="factors-empty">Chưa có yếu tố tin tức đặc biệt trong kỳ này.</p>
            ) : (
              <ul className="factors-list">
                {topFactors.map((factor, fIdx) => {
                  const factorImpact = factor.impact || 'trung tính';
                  const isPushUp = factorImpact === 'đẩy giá lên';
                  const isPullDown = factorImpact === 'kéo giá xuống';
                  const sourceName = extractSourceName(factor.url);

                  return (
                    <motion.li
                      key={factor.news_id || fIdx}
                      className="factor-item"
                      initial={{ opacity: 0, x: prefersReduced ? 0 : -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: prefersReduced ? 0 : 0.4,
                        delay: prefersReduced ? 0 : 0.4 + index * 0.1 + fIdx * 0.08,
                        ease: 'easeOut',
                      }}
                    >
                      {/* Biểu tượng tác động */}
                      <span
                        className={`factor-icon ${
                          isPushUp
                            ? 'factor-icon--up'
                            : isPullDown
                            ? 'factor-icon--down'
                            : 'factor-icon--neutral'
                        }`}
                        title={factorImpact}
                        aria-label={factorImpact}
                      >
                        {isPushUp ? '▲' : isPullDown ? '▼' : '▬'}
                      </span>

                      {/* Mô tả 1 dòng */}
                      <span className="factor-desc" title={factor.one_line || factor.title}>
                        {factor.one_line || factor.title}
                      </span>

                      {/* Link mở bài gốc ở tab mới */}
                      {factor.url && (
                        <a
                          href={factor.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="factor-source-link"
                          title={`Xem bài viết trên ${sourceName} (mở tab mới)`}
                        >
                          <span>{sourceName}</span>
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      )}
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </motion.article>
  );
}
