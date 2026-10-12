// src/db.ts – Các hàm tương tác D1 database (mở rộng đầy đủ)

import type { PriceRecord, DailyCandle } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────────────────────

/** Upsert giá mới vào bảng prices (batch insert) */
export async function upsertPrices(db: D1Database, records: PriceRecord[]): Promise<void> {
  if (records.length === 0) return;

  const stmts = records.map((r) =>
    db
      .prepare(
        `INSERT INTO prices (symbol, name, category, bid, ask, unit, change_pct, source, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        r.symbol,
        r.name,
        r.category,
        r.bid ?? r.buyPrice ?? null,
        r.ask ?? r.sellPrice ?? null,
        r.unit,
        r.change_pct ?? null,
        r.source,
        r.fetched_at ?? r.fetchedAt ?? new Date().toISOString(),
      ),
  );

  await db.batch(stmts);
}

/** Ghi ingest_log sau mỗi lần fetch (hỗ trợ ok, error, warning) */
export async function logIngest(
  db: D1Database,
  source: string,
  status: 'ok' | 'error' | 'warning',
  message?: string,
): Promise<void> {
  const createdAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  await db
    .prepare(
      `INSERT INTO ingest_log (source, status, message, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(source, status, message ?? null, createdAt)
    .run();
}

/** Lấy bản ghi mới nhất của một symbol cụ thể */
export async function getLatestSinglePrice(
  db: D1Database,
  symbol: string,
): Promise<{
  id: number;
  symbol: string;
  bid: number | null;
  ask: number | null;
  fetched_at: string;
  source: string;
} | null> {
  const row = await db
    .prepare(
      `SELECT id, symbol, bid, ask, fetched_at, source
       FROM prices
       WHERE symbol = ?
       ORDER BY fetched_at DESC, id DESC
       LIMIT 1`,
    )
    .bind(symbol)
    .first<{
      id: number;
      symbol: string;
      bid: number | null;
      ask: number | null;
      fetched_at: string;
      source: string;
    }>();

  return row ?? null;
}

/** Stub – lịch sử được lưu trực tiếp qua fetched_at trong prices */
export async function insertHistory(_db: D1Database, _records: PriceRecord[]): Promise<void> {}


// ─────────────────────────────────────────────────────────────────────────────
// READ – PRICES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/prices
 * Giá mới nhất của mỗi symbol: lấy 1 bản ghi có fetched_at lớn nhất.
 * Trả về change_pct và fetched_at theo yêu cầu.
 */
export async function getLatestPrices(
  db: D1Database,
): Promise<Record<string, unknown>[]> {
  const { results } = await db
    .prepare(
      `SELECT
         p.id,
         p.symbol,
         p.name,
         p.category,
         p.bid,
         p.ask,
         p.unit,
         p.change_pct,
         p.source,
         p.fetched_at
       FROM prices p
       INNER JOIN (
         SELECT symbol, MAX(fetched_at) AS max_fetched
         FROM prices
         GROUP BY symbol
       ) latest
         ON p.symbol = latest.symbol
        AND p.fetched_at = latest.max_fetched
       ORDER BY p.category, p.symbol`,
    )
    .all();
  return results;
}

/** Lấy giá mới nhất theo category */
export async function getPricesByCategory(
  db: D1Database,
  category: string,
): Promise<Record<string, unknown>[]> {
  const { results } = await db
    .prepare(
      `SELECT
         p.id, p.symbol, p.name, p.category,
         p.bid, p.ask, p.unit, p.change_pct, p.source, p.fetched_at
       FROM prices p
       INNER JOIN (
         SELECT symbol, MAX(fetched_at) AS max_fetched
         FROM prices
         WHERE category = ?
         GROUP BY symbol
       ) latest
         ON p.symbol = latest.symbol
        AND p.fetched_at = latest.max_fetched
       WHERE p.category = ?
       ORDER BY p.symbol`,
    )
    .bind(category, category)
    .all();
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// READ – HISTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/history?symbols=SJC-01,BRENT&range=30d
 * Lấy 1 điểm/ngày (giá gần nhất trong ngày) cho biểu đồ.
 * Hỗ trợ nhiều symbols trong một query.
 */
export async function getPriceHistoryMulti(
  db: D1Database,
  symbols: string[],
  days: number,
): Promise<Record<string, unknown>[]> {
  if (symbols.length === 0) return [];

  // Tạo placeholders: ?,?,?
  const placeholders = symbols.map(() => '?').join(',');

  // Lấy 1 điểm/ngày: MAX(fetched_at) nhóm theo (symbol, date)
  const { results } = await db
    .prepare(
      `SELECT
         p.symbol,
         COALESCE(p.ask, p.bid) AS price,
         DATE(p.fetched_at)     AS date,
         p.unit,
         p.source
       FROM prices p
       INNER JOIN (
         SELECT
           symbol,
           DATE(fetched_at)       AS day,
           MAX(fetched_at)        AS max_fetched
         FROM prices
         WHERE symbol IN (${placeholders})
           AND fetched_at >= datetime('now', ? || ' days')
         GROUP BY symbol, DATE(fetched_at)
       ) daily
         ON p.symbol = daily.symbol
        AND p.fetched_at = daily.max_fetched
       ORDER BY p.symbol, date ASC`,
    )
    .bind(...symbols, `-${days}`)
    .all();
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// READ – NEWS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/news?category=gold&limit=10
 * Tin tức mới nhất, lọc theo category nếu có.
 */
export async function getNews(
  db: D1Database,
  opts: { category?: string | null; limit: number },
): Promise<Record<string, unknown>[]> {
  if (opts.category) {
    const { results } = await db
      .prepare(
        `SELECT id, title, summary, category, url, source, published_at
         FROM news
         WHERE category = ?
         ORDER BY published_at DESC
         LIMIT ?`,
      )
      .bind(opts.category, opts.limit)
      .all();
    return results;
  }

  const { results } = await db
    .prepare(
      `SELECT id, title, summary, category, url, source, published_at
       FROM news
       ORDER BY published_at DESC
       LIMIT ?`,
    )
    .bind(opts.limit)
    .all();
  return results;
}

/**
 * Thêm các bài tin mới vào database (chống trùng bằng url UNIQUE với INSERT OR IGNORE)
 */
export async function insertNewsItems(
  db: D1Database,
  items: Array<{
    title: string;
    summary: string;
    category: string;
    url: string;
    source: string;
    published_at: string;
  }>,
): Promise<number> {
  if (items.length === 0) return 0;

  const stmts = items.map((item) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO news (title, summary, category, url, source, published_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        item.title,
        item.summary,
        item.category,
        item.url,
        item.source,
        item.published_at,
      ),
  );

  const results = await db.batch(stmts);
  // Đếm số dòng thực sự được insert
  let inserted = 0;
  for (const r of results) {
    if (r.meta && r.meta.changes) {
      inserted += r.meta.changes;
    }
  }
  return inserted;
}

/**
 * Xóa tin tức cũ hơn số ngày quy định (mặc định 60 ngày)
 */
export async function cleanupOldNews(db: D1Database, olderThanDays: number = 60): Promise<number> {
  const result = await db
    .prepare(`DELETE FROM news WHERE published_at < datetime('now', ? || ' days')`)
    .bind(`-${olderThanDays}`)
    .run();
  return result.meta?.changes ?? 0;
}


// ─────────────────────────────────────────────────────────────────────────────
// READ – HEALTH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thời điểm cập nhật gần nhất (MAX fetched_at trong prices)
 */
export async function getLastUpdated(db: D1Database): Promise<string | null> {
  const row = await db
    .prepare(`SELECT MAX(fetched_at) AS last FROM prices`)
    .first<{ last: string | null }>();
  return row?.last ?? null;
}

/**
 * GET /api/health
 * Trạng thái từng source từ ingest_log (bản ghi mới nhất mỗi source).
 */
export async function getIngestStatus(
  db: D1Database,
): Promise<Record<string, unknown>[]> {
  const { results } = await db
    .prepare(
      `SELECT
         l.source,
         l.status,
         l.message,
         l.created_at
       FROM ingest_log l
       INNER JOIN (
         SELECT source, MAX(created_at) AS max_at
         FROM ingest_log
         GROUP BY source
       ) latest
         ON l.source = latest.source
        AND l.created_at = latest.max_at
       ORDER BY l.source`,
    )
    .all();
  return results;
}

/** Đếm tổng số bản ghi trong prices (để kiểm tra DB có dữ liệu chưa) */
export async function countPrices(db: D1Database): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM prices`)
    .first<{ n: number }>();
  return row?.n ?? 0;
}



// ─────────────────────────────────────────────────────────────────────────────
// LEGACY – giữ lại để không break import cũ
// ─────────────────────────────────────────────────────────────────────────────
export async function getAllPrices(db: D1Database): Promise<Record<string, unknown>[]> {
  return getLatestPrices(db);
}

export async function getPriceHistory(
  db: D1Database,
  symbol: string,
  days: number = 30,
): Promise<Record<string, unknown>[]> {
  return getPriceHistoryMulti(db, [symbol], days);
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY CANDLES (OHLC)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upsert mảng nến ngày vào bảng daily_candles (chia batch tối đa 50)
 */
export async function upsertDailyCandles(
  db: D1Database,
  candles: DailyCandle[],
): Promise<number> {
  if (candles.length === 0) return 0;

  const BATCH_SIZE = 50;
  let totalInserted = 0;

  for (let i = 0; i < candles.length; i += BATCH_SIZE) {
    const chunk = candles.slice(i, i + BATCH_SIZE);
    const stmts = chunk.map((c) =>
      db
        .prepare(
          `INSERT INTO daily_candles (symbol, date, open, high, low, close, source)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(symbol, date) DO UPDATE SET
             open = excluded.open,
             high = excluded.high,
             low = excluded.low,
             close = excluded.close,
             source = excluded.source`,
        )
        .bind(c.symbol, c.date, c.open, c.high, c.low, c.close, c.source),
    );
    await db.batch(stmts);
    totalInserted += chunk.length;
  }

  return totalInserted;
}

/**
 * Cập nhật nến ngày hiện tại:
 * - Nếu chưa có: open = price, high = price, low = price, close = price
 * - Nếu đã có: open giữ nguyên, high = MAX(high, price), low = MIN(low, price), close = price
 */
export async function updateTodayCandle(
  db: D1Database,
  symbol: string,
  date: string,
  price: number,
  source: string,
): Promise<void> {
  if (price <= 0) return;

  await db
    .prepare(
      `INSERT INTO daily_candles (symbol, date, open, high, low, close, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(symbol, date) DO UPDATE SET
         high = MAX(daily_candles.high, excluded.close),
         low  = MIN(daily_candles.low, excluded.close),
         close = excluded.close,
         source = excluded.source`,
    )
    .bind(symbol, date, price, price, price, price, source)
    .run();
}

/**
 * Lấy danh sách nến theo symbol và ngày bắt đầu (sắp xếp tăng dần theo thời gian)
 */
export async function getDailyCandles(
  db: D1Database,
  symbol: string,
  startDate?: string,
): Promise<DailyCandle[]> {
  let query = `SELECT symbol, date, open, high, low, close, source FROM daily_candles WHERE symbol = ?`;
  const params: any[] = [symbol];

  if (startDate) {
    query += ` AND date >= ?`;
    params.push(startDate);
  }

  query += ` ORDER BY date ASC`;

  const { results } = await db.prepare(query).bind(...params).all<DailyCandle>();
  return results || [];
}

/**
 * Đếm số lượng nến trong daily_candles
 */
export async function countDailyCandles(db: D1Database): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM daily_candles`)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

