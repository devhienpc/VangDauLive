// src/cache.ts – Workers Cache API helper
// Dùng Cloudflare Cache API để cache response ~30 phút

const CACHE_TTL_SECONDS = 1800; // 30 phút

/**
 * Tạo cache key chuẩn từ URL request.
 * Cache API của Workers dùng Request object làm key.
 */
function makeCacheKey(url: string): Request {
  return new Request(url, { method: 'GET' });
}

/**
 * Lấy response từ cache. Trả về null nếu không có.
 */
export async function getFromCache(url: string): Promise<Response | null> {
  try {
    const cache = await caches.open('vangdau:api');
    const cached = await cache.match(makeCacheKey(url));
    return cached ?? null;
  } catch {
    return null; // Cache API không available (local dev)
  }
}

/**
 * Lưu response vào cache với TTL.
 * Clone response trước khi lưu (Response chỉ đọc được 1 lần).
 */
export async function putInCache(url: string, response: Response): Promise<void> {
  try {
    const cache = await caches.open('vangdau:api');
    const toCache = new Response(response.clone().body, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers),
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
        'CDN-Cache-Control': `max-age=${CACHE_TTL_SECONDS}`,
        'Cloudflare-CDN-Cache-Control': `max-age=${CACHE_TTL_SECONDS}`,
      },
    });
    await cache.put(makeCacheKey(url), toCache);
  } catch {
    // Silently fail – cache là optimization, không phải yêu cầu bắt buộc
  }
}

/**
 * Xoá cache của một URL cụ thể (dùng sau khi fetch dữ liệu mới).
 */
export async function invalidateCache(url: string): Promise<void> {
  try {
    const cache = await caches.open('vangdau:api');
    await cache.delete(makeCacheKey(url));
  } catch {
    // Ignore
  }
}

/**
 * Header Cache-Control cho response trả về client.
 * 30 phút public cache, stale-while-revalidate 5 phút.
 */
export const CACHE_HEADERS = {
  'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, stale-while-revalidate=300`,
  'Vary': 'Accept-Encoding',
} as const;
