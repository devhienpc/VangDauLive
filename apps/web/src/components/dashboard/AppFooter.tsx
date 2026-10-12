// src/components/dashboard/AppFooter.tsx
// Footer với dòng "Giá mang tính tham khảo. Nguồn: ..."

export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="app-footer" role="contentinfo">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">VàngDầu<span>Live</span></span>
          <p className="footer-tagline">Theo dõi giá vàng, dầu, ngoại tệ Việt Nam &amp; thế giới</p>
        </div>

        <div className="footer-divider" aria-hidden="true" />

        <div className="footer-note">
          <p>
            <strong>Giá mang tính tham khảo.</strong> Không dùng để ra quyết định đầu tư, mua bán.
          </p>
          <p>
            Nguồn dữ liệu: Vietcombank · EIA · Metals.dev · WebGia (SJC, Petrolimex)
          </p>
          <p>© {year} VàngDầu Live · Dữ liệu thị trường thời gian thực</p>

        </div>
      </div>
    </footer>
  );
}
