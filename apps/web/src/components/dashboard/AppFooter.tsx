// src/components/dashboard/AppFooter.tsx
// Footer với dòng "Giá mang tính tham khảo. Nguồn: ..."

export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="app-footer" role="contentinfo">
      <div className="footer-inner">
        <div className="footer-brand">
          <a href="/" style={{ display: 'inline-block' }}>
            <img
              src="/logo.png"
              alt="VàngDầu Live"
              style={{ height: '34px', width: 'auto', objectFit: 'contain' }}
            />
          </a>
          <p className="footer-tagline">Theo dõi giá vàng, dầu, ngoại tệ Việt Nam &amp; thế giới</p>
        </div>

        <div className="footer-divider" aria-hidden="true" />

        <div className="footer-note">
          <p>
            <strong>Giá mang tính tham khảo.</strong> Không dùng để ra quyết định đầu tư, mua bán.
          </p>
          <p>
            Nguồn dữ liệu: Vietcombank · EIA · Metals.dev · WebGia (SJC) · Petrolimex (thông cáo điều hành giá), cập nhật thủ công · Yahoo Finance
          </p>
          <p className="tv-attribution-footer">
            Biểu đồ tài chính sử dụng thư viện <strong>Lightweight Charts™</strong> của <strong>TradingView</strong>.
          </p>
          <p>© {year} VàngDầu Live · Dữ liệu thị trường thời gian thực · <a href="/admin" className="footer-secret-link" title="Dành cho quản trị viên (Ctrl + Shift + A)">Hệ thống</a></p>
        </div>
      </div>
    </footer>
  );
}
