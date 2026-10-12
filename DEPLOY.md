# Hướng Dẫn Deploy VàngDầu Live Lên Cloudflare

Dự án gồm 2 thành phần chính trên hệ sinh thái Cloudflare:
1. **Backend API (`apps/api`)**: Cloudflare Workers + D1 Database + Scheduled Triggers (Cron).
2. **Frontend Web (`apps/web`)**: Cloudflare Pages (React + Vite + TanStack Query).

---

## 1. Deploy Backend (Cloudflare Workers & D1)

### Bước 1.1: Đăng nhập Cloudflare Wrangler
Nếu chưa đăng nhập:
```bash
npx wrangler login
```

### Bước 1.2: Tạo Database D1 trên Cloudflare
```bash
cd apps/api
npx wrangler d1 create vangdau-db
```
*Lưu ý: Nếu bạn đã tạo database trước đó, kiểm tra ID bằng lệnh:*
```bash
npx wrangler d1 list
```
Sao chép `database_id` thu được và dán vào file [`apps/api/wrangler.toml`](file:///d:/056205005119-TruongVanHien/CNTT-hienpc/PROJECT/V%C3%A0ng%20D%E1%BA%A7u%20Live/apps/api/wrangler.toml):
```toml
[[d1_databases]]
binding = "DB"
database_name = "vangdau-db"
database_id = "8b08074a-b018-4a92-b17a-5f9d41a18da5"  # Thay bằng ID thật của bạn
migrations_dir = "migrations"
```

### Bước 1.3: Chạy Database Migration lên Remote
Chạy lệnh apply các file migration schema lên cơ sở dữ liệu D1 Cloudflare:
```bash
npx wrangler d1 migrations apply vangdau-db --remote
```

### Bước 1.4: Cấu hình Secrets an toàn cho Worker
Thiết lập các biến môi trường bí mật trên Cloudflare (không lưu trong git):
```bash
npx wrangler secret put EIA_API_KEY
# Nhập key EIA khi được hỏi

npx wrangler secret put METALS_API_KEY
# Nhập key Metals.dev khi được hỏi

npx wrangler secret put ADMIN_KEY
# Nhập chuỗi secret bảo vệ endpoint ingest nội bộ
```

### Bước 1.5: Deploy Worker API lên Production
```bash
npx wrangler deploy
```
Sau khi hoàn tất, bạn sẽ nhận được URL worker dạng:
`https://vangdau-api.<your-subdomain>.workers.dev`

---

## 2. Deploy Frontend (Cloudflare Pages) qua GitHub

### Bước 2.1: Kết nối kho lưu trữ GitHub
1. Truy cập vào [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Compute (Workers) > Workers & Pages** → Chọn **Create application** → Tab **Pages** → **Connect to Git**.
2. Chọn kho lưu trữ: `devhienpc/VangDauLive`.

### Bước 2.2: Thiết lập Build & Output Settings
- **Project name**: `vangdau-live` (hoặc `vangdau`)
- **Production branch**: `main` (hoặc `master`)
- **Framework preset**: `Vite`
- **Root directory**: `apps/web`
- **Build command**: `pnpm run build` *(hoặc `npm run build`)*
- **Build output directory**: `dist`

### Bước 2.3: Thiết lập Environment Variables
Tại mục **Environment variables (Production & Preview)**, thêm:
- `VITE_USE_MOCK`: `false`
- `VITE_API_URL`: `/api` *(nếu dùng routing chung domain)* hoặc URL đầy đủ của Worker: `https://vangdau-api.<your-subdomain>.workers.dev/api`

Bấm **Save and Deploy**. Mỗi khi bạn `git push` lên GitHub, Cloudflare Pages sẽ tự động kích hoạt CI/CD build và cập nhật phiên bản mới.

---

## 3. Gắn Custom Domain & Định tuyến Route `/api`

### Cách 1: Chạy chung Domain (Khuyên dùng - Không lo CORS)
Ví dụ bạn sở hữu domain `vangdau.vn` trỏ về Cloudflare:
1. **Frontend**: Gắn custom domain cho Cloudflare Pages:
   - Vào dự án Pages > **Custom domains** > Thêm `vangdau.vn` và `www.vangdau.vn`.
2. **Backend**: Gắn Worker Route để chuyển tiếp các request `/api/*`:
   - Vào Cloudflare Dashboard > Domain `vangdau.vn` > **Workers Routes** > **Add route**:
     - **Route**: `vangdau.vn/api/*`
     - **Worker**: `vangdau-api`
   - Lúc này:
     - `https://vangdau.vn/` tải giao diện React Pages.
     - `https://vangdau.vn/api/prices` gọi thẳng vào Worker API.

### Cách 2: Chạy Subdomain riêng biệt
- Frontend: `https://vangdau.vn` (Pages)
- Backend API: `https://api.vangdau.vn` (Worker)
- Trong Cloudflare Worker > **Triggers** > **Custom Domains** > Thêm `api.vangdau.vn`.
- Trong biến môi trường Cloudflare Pages đặt: `VITE_API_URL=https://api.vangdau.vn/api`.

---

## 4. Checklist Kiểm Tra Sau Deploy

- [ ] **Kiểm tra Health API**:
  Gửi request đến `GET https://<worker-domain>/api/health`:
  - `status: "healthy"`
  - `priceCount >= 15`
  - Các nguồn Vietcombank, EIA, Metals.dev, WebGia đều báo trạng thái `"ok"`.
- [ ] **Kích hoạt nạp dữ liệu ban đầu**:
  Gửi request `POST /api/admin/ingest` kèm header `x-admin-key: <ADMIN_KEY>` để Worker nạp phiên dữ liệu đầu tiên vào D1.
- [ ] **Kiểm tra Cron Trigger**:
  Kiểm tra tab **Triggers** của Worker trên Cloudflare Dashboard:
  - `0 1 * * *` (8:00 AM VN)
  - `0 10 * * *` (17:00 PM VN)
  - `30 9 * * 4` (16:30 PM thứ Năm hàng tuần - điều hành xăng dầu)
- [ ] **Kiểm tra Frontend**:
  - Thẻ KPI hiển thị đúng giá Vàng SJC, USD/VND, Dầu Brent.
  - Bảng niêm yết: Tìm kiếm, lọc tab và nút "Xuất Excel" tải đúng file CSV UTF-8.
  - Biểu đồ: Nút 30N/90N/1N vẽ đường dữ liệu mượt mà.
  - Tin tức: Hiển thị nguồn và click mở bài gốc ở tab mới.
