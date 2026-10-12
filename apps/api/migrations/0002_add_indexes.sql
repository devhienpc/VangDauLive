-- Migration 0002: Thêm indexes bổ sung và cột category cho ingest_log
-- Áp dụng local:  wrangler d1 migrations apply vangdau-db --local
-- Áp dụng remote: wrangler d1 migrations apply vangdau-db --remote

-- Index composite cho query lịch sử (symbol + category + fetched_at)
CREATE INDEX IF NOT EXISTS idx_prices_category_fetched
  ON prices(category, fetched_at DESC);

-- Index riêng cho category (dùng cho getPricesByCategory)
CREATE INDEX IF NOT EXISTS idx_prices_category
  ON prices(category);

-- Index cho news theo category + published_at
CREATE INDEX IF NOT EXISTS idx_news_category_published
  ON news(category, published_at DESC);

-- Index cho ingest_log theo source + created_at
CREATE INDEX IF NOT EXISTS idx_ingest_source_created
  ON ingest_log(source, created_at DESC);
