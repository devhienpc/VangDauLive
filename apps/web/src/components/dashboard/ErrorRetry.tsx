// src/components/dashboard/ErrorRetry.tsx
// Trạng thái lỗi với thông báo thân thiện và nút "Thử lại"

interface ErrorRetryProps {
  title?: string;
  message?: string;
  onRetry: () => void;
}

export function ErrorRetry({
  title = 'Không thể tải dữ liệu',
  message = 'Đã có lỗi xảy ra trong quá trình kết nối máy chủ.',
  onRetry,
}: ErrorRetryProps) {
  return (
    <div className="error-retry-card" role="alert">
      <div className="error-icon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="error-content">
        <h3 className="error-title">{title}</h3>
        <p className="error-message">{message}</p>
      </div>
      <button
        type="button"
        className="btn-retry"
        onClick={onRetry}
        aria-label="Thử tải lại dữ liệu"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        Thử lại
      </button>
    </div>
  );
}
