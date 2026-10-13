-- Migration 0006: Thêm image_url, needs_review, flags cho fuel_suggestions
-- Áp dụng local:  wrangler d1 migrations apply vangdau-db --local
-- Áp dụng remote: wrangler d1 migrations apply vangdau-db --remote

ALTER TABLE fuel_suggestions ADD COLUMN image_url TEXT;
ALTER TABLE fuel_suggestions ADD COLUMN needs_review INTEGER DEFAULT 0;
ALTER TABLE fuel_suggestions ADD COLUMN flags TEXT;
