// src/components/Footer.tsx

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t mt-12 py-8 text-center"
      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
      <div className="max-w-7xl mx-auto px-4 space-y-2">
        <p className="text-sm">
          <span className="text-gradient-gold font-semibold">VàngDầu Live</span>
          {' '}– Theo dõi giá vàng, dầu, ngoại tệ Việt Nam và thế giới
        </p>
        <p className="text-xs">
          Dữ liệu cập nhật 2 lần/ngày · Giá mang tính tham khảo, không dùng cho mục đích đầu tư
        </p>
        <p className="text-xs">© {year} VàngDầu Live · Được xây dựng với Cloudflare Workers & D1</p>
      </div>
    </footer>
  );
}
