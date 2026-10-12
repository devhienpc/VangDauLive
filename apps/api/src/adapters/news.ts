// src/adapters/news.ts
// Adapter thu thập tin tức kinh tế / thị trường từ RSS feeds:
// VnExpress, CafeF, VietnamBiz, Tuổi Trẻ
// Lọc theo từ khóa, cắt tóm tắt tối đa 200 ký tự, chống trùng bằng url UNIQUE, xóa tin > 60 ngày.

import { insertNewsItems, cleanupOldNews, logIngest } from '../db.js';

export interface RssFeedConfig {
  source: string;
  url: string;
}

export const RSS_FEEDS: RssFeedConfig[] = [
  { source: 'VnExpress', url: 'https://vnexpress.net/rss/kinh-doanh.rss' },
  { source: 'CafeF', url: 'https://cafef.vn/thi-truong.rss' },
  { source: 'CafeF', url: 'https://cafef.vn/tai-chinh-quoc-te.rss' },
  { source: 'VietnamBiz', url: 'https://vietnambiz.vn/rss/hang-hoa.rss' },
  { source: 'VietnamBiz', url: 'https://vietnambiz.vn/rss/tai-chinh.rss' },
  { source: 'Tuổi Trẻ', url: 'https://tuoitre.vn/rss/kinh-doanh.rss' },
];

export interface ParsedNewsItem {
  title: string;
  summary: string;
  category: 'Năng lượng' | 'Vàng & Kim loại' | 'Vĩ mô / Fed' | 'Ngoại tệ';
  url: string;
  source: string;
  published_at: string;
}

/**
 * Loại bỏ HTML tags, CDATA, unescape HTML entities và chuẩn hóa khoảng trắng
 */
export function cleanHtmlText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Phân loại bài viết theo từ khóa tiếng Việt liên quan đến tài chính, hàng hóa.
 * Trả về category tương ứng hoặc null nếu không phải tin liên quan.
 */
export function classifyNewsCategory(
  title: string,
  summary: string,
): 'Năng lượng' | 'Vàng & Kim loại' | 'Vĩ mô / Fed' | 'Ngoại tệ' | null {
  const text = `${title} ${summary}`.toLowerCase();

  // 1. Vàng & Kim loại (loại trừ các cụm dễ nhầm như "dân số vàng", "thời điểm vàng", "kho bạc")
  const goldRegex = /(giá vàng|vàng miếng|vàng nhẫn|vàng sjc|vàng 9999|vàng thế giới|\bxau\b|\bgold\b|\bsjc\b|kim loại quý|giá bạc|\bxag\b|\bsilver\b|\bdoji\b|\bpnj\b|bảo tín minh châu|bảo tín)/i;
  if (goldRegex.test(text)) {
    return 'Vàng & Kim loại';
  }

  // 2. Năng lượng (xăng dầu, dầu thô, petrolimex...)
  const energyRegex = /(giá xăng|xăng dầu|giá dầu|dầu thô|\bbrent\b|\bwti\b|petrolimex|nhiên liệu|\bopec\b|khí đốt|khí tự nhiên|ron\s*95|e5\s*ron|dầu diesel)/i;
  if (energyRegex.test(text)) {
    return 'Năng lượng';
  }

  // 3. Ngoại tệ (tỷ giá, usd, đô la, euro, yên, nhân dân tệ...)
  const forexRegex = /(tỷ giá|ngoại tệ|đồng usd|tiền tệ|giá usd|đồng đô la|\bdxy\b|nhân dân tệ|đồng euro|đồng yên|\bjpy\b|\bcny\b|chuyển đổi ngoại tệ)/i;
  if (forexRegex.test(text)) {
    return 'Ngoại tệ';
  }

  // 4. Vĩ mô / Fed (Fed, lãi suất, lạm phát, CPI, GDP, ngân hàng trung ương...)
  const macroRegex = /(\bfed\b|cục dự trữ liên bang|lãi suất điều hành|hạ lãi suất|tăng lãi suất|lạm phát|\bcpi\b|\bgdp\b|ngân hàng trung ương|vĩ mô|\bfomc\b|kinh tế vĩ mô|chính sách tiền tệ)/i;
  if (macroRegex.test(text)) {
    return 'Vĩ mô / Fed';
  }

  return null;
}

/**
 * Chuyển pubDate của RSS (RFC 2822 / Date string) thành chuẩn YYYY-MM-DD HH:mm:ss
 */
export function parsePubDate(rawDate?: string): string {
  if (!rawDate) return new Date().toISOString().replace('T', ' ').slice(0, 19);
  const parsed = new Date(rawDate);
  if (isNaN(parsed.getTime())) {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }
  return parsed.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Parse nội dung XML RSS của một nguồn, trích xuất và lọc các tin hợp lệ
 */
export function parseRssFeed(xml: string, sourceName: string): ParsedNewsItem[] {
  const items: ParsedNewsItem[] = [];
  const rawItems = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const rawItem of rawItems) {
    const titleMatch = rawItem.match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i);
    const linkMatch =
      rawItem.match(/<link[\s\S]*?>([\s\S]*?)<\/link>/i) ||
      rawItem.match(/<guid[\s\S]*?>([\s\S]*?)<\/guid>/i);
    const descMatch = rawItem.match(/<description[\s\S]*?>([\s\S]*?)<\/description>/i);
    const dateMatch = rawItem.match(/<pubDate[\s\S]*?>([\s\S]*?)<\/pubDate>/i);

    const title = cleanHtmlText(titleMatch?.[1] ?? '');
    const url = cleanHtmlText(linkMatch?.[1] ?? '');
    // Chỉ lưu tóm tắt tối đa 200 ký tự, KHÔNG sao chép nội dung đầy đủ bài viết
    const rawSummary = cleanHtmlText(descMatch?.[1] ?? '');
    const summary = rawSummary.length > 200 ? rawSummary.slice(0, 200).trim() + '...' : rawSummary;

    if (!title || !url) continue;

    // Lọc theo từ khóa liên quan
    const category = classifyNewsCategory(title, summary);
    if (!category) continue;

    const published_at = parsePubDate(dateMatch?.[1] ? cleanHtmlText(dateMatch[1]) : undefined);

    items.push({
      title,
      summary,
      category,
      url,
      source: sourceName,
      published_at,
    });
  }

  return items;
}

/**
 * Thu thập tin tức từ toàn bộ các nguồn RSS và lưu vào D1:
 * - Dùng Promise.allSettled để một nguồn lỗi không ảnh hưởng các nguồn khác
 * - Timeout mỗi request 8 giây
 * - Chống trùng bằng url UNIQUE (INSERT OR IGNORE)
 * - Tự động xóa tin tức cũ hơn 60 ngày
 */
export async function fetchAndStoreNews(db: D1Database): Promise<{
  totalFetched: number;
  totalInserted: number;
  deletedOld: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const allParsedItems: ParsedNewsItem[] = [];

  const fetchPromises = RSS_FEEDS.map(async (feed) => {
    try {
      const res = await fetch(feed.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const xml = await res.text();
      const items = parseRssFeed(xml, feed.source);
      allParsedItems.push(...items);
    } catch (err) {
      const msg = `${feed.source} (${feed.url}): ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      // Ghi log lỗi của nguồn RSS vào ingest_log
      await logIngest(db, `rss-${feed.source.toLowerCase()}`, 'error', msg);
    }
  });

  await Promise.allSettled(fetchPromises);

  // Lưu tin mới (chống trùng url UNIQUE)
  const totalInserted = await insertNewsItems(db, allParsedItems);

  // Xóa tin cũ hơn 60 ngày
  const deletedOld = await cleanupOldNews(db, 60);

  // Ghi log tổng kết
  await logIngest(
    db,
    'rss-news-ingest',
    errors.length === 0 ? 'ok' : 'error',
    `Đã crawl ${allParsedItems.length} tin liên quan, lưu mới ${totalInserted} tin, dọn dẹp ${deletedOld} tin cũ (>60 ngày). Lỗi nguồn: ${errors.length}`,
  );


  return {
    totalFetched: allParsedItems.length,
    totalInserted,
    deletedOld,
    errors,
  };
}
