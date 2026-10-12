# VàngDầu Live

Hệ thống theo dõi giá vàng, bạc, dầu thô, xăng dầu và ngoại tệ trực tiếp tại Việt Nam và thế giới.

---

## 🏗 Cấu trúc Monorepo

Dự án được tổ chức dưới dạng monorepo với **pnpm workspaces**:

```
Vàng Dầu Live/
├── apps/
│   ├── api/                          # Cloudflare Workers + Hono API & Cron Ingest
│   │   ├── migrations/
│   │   │   └── 0001_initial_schema.sql  # Schema D1 (prices, news, ingest_log)
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point Hono server & Scheduled handler
│   │   │   ├── db.ts                 # D1 query helpers
│   │   │   ├── types.ts              # TypeScript schema & types
│   │   │   └── cron.ts               # Cron ingest orchestrator
│   │   ├── wrangler.toml             # Cấu hình D1 binding, Cron triggers & Vars
│   │   └── .env.example
│   └── web/                          # Frontend Dashboard (SPA)
│       ├── src/
│       │   ├── App.tsx               # Main Dashboard
│       │   ├── components/           # UI components
│       │   └── index.css             # Tailwind CSS & Design tokens
│       ├── index.html
│       ├── vite.config.ts
│       └── .env.example
├── package.json                      # Root package scripts
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## 🛠 Công nghệ sử dụng

| Tầng | Công nghệ |
|---|---|
| **Frontend (`apps/web`)** | Vite, React 19, TypeScript, Tailwind CSS v4, Framer Motion, Recharts |
| **Backend (`apps/api`)** | Cloudflare Workers, Hono framework, D1 Database (SQLite serverless) |
| **Quản lý Workspace** | pnpm Workspaces |

---

## 🚀 Hướng dẫn chạy Local

### 1. Cài đặt Dependencies

Tại thư mục gốc của dự án:
```bash
pnpm install
```

### 2. Khởi tạo và thiết lập Cloudflare D1 Database

#### A. Tạo D1 Database trên Cloudflare (khi deploy thật)
```bash
npx wrangler d1 create vangdau-db
```
Sau khi tạo, copy `database_id` nhận được và dán vào file [apps/api/wrangler.toml](file:///apps/api/wrangler.toml):
```toml
[[d1_databases]]
binding = "DB"
database_name = "vangdau-db"
database_id = "YOUR_D1_DATABASE_ID"
```

#### B. Chạy Migration tạo bảng (Local)
Dùng lệnh sau để áp dụng schema (các bảng `prices`, `news`, `ingest_log` và các index) vào D1 SQLite local:
```bash
# Qua script pnpm ở root
pnpm --filter api db:migrate:local

# Hoặc dùng trực tiếp lệnh wrangler
cd apps/api
npx wrangler d1 migrations apply vangdau-db --local
```

*(Khi deploy lên Cloudflare D1 Remote, thay cờ `--local` bằng `--remote`: `pnpm --filter api db:migrate`)*

### 3. Cấu hình Biến môi trường Local

Tạo file `apps/api/.dev.vars` (dùng cho Wrangler dev local):
```ini
EIA_API_KEY="your_eia_api_key_here"
METALS_API_KEY="your_metals_api_key_here"
```

Tạo file `apps/web/.env` (dùng cho Vite frontend):
```ini
VITE_API_URL=http://localhost:8787
```

### 4. Khởi chạy Services

Mở 2 terminal hoặc chạy song song:

#### Terminal 1: Chạy API (Cloudflare Worker với Wrangler)
```bash
pnpm dev:api
# Hoặc: pnpm --filter api dev (chạy wrangler dev)
```
API sẽ lắng nghe tại: `http://localhost:8787`
- Kiểm tra health: `http://localhost:8787/api/health`
- Lấy danh sách giá: `http://localhost:8787/api/prices`

#### Terminal 2: Chạy Web Frontend (Vite)
```bash
pnpm dev:web
# Hoặc: pnpm --filter web dev (chạy vite dev)
```
Giao diện Web sẽ khả dụng tại: `http://localhost:5173`

---

## 🗄 Cấu trúc Database (Cloudflare D1)

Migration trong [apps/api/migrations/0001_initial_schema.sql](file:///apps/api/migrations/0001_initial_schema.sql) gồm 3 bảng chính:

1. **`prices`**: Lưu biến động giá hàng hóa, tiền tệ và nhiên liệu
   - `id` (INTEGER PK AUTOINCREMENT)
   - `symbol` (TEXT)
   - `name` (TEXT)
   - `category` (TEXT)
   - `bid` (REAL - giá mua)
   - `ask` (REAL - giá bán)
   - `unit` (TEXT)
   - `change_pct` (REAL)
   - `source` (TEXT)
   - `fetched_at` (TEXT)
   - **Index**: `idx_prices_symbol_fetched_at` trên `(symbol, fetched_at)`

2. **`news`**: Lưu tin tức thị trường
   - `id` (INTEGER PK AUTOINCREMENT)
   - `title` (TEXT)
   - `summary` (TEXT)
   - `category` (TEXT)
   - `url` (TEXT UNIQUE)
   - `source` (TEXT)
   - `published_at` (TEXT)
   - **Index**: `idx_news_published_at` trên `(published_at)`

3. **`ingest_log`**: Theo dõi nhật ký đồng bộ dữ liệu
   - `id` (INTEGER PK AUTOINCREMENT)
   - `source` (TEXT)
   - `status` (TEXT)
   - `message` (TEXT)
   - `created_at` (TEXT)

---

## ⏰ Cron Triggers

Cấu hình tự động thu thập dữ liệu trong [apps/api/wrangler.toml](file:///apps/api/wrangler.toml):
- `"0 1 * * *"`: 01:00 UTC (08:00 sáng GMT+7) mỗi ngày
- `"0 10 * * *"`: 10:00 UTC (17:00 chiều GMT+7) mỗi ngày
- `"30 9 * * 4"`: 09:30 UTC (16:30 chiều GMT+7) thứ Năm hàng tuần (cập nhật chu kỳ xăng dầu Petrolimex / Bộ Công Thương)

---

## 📜 Các lệnh hữu ích

- `pnpm -r typecheck`: Kiểm tra TypeScript typecheck toàn bộ workspace
- `pnpm --filter web build`: Build bundle frontend cho production
- `pnpm --filter api build`: Kiểm tra build Cloudflare Workers API
