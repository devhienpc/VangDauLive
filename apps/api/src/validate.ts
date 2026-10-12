// src/validate.ts – Query param validation helpers

export type RangeParam = '30d' | '90d' | '1y';

const VALID_RANGES: RangeParam[] = ['30d', '90d', '1y'];
const RANGE_TO_DAYS: Record<RangeParam, number> = {
  '30d': 30,
  '90d': 90,
  '1y':  365,
};

const VALID_CATEGORIES = ['gold', 'silver', 'fuel', 'forex', 'oil'] as const;
export type CategoryParam = (typeof VALID_CATEGORIES)[number];

/** Parse và validate query param `range`. Trả về số ngày. */
export function parseRange(raw: string | undefined | null): { days: number; range: RangeParam } {
  const r = (raw ?? '30d').toLowerCase() as RangeParam;
  if (!VALID_RANGES.includes(r)) {
    return { days: 30, range: '30d' };
  }
  return { days: RANGE_TO_DAYS[r], range: r };
}

/** Parse comma-separated symbols. Trả về mảng symbol uppercase, max 10. */
export function parseSymbols(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0 && s.length <= 20)  // max 20 ký tự mỗi symbol
    .slice(0, 10);  // max 10 symbols
}

/** Parse và clamp limit param. */
export function parseLimit(raw: string | undefined | null, def = 10, max = 50): number {
  const n = parseInt(raw ?? String(def), 10);
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(n, max);
}

/** Validate category param. */
export function parseCategory(raw: string | undefined | null): CategoryParam | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (VALID_CATEGORIES.includes(lower as CategoryParam)) {
    return lower as CategoryParam;
  }
  return null;
}

/** Trả về lỗi 400 chuẩn. */
export function badRequest(message: string) {
  return Response.json(
    { success: false, error: message, data: null, updatedAt: null },
    { status: 400, headers: { 'Content-Type': 'application/json' } },
  );
}
