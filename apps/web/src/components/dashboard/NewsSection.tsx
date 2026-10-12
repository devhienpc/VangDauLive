// src/components/dashboard/NewsSection.tsx
// Bản tin thị trường tài chính, năng lượng, vĩ mô kết nối API /api/news

import type { NewsRecord } from '../../types';
import { SkeletonNews } from './SkeletonCard';
import { ErrorRetry } from './ErrorRetry';

interface NewsSectionProps {
  items: NewsRecord[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const CATEGORY_STYLES: Record<string, { label: string; color: string }> = {
  'Năng lượng':       { label: 'Năng lượng',       color: '#2dd4bf' },
  'Vàng & Kim loại':  { label: 'Vàng & Kim loại',  color: '#F5A623' },
  'Vĩ mô / Fed':      { label: 'Vĩ mô / Fed',      color: '#f43f5e' },
  'Ngoại tệ':         { label: 'Ngoại tệ',         color: '#a78bfa' },
  'oil':              { label: 'Dầu thô',          color: '#2dd4bf' },
  'gold':             { label: 'Vàng',             color: '#F5A623' },
  'fuel':             { label: 'Xăng dầu',         color: '#60a5fa' },
  'forex':            { label: 'Ngoại tệ',         color: '#a78bfa' },
};

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 5) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHour < 24) return `${diffHour} giờ trước`;
    if (diffDay === 1) return 'Hôm qua';
    if (diffDay < 30) return `${diffDay} ngày trước`;

    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  } catch {
    return dateStr;
  }
}

function NewsCard({ item }: { item: NewsRecord; index: number }) {
  const style = CATEGORY_STYLES[item.category] ?? { label: item.category, color: '#38bdf8' };
  const relativeTime = formatRelativeTime(item.published_at);

  return (
    <article
      className="news-card"
      id={`news-${item.id}`}
      aria-label={item.title}
    >
      <div className="news-meta">
        <span
          className="news-category-badge"
          style={{
            background: `${style.color}22`,
            color: style.color,
            border: `1px solid ${style.color}44`,
          }}
        >
          {style.label}
        </span>
        <time className="news-time" dateTime={item.published_at}>
          {relativeTime}
        </time>
      </div>

      <h3 className="news-title">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="news-link"
            title={`Mở bài gốc trên ${item.source}`}
          >
            {item.title}
            <span className="news-external-icon" aria-hidden="true"> ↗</span>
          </a>
        ) : (
          item.title
        )}
      </h3>

      <p className="news-summary">{item.summary}</p>

      <div className="news-footer">
        <span className="news-source" title={`Nguồn tin: ${item.source}`}>
          <span className="source-dot" aria-hidden="true" />
          {item.source}
        </span>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="news-read-more"
            aria-label={`Mở bài gốc trên ${item.source}`}
          >
            Đọc bài gốc ↗
          </a>
        )}
      </div>
    </article>
  );
}

export function NewsSection({
  items,
  isLoading,
  error,
  onRetry,
}: NewsSectionProps) {

  if (isLoading) {
    return <SkeletonNews />;
  }

  if (error && onRetry) {
    return (
      <section className="dash-card" style={{ padding: '24px' }}>
        <ErrorRetry
          title="Không thể tải tin tức thị trường"
          message={error}
          onRetry={onRetry}
        />
      </section>
    );
  }

  return (
    <section
      className="dash-card"
      id="news-section"
      aria-label="Bản tin thị trường"
    >
      <div className="card-header">
        <div>
          <h2 className="card-title">Bản tin thị trường</h2>
          <p className="card-subtitle">
            Cập nhật tự động từ VnExpress, CafeF, VietnamBiz, Tuổi Trẻ
          </p>
        </div>
        <span className="badge-live">Live</span>
      </div>

      <div className="news-list" role="feed" aria-label="Danh sách tin mới nhất">
        {items.length === 0 ? (
          <div className="empty-state-wrap" style={{ padding: '32px 16px' }}>
            <p className="empty-title">Chưa có tin tức mới</p>
            <p className="empty-desc">Hệ thống đang tiếp tục rà soát các nguồn báo tài chính.</p>
          </div>
        ) : (
          items.map((item, i) => (
            <NewsCard key={`${item.id}-${i}`} item={item} index={i} />
          ))
        )}
      </div>
    </section>
  );
}
