// src/index.ts – Entry point: Hono API + Cloudflare Workers Cron
// Đã refactor: routes tách ra files riêng, CORS + Cache được cấu hình tập trung

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import type { Env } from './types.js';

import { pricesRoute }  from './routes/prices.js';
import { historyRoute } from './routes/history.js';
import { newsRoute }    from './routes/news.js';
import { healthRoute }  from './routes/health.js';
import { candlesRoute } from './routes/candles.js';
import { runFetchAll }  from './cron.js';
import {
  insertFuelManual,
  insertFuelSuggestion,
  getLatestFuelManual,
  getPendingFuelSuggestions,
  getFuelSuggestionById,
  updateFuelSuggestionStatus,
  upsertPrices,
  updateTodayCandle,
  logIngest,
  upsertFuelAdjustments,
  getFuelAdjustments,
  countFuelAdjustments,
} from './db.js';
import { invalidateCache } from './cache.js';
import type { FuelManualRecord, FuelAdjustmentRecord } from './types.js';
import {
  processFuelImageOcr,
  fetchPetrolimexPriceImageAndEffectiveAt,
} from './adapters/ocr-fuel.js';
import { runFullBackfill } from './adapters/backfill.js';
import {
  generateForecast,
  runBacktest,
  getForecastAccuracyStats,
  FORECAST_CONFIG,
} from './forecast/index.ts';

const app = new Hono<{ Bindings: Env }>();

// ─── Middleware ────────────────────────────────────────────────────────────────

// CORS: cho phép frontend domain + localhost dev
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*';
    if (
      origin.includes('localhost') ||
      origin.endsWith('.pages.dev') ||
      origin.endsWith('.workers.dev') ||
      origin.includes('vangdau')
    ) {
      return origin;
    }
    return origin;
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Accept', 'X-Admin-Key', 'X-Admin-Token', 'Authorization'],
  exposeHeaders: ['X-Cache', 'Cache-Control'],
  maxAge: 86400, // preflight cache 24h
}));

// Pretty JSON chỉ khi có ?pretty=1 (tiết kiệm bandwidth mặc định)
app.use('*', (c, next) => {
  if (c.req.query('pretty') === '1') {
    return prettyJSON()(c, next);
  }
  return next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Mount các route modules
app.route('/api/prices',  pricesRoute);
app.route('/api/history', historyRoute);
app.route('/api/news',    newsRoute);
app.route('/api/health',  healthRoute);
app.route('/api/candles', candlesRoute);

function checkAdminAuth(c: any): boolean {
  const rawSecret =
    c.req.header('X-Admin-Key') ||
    c.req.header('X-Admin-Token') ||
    c.req.header('Authorization') ||
    c.req.query('secret') ||
    c.req.query('admin_key');
  const secret = rawSecret?.replace(/^Bearer\s+/i, '').trim();
  const expectedKey = c.env.ADMIN_KEY?.trim();

  // Cho phép Cloudflare Access
  if (c.req.header('CF-Access-Authenticated-User-Email')) return true;

  if (c.env.APP_ENV === 'production') {
    return expectedKey ? secret === expectedKey : Boolean(secret);
  }
  return expectedKey ? secret === expectedKey : true;
}

/**
 * POST /api/admin/backfill – Backfill 2 năm dữ liệu nến OHLC từ Yahoo Finance
 * Hỗ trợ tham số query hoặc body ?range=2y (mặc định 2y)
 * Bảo vệ bằng secret header: X-Admin-Key hoặc X-Admin-Token hoặc Authorization.
 */
app.post('/api/admin/backfill', async (c) => {
  if (!checkAdminAuth(c)) {
    return c.json({ success: false, error: 'Không được phép: thiếu hoặc sai secret key' }, 401);
  }

  const range = (c.req.query('range') || '2y').trim();

  try {
    const result = await runFullBackfill(c.env.DB, c.env, range);
    return c.json({
      success: true,
      data: result,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/api/admin/backfill] Error:', err);
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Lỗi khi thực hiện backfill',
        data: null,
      },
      500,
    );
  }
});

/**
 * POST /api/admin/ingest (và alias /api/admin/fetch) – Trigger ingest thủ công (dev / test / admin)
 * Bảo vệ bằng secret header: X-Admin-Key hoặc X-Admin-Token.
 */
const handleAdminIngest = async (c: any) => {
  if (!checkAdminAuth(c)) {
    return c.json({ success: false, error: 'Không được phép: thiếu hoặc sai secret key' }, 401);
  }

  try {
    const results = await runFetchAll(c.env);
    return c.json({
      success: true,
      data: results,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Lỗi không xác định',
        data: null,
        updatedAt: null,
      },
      500,
    );
  }
};

app.post('/api/admin/ingest', handleAdminIngest);
app.post('/api/admin/fetch', handleAdminIngest);

/**
 * Hàm phân tích cú pháp CSV lịch sử điều hành xăng dầu (chuẩn RFC 4180)
 */
function parseFuelAdjustmentsCSV(rawCsv: string): { records: FuelAdjustmentRecord[]; errors: string[] } {
  const clean = rawCsv.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { records: [], errors: ['Tệp CSV rỗng'] };
  }

  function splitRow(line: string): string[] {
    const fields: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  const headerLine = splitRow(lines[0] ?? '').map((h) => h.toLowerCase().trim());
  const colIndex = {
    effective_at: headerLine.indexOf('effective_at'),
    product: headerLine.indexOf('product'),
    price_zone1: headerLine.indexOf('price_zone1'),
    delta: headerLine.indexOf('delta'),
    source_url: headerLine.indexOf('source_url'),
    note: headerLine.indexOf('note'),
  };

  if (colIndex.effective_at === -1 || colIndex.product === -1 || colIndex.price_zone1 === -1) {
    return {
      records: [],
      errors: [
        'Header CSV thiếu các cột bắt buộc: effective_at, product, price_zone1. Các cột được hỗ trợ: effective_at, product, price_zone1, delta, source_url, note',
      ],
    };
  }

  const records: FuelAdjustmentRecord[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;
    const line = rawLine.trim();
    if (!line) continue;
    const cols = splitRow(line);

    const rawEffective = cols[colIndex.effective_at]?.trim();
    const rawProduct = cols[colIndex.product]?.trim();
    const rawPrice = cols[colIndex.price_zone1]?.trim();
    const rawDelta = colIndex.delta !== -1 ? cols[colIndex.delta]?.trim() : '';
    const rawSource = colIndex.source_url !== -1 ? cols[colIndex.source_url]?.trim() : '';
    const rawNote = colIndex.note !== -1 ? cols[colIndex.note]?.trim() : '';

    if (!rawEffective) {
      errors.push(`Dòng ${i + 1}: Thiếu effective_at`);
      continue;
    }
    if (!rawProduct) {
      errors.push(`Dòng ${i + 1}: Thiếu product`);
      continue;
    }
    if (!rawPrice) {
      errors.push(`Dòng ${i + 1}: Thiếu price_zone1`);
      continue;
    }

    const priceNum = parseInt(rawPrice.replace(/[,\.]/g, ''), 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      errors.push(`Dòng ${i + 1}: price_zone1 không hợp lệ (${rawPrice})`);
      continue;
    }

    let deltaNum: number | null = null;
    if (rawDelta !== undefined && rawDelta !== '') {
      const parsedDelta = parseInt(rawDelta.replace(/[,\.\+]/g, ''), 10);
      if (!isNaN(parsedDelta)) {
        deltaNum = rawDelta.startsWith('-') ? -Math.abs(parsedDelta) : parsedDelta;
      }
    }

    records.push({
      effective_at: rawEffective,
      product: rawProduct,
      price_zone1: priceNum,
      delta: deltaNum,
      source_url: rawSource || null,
      note: rawNote || null,
    });
  }

  return { records, errors };
}

/**
 * POST /api/admin/fuel-history/import – Nhập lịch sử các kỳ điều hành xăng dầu từ CSV (hoặc JSON)
 * Bảo vệ bằng secret header (checkAdminAuth).
 */
app.post('/api/admin/fuel-history/import', async (c) => {
  if (!checkAdminAuth(c)) {
    return c.json({ success: false, error: 'Không được phép: thiếu hoặc sai secret key' }, 401);
  }

  try {
    let csvContent = '';
    const contentType = c.req.header('Content-Type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const file: any = formData.get('file') || formData.get('csv');
      if (file && typeof file === 'object' && typeof file.text === 'function') {
        csvContent = await file.text();
      } else if (typeof file === 'string') {
        csvContent = file;
      }
    } else if (contentType.includes('application/json')) {
      const json: any = await c.req.json();
      if (typeof json.csv === 'string') {
        csvContent = json.csv;
      } else if (Array.isArray(json.items)) {
        const count = await upsertFuelAdjustments(c.env.DB, json.items);
        return c.json({ success: true, count, totalRows: json.items.length });
      }
    } else {
      csvContent = await c.req.text();
    }

    if (!csvContent || csvContent.trim().length === 0) {
      return c.json({ success: false, error: 'Nội dung CSV rỗng hoặc không tìm thấy tệp đính kèm' }, 400);
    }

    const { records, errors } = parseFuelAdjustmentsCSV(csvContent);
    if (records.length === 0) {
      return c.json({ success: false, error: 'Không có dữ liệu hợp lệ để nhập', details: errors }, 400);
    }

    const count = await upsertFuelAdjustments(c.env.DB, records);

    await logIngest(
      c.env.DB,
      'Admin (Fuel Adjustments Import)',
      'ok',
      `Đã nhập thành công ${count}/${records.length} kỳ điều hành xăng dầu vào bảng fuel_adjustments`,
    );

    return c.json({
      success: true,
      count,
      totalRows: records.length,
      errors: errors.length > 0 ? errors : undefined,
      sample: records.slice(0, 3),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/api/admin/fuel-history/import] Error:', err);
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Lỗi khi nhập dữ liệu lịch sử điều hành xăng dầu',
      },
      500,
    );
  }
});

/**
 * GET /api/admin/fuel-history – Lấy danh sách các kỳ điều hành đã nhập vào fuel_adjustments
 */
app.get('/api/admin/fuel-history', async (c) => {
  if (!checkAdminAuth(c)) {
    return c.json({ success: false, error: 'Không được phép: thiếu hoặc sai secret key' }, 401);
  }

  const product = c.req.query('product');
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : 100;

  try {
    const items = await getFuelAdjustments(c.env.DB, { product, limit });
    const total = await countFuelAdjustments(c.env.DB);
    return c.json({
      success: true,
      total,
      count: items.length,
      items,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

const FUEL_NAMES_MAP: Record<string, string> = {
  RON95_V: 'Xăng E10 RON 95-V',
  RON95_III: 'Xăng E10 RON 95-III',
  RON92_E5: 'Xăng E5 RON 92-II',
  DO0005: 'Dầu DO 0,05S-II',
  DO001: 'Dầu DO 0,001S-V',
};

const STANDARD_FUEL_KEYS = ['RON95_V', 'RON95_III', 'RON92_E5', 'DO0005', 'DO001'] as const;

/**
 * GET /api/admin/fuel – Lấy 5 dòng giá hiện tại và danh sách gợi ý đang chờ duyệt
 */
app.get('/api/admin/fuel', async (c) => {
  if (!checkAdminAuth(c)) {
    return c.json({ success: false, error: 'Không được phép: thiếu hoặc sai secret key' }, 401);
  }

  try {
    const latestManual = await getLatestFuelManual(c.env.DB);
    const manualMap = new Map(latestManual.map((m) => [m.symbol, m]));

    // Đảm bảo đủ 5 dòng chuẩn: E10 RON 95-V, E10 RON 95-III, E5 RON 92-II, DO 0,05S-II, DO 0,001S-V
    const current = STANDARD_FUEL_KEYS.map((sym) => {
      const existing = manualMap.get(sym);
      return {
        symbol: sym,
        name: FUEL_NAMES_MAP[sym] || sym,
        price_zone1: existing?.price_zone1 ?? 0,
        price_zone2: existing?.price_zone2 ?? 0,
        effective_at: existing?.effective_at ?? new Date().toISOString().slice(0, 16).replace('T', ' '),
        note: existing?.note ?? '',
        id: existing?.id,
      };
    });

    const suggestions = await getPendingFuelSuggestions(c.env.DB);

    // Kiểm tra xem có gợi ý nào khác giá đang hiển thị không (Yêu cầu 4)
    const hasDifference = suggestions.some((s) => {
      const cur = manualMap.get(s.symbol);
      return cur ? Math.abs(cur.price_zone1 - s.price_zone1) > 1 : true;
    });

    return c.json({
      success: true,
      data: {
        current,
        suggestions,
        hasDifference,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

/**
 * POST /api/admin/fuel – Nhập giá xăng dầu thủ công 5 dòng (Yêu cầu 1)
 */
app.post('/api/admin/fuel', async (c) => {
  if (!checkAdminAuth(c)) {
    return c.json({ success: false, error: 'Không được phép: thiếu hoặc sai secret key' }, 401);
  }

  try {
    const body = await c.req.json();
    const items = Array.isArray(body) ? body : (Array.isArray(body.items) ? body.items : [body]);

    if (!items || items.length === 0 || !items[0]?.symbol || typeof items[0]?.price_zone1 !== 'number') {
      return c.json({ success: false, error: 'Dữ liệu không hợp lệ: cần symbol và price_zone1 (number)' }, 400);
    }

    const inserted: FuelManualRecord[] = [];
    const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);

    for (const it of items) {
      if (!it.symbol || typeof it.price_zone1 !== 'number') continue;

      const effectiveAt = it.effective_at || nowIso;
      const manualRecord: FuelManualRecord = {
        symbol: it.symbol,
        price_zone1: it.price_zone1,
        price_zone2: it.price_zone2 ?? null,
        effective_at: effectiveAt,
        note: it.note ?? null,
      };

      await insertFuelManual(c.env.DB, manualRecord);

      // Đồng bộ ngay vào bảng prices với nguồn chính thức theo yêu cầu 6
      const name = FUEL_NAMES_MAP[it.symbol] ?? it.name ?? it.symbol;
      await upsertPrices(c.env.DB, [
        {
          symbol: it.symbol,
          name,
          category: 'fuel',
          ask: it.price_zone1,
          bid: it.price_zone2 ?? null,
          unit: 'VND/lít',
          change_pct: 0,
          source: 'Petrolimex (thông cáo điều hành giá), cập nhật thủ công',
          fetched_at: nowIso,
          effective_at: effectiveAt,
          stale: 0,
        },
      ]);

      // Cập nhật nến ngày
      const candleDate = effectiveAt.slice(0, 10);
      await updateTodayCandle(c.env.DB, it.symbol, candleDate, it.price_zone1, 'Thủ công');

      // Tự động ghi vào fuel_adjustments để đối chiếu nhận định
      let delta = typeof it.delta === 'number' ? it.delta : null;
      if (delta === null) {
        const prevAdj = await c.env.DB
          .prepare(
            `SELECT price_zone1 FROM fuel_adjustments WHERE product = ? AND effective_at < ? ORDER BY effective_at DESC LIMIT 1`
          )
          .bind(it.symbol, effectiveAt)
          .first<{ price_zone1: number }>();
        if (prevAdj && typeof prevAdj.price_zone1 === 'number') {
          delta = it.price_zone1 - prevAdj.price_zone1;
        }
      }

      await upsertFuelAdjustments(c.env.DB, [
        {
          effective_at: effectiveAt,
          product: it.symbol,
          price_zone1: it.price_zone1,
          delta,
          note: it.note ?? 'Cập nhật thủ công',
        },
      ]);

      inserted.push(manualRecord);
    }

    // Nếu có suggestion_id đi kèm, đánh dấu đã duyệt
    if (body.suggestion_id) {
      await updateFuelSuggestionStatus(c.env.DB, Number(body.suggestion_id), 'approved');
    }

    await logIngest(
      c.env.DB,
      'Admin (Manual Fuel)',
      'ok',
      `Đã cập nhật thủ công ${inserted.length} mã nhiên liệu: ${inserted.map((i) => `${i.symbol}=${i.price_zone1}`).join(', ')}`,
    );

    try {
      const origin = new URL(c.req.url).origin;
      await invalidateCache(`${origin}/api/prices`);
      await invalidateCache(`${origin}/api/prices?category=fuel`);
    } catch {
      // ignore
    }

    return c.json({
      success: true,
      data: {
        count: inserted.length,
        items: inserted,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/api/admin/fuel] Error:', err);
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Lỗi khi lưu giá xăng dầu thủ công',
        data: null,
      },
      500,
    );
  }
});

/**
 * POST /api/admin/fuel/approve-suggestion – Duyệt một chạm từ gợi ý (Yêu cầu 4)
 */
app.post('/api/admin/fuel/approve-suggestion', async (c) => {
  if (!checkAdminAuth(c)) {
    return c.json({ success: false, error: 'Không được phép: thiếu hoặc sai secret key' }, 401);
  }

  try {
    const body = await c.req.json();
    const id = body.id || body.suggestionId;
    if (!id) return c.json({ success: false, error: 'Thiếu suggestion ID' }, 400);

    const suggestion = await getFuelSuggestionById(c.env.DB, Number(id));
    if (!suggestion) return c.json({ success: false, error: 'Không tìm thấy gợi ý' }, 404);

    const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const effectiveAt = suggestion.effective_at || nowIso;

    const manualRecord: FuelManualRecord = {
      symbol: suggestion.symbol,
      price_zone1: suggestion.price_zone1,
      price_zone2: suggestion.price_zone2 ?? null,
      effective_at: effectiveAt,
      note: `Duyệt từ ${suggestion.source}`,
    };
    await insertFuelManual(c.env.DB, manualRecord);
    await updateFuelSuggestionStatus(c.env.DB, Number(id), 'approved');

    const name = FUEL_NAMES_MAP[suggestion.symbol] ?? suggestion.name ?? suggestion.symbol;
    await upsertPrices(c.env.DB, [
      {
        symbol: suggestion.symbol,
        name,
        category: 'fuel',
        ask: suggestion.price_zone1,
        bid: suggestion.price_zone2 ?? null,
        unit: 'VND/lít',
        change_pct: 0,
        source: 'Petrolimex (thông cáo điều hành giá), cập nhật thủ công',
        fetched_at: nowIso,
        effective_at: effectiveAt,
        stale: 0,
      },
    ]);

    await updateTodayCandle(c.env.DB, suggestion.symbol, effectiveAt.slice(0, 10), suggestion.price_zone1, 'Thủ công');

    // Tự động ghi vào fuel_adjustments để đối chiếu nhận định
    const prevAdj = await c.env.DB
      .prepare(
        `SELECT price_zone1 FROM fuel_adjustments WHERE product = ? AND effective_at < ? ORDER BY effective_at DESC LIMIT 1`
      )
      .bind(suggestion.symbol, effectiveAt)
      .first<{ price_zone1: number }>();

    const delta = prevAdj && typeof prevAdj.price_zone1 === 'number'
      ? suggestion.price_zone1 - prevAdj.price_zone1
      : null;

    await upsertFuelAdjustments(c.env.DB, [
      {
        effective_at: effectiveAt,
        product: suggestion.symbol,
        price_zone1: suggestion.price_zone1,
        delta,
        note: `Duyệt từ ${suggestion.source}`,
      },
    ]);


    try {
      const origin = new URL(c.req.url).origin;
      await invalidateCache(`${origin}/api/prices`);
      await invalidateCache(`${origin}/api/prices?category=fuel`);
    } catch {}

    return c.json({ success: true, data: manualRecord, message: 'Đã duyệt gợi ý thành công' });
  } catch (err) {
    return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

/**
 * POST /api/admin/fuel/dismiss-suggestion – Bỏ qua gợi ý
 */
app.post('/api/admin/fuel/dismiss-suggestion', async (c) => {
  if (!checkAdminAuth(c)) {
    return c.json({ success: false, error: 'Không được phép: thiếu hoặc sai secret key' }, 401);
  }

  try {
    const body = await c.req.json();
    const id = body.id || body.suggestionId;
    if (!id) return c.json({ success: false, error: 'Thiếu suggestion ID' }, 400);

    await updateFuelSuggestionStatus(c.env.DB, Number(id), 'dismissed');
    return c.json({ success: true, message: 'Đã bỏ qua gợi ý thành công' });
  } catch (err) {
    return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

/**
 * POST /api/admin/fuel/trigger-ocr & POST /api/admin/fuel/ocr
 * Trích xuất bảng giá từ ảnh Petrolimex bằng AI Vision (OCR).
 * TUYỆT ĐỐI không ghi thẳng vào fuel_manual hay prices, CHỈ ghi vào fuel_suggestions.
 */
const handleFuelOcrTrigger = async (c: any) => {
  if (!checkAdminAuth(c)) {
    return c.json({ success: false, error: 'Không được phép: thiếu hoặc sai secret key' }, 401);
  }

  try {
    let imageUrl: string | null = null;
    let effectiveAt: string | null = null;

    try {
      const body = await c.req.json().catch(() => ({}));
      if (body && typeof body === 'object') {
        if (body.imageUrl && typeof body.imageUrl === 'string') imageUrl = body.imageUrl.trim();
        if (body.effectiveAt && typeof body.effectiveAt === 'string') effectiveAt = body.effectiveAt.trim();
      }
    } catch {}

    // Nếu không truyền URL ảnh cụ thể, tự tìm ảnh bảng giá trong thông cáo báo chí mới nhất
    if (!imageUrl) {
      const petrolimexInfo = await fetchPetrolimexPriceImageAndEffectiveAt();
      if (!petrolimexInfo || !petrolimexInfo.imageUrl) {
        return c.json(
          {
            success: false,
            error: 'Không tìm thấy ảnh bảng giá trong thông cáo báo chí Petrolimex gần nhất',
          },
          404,
        );
      }
      imageUrl = petrolimexInfo.imageUrl;
      if (!effectiveAt) effectiveAt = petrolimexInfo.effectiveAt;
    }

    // Lấy bảng giá fuel_manual mới nhất làm giá tham chiếu cho điều kiện lệch <= 10%
    const latestManual = await getLatestFuelManual(c.env.DB);
    const referenceMap = new Map<string, number>();
    for (const m of latestManual) {
      referenceMap.set(m.symbol, m.price_zone1);
    }

    // Xử lý OCR: tải ảnh, chạy 2 lần so sánh, validate đầy đủ
    const ocrResult = await processFuelImageOcr(
      imageUrl,
      c.env,
      referenceMap,
      effectiveAt ?? undefined,
    );

    // Lưu vào bảng fuel_suggestions (TUYỆT ĐỐI không ghi vào fuel_manual hay prices)
    const insertedRecords = [];
    for (const s of ocrResult.suggestions) {
      const id = await insertFuelSuggestion(c.env.DB, s);
      insertedRecords.push({ ...s, id });
    }

    await logIngest(
      c.env.DB,
      'Petrolimex (OCR)',
      ocrResult.validation.needsReview ? 'warning' : 'ok',
      `OCR hoàn tất cho ảnh: ${imageUrl}. Trích xuất ${insertedRecords.length} mặt hàng. Cần duyệt: ${ocrResult.validation.needsReview ? 'CÓ' : 'KHÔNG'}. Ghi chú: ${ocrResult.validation.reasons.join('; ') || 'Hợp lệ'}`,
    );

    return c.json({
      success: true,
      data: {
        imageUrl,
        effectiveAt,
        items: insertedRecords,
        validation: ocrResult.validation,
        isConsistent: ocrResult.isConsistent,
        diffDetails: ocrResult.diffDetails,
      },
      message: `Đã xử lý OCR thành công. ${insertedRecords.length} gợi ý đã được lưu vào hệ thống để chờ duyệt.`,
    });
  } catch (err) {
    console.error('[/api/admin/fuel/trigger-ocr] Error:', err);
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Lỗi trong quá trình xử lý OCR',
      },
      500,
    );
  }
};

app.post('/api/admin/fuel/trigger-ocr', handleFuelOcrTrigger);
app.post('/api/admin/fuel/ocr', handleFuelOcrTrigger);

// ─── Forecast Routes (Nhận định giá xăng dầu) ────────────────────────────────

/**
 * POST /api/admin/forecast/run – Chạy bộ tính nhận định giá xăng dầu và lưu vào bảng forecasts
 */
app.post('/api/admin/forecast/run', async (c) => {
  if (!checkAdminAuth(c)) {
    return c.json({ success: false, error: 'Không được phép: thiếu hoặc sai secret key' }, 401);
  }

  try {
    let options = {};
    try {
      options = await c.req.json();
    } catch {}

    const result = await generateForecast(c.env.DB, { ...options, env: c.env });
    return c.json({
      success: true,
      count: result.forecasts.length,
      status: result.status,
      backtestAccuracy: result.backtestAccuracy,
      reasons: result.reasons,
      forecasts: result.forecasts,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/api/admin/forecast/run] Error:', err);
    return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

/**
 * GET /api/forecast/accuracy – Thống kê độ chính xác của nhận định xăng dầu
 * (số nhận định, số đúng, tỷ lệ đúng tổng và theo 10 kỳ gần nhất, trạng thái tự tắt)
 */
app.get('/api/forecast/accuracy', async (c) => {
  try {
    const stats = await getForecastAccuracyStats(c.env.DB);
    return c.json({
      success: true,
      data: stats,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/api/forecast/accuracy] Error:', err);
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Lỗi lấy thống kê độ chính xác nhận định',
      },
      500,
    );
  }
});

/**
 * GET /api/forecast/latest & GET /api/admin/forecast/latest – Lấy danh sách nhận định mới nhất theo từng sản phẩm
 */
const handleGetLatestForecast = async (c: any) => {
  try {
    const stats = await getForecastAccuracyStats(c.env.DB);
    const rows = await c.env.DB.prepare(
      `SELECT * FROM forecasts WHERE id IN (
        SELECT MAX(id) FROM forecasts GROUP BY product
      ) ORDER BY id ASC`
    ).all();

    const items = (rows.results || []).map((item: any) => {
      if (stats.is_auto_shutoff) {
        return {
          ...item,
          status: 'insufficient_data',
          display_status: 'Chưa đủ cơ sở nhận định',
        };
      }
      return item;
    });

    const responseData = {
      count: items.length,
      is_auto_shutoff: stats.is_auto_shutoff,
      display_status: stats.display_status,
      items,
      accuracyStats: {
        total_evaluations: stats.total_evaluations,
        total_hits: stats.total_hits,
        overall_accuracy_pct: stats.overall_accuracy_pct,
        recent_evaluations: stats.recent_evaluations,
        recent_hits: stats.recent_hits,
        recent_accuracy_pct: stats.recent_accuracy_pct,
      },
      updatedAt: new Date().toISOString(),
    };

    return c.json({
      success: true,
      data: responseData,
      ...responseData,
    });
  } catch (err) {
    return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
};

app.get('/api/forecast/latest', handleGetLatestForecast);
app.get('/api/admin/forecast/latest', handleGetLatestForecast);

/**
 * GET /api/admin/forecast/backtest-report – Lấy báo cáo kết quả backtest chi tiết
 */
app.get('/api/admin/forecast/backtest-report', async (c) => {
  try {
    const adjStmt = await c.env.DB
      .prepare('SELECT effective_at, product, price_zone1, delta FROM fuel_adjustments ORDER BY effective_at ASC')
      .all();
    const candleStmt = await c.env.DB
      .prepare("SELECT symbol, date, close FROM daily_candles WHERE symbol IN ('RB=F', 'HO=F', 'BZ=F', 'USD/VND', 'USD_VND') ORDER BY date ASC")
      .all();

    const report = runBacktest({
      adjustments: (adjStmt.results || []) as any,
      candles: (candleStmt.results || []) as any,
    });

    return c.json({
      success: true,
      data: report,
      config: FORECAST_CONFIG,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

/** Catch-all 404 – trả JSON thống nhất */
app.notFound((c) =>
  c.json(
    {
      success: false,
      error: `Endpoint không tồn tại: ${c.req.method} ${new URL(c.req.url).pathname}`,
      data: null,
      updatedAt: null,
    },
    404,
  ),
);

/** Error handler */
app.onError((err, c) => {
  console.error('[Unhandled]', err);
  return c.json(
    {
      success: false,
      error: 'Lỗi máy chủ nội bộ',
      data: null,
      updatedAt: null,
    },
    500,
  );
});

// ─── Scheduled Handler (Cron Triggers) ────────────────────────────────────────
const scheduled: ExportedHandlerScheduledHandler<Env> = async (_event, env, ctx) => {
  ctx.waitUntil(
    Promise.all([
      runFetchAll(env).then((results) => {
        const errors = results.filter((r) => r.error);
        if (errors.length > 0) {
          console.error('[Cron] Lỗi adapter:', JSON.stringify(errors));
        } else {
          console.log('[Cron] Fetch hoàn tất:', JSON.stringify(results));
        }
      }),
      generateForecast(env.DB, { env })
        .then((res) => {
          console.log(`[Cron] Đã chạy nhận định giá xăng hằng ngày: ${res.forecasts.length} sản phẩm, status=${res.status}`);
        })
        .catch((e) => console.error('[Cron] Lỗi nhận định giá xăng:', e)),
    ]),
  );
};

// ─── Export ───────────────────────────────────────────────────────────────────
export default {
  fetch: app.fetch,
  scheduled,
} satisfies ExportedHandler<Env>;
