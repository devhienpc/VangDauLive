// src/adapters/fuel.ts
// Adapter giá xăng dầu Việt Nam (Petrolimex & WebGia)
// - Parse bảng webgia.com/gia-xang-dau/petrolimex/, lấy giá Vùng 1 cho:
//   + RON 95-III / E10 RON 95-III (symbol: RON95_III)
//   + E5 RON 92-II (symbol: RON92_E5)
//   + DO 0,05S-II (symbol: DO0005)
//   + DO 0,001S-V (symbol: DO001)
// - Unit = 'VND/lít'
// - Đọc mốc "Cập nhật lúc": nếu > 3 ngày thì đánh dấu stale=1, warning: nguồn có thể đã cũ
// - Đối chiếu chéo 2 nguồn nếu lệch > 1% thì cảnh báo và không tự ghi đè

import type { PriceRecord, FuelSuggestionRecord } from '../types.js';

const WEBGIA_FUEL_URL = 'https://webgia.com/gia-xang-dau/petrolimex/';

export interface FuelTimeInfo {
  rawTime: string | null;
  effectiveAt: string | null;
  timestamp: number | null;
  diffDays: number | null;
  isStale: boolean;
  warning?: string | undefined;
}

/**
 * Xử lý số tiền trong bảng xăng dầu: "28.250" -> 28250, "-" -> null
 */
export function parseFuelPrice(raw?: string | null): number | null {
  if (!raw || raw.trim() === '-' || raw.trim() === '') return null;
  const cleaned = raw.replace(/\./g, '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Đọc mốc thời gian "Cập nhật lúc" từ HTML
 * Hỗ trợ các định dạng:
 * - "- Cập nhật lúc 14:02:05 01/10/2026"
 * - "mới nhất vào lúc <strong>14:02:05 01/10/2026</strong>"
 * - "Cập nhật lúc 01/10/2026"
 */
export function extractWebGiaFuelEffectiveTime(html: string): FuelTimeInfo {
  // Regex tìm mốc thời gian kèm giờ và ngày
  const withTimeMatch =
    html.match(/[Cc]ập nhật lúc\s*([0-9]{1,2}:[0-9]{1,2}(?::[0-9]{1,2})?)\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i) ||
    html.match(/vào lúc\s*(?:<[^>]+>)?\s*([0-9]{1,2}:[0-9]{1,2}(?::[0-9]{1,2})?)\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i);

  let timeStr = '00:00:00';
  let dateStr: string | null = null;
  let rawTime: string | null = null;

  if (withTimeMatch && withTimeMatch[1] && withTimeMatch[2]) {
    timeStr = withTimeMatch[1];
    dateStr = withTimeMatch[2];
    rawTime = `${timeStr} ${dateStr}`;
  } else {
    // Chỉ có ngày
    const dateOnlyMatch = html.match(/[Cc]ập nhật lúc\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i);
    if (dateOnlyMatch && dateOnlyMatch[1]) {
      dateStr = dateOnlyMatch[1];
      rawTime = dateStr;
    }
  }

  if (!dateStr) {
    return {
      rawTime: null,
      effectiveAt: null,
      timestamp: null,
      diffDays: null,
      isStale: false,
    };
  }

  const [day, month, year] = dateStr.split('/').map(Number);
  const timeParts = timeStr.split(':').map(Number);
  const hour = timeParts[0] ?? 0;
  const min = timeParts[1] ?? 0;
  const sec = timeParts[2] ?? 0;

  // Giờ Việt Nam là UTC+7
  const pad = (n: number) => String(n).padStart(2, '0');
  const effectiveAt = `${year}-${pad(month ?? 1)}-${pad(day ?? 1)} ${pad(hour)}:${pad(min)}:${pad(sec)}`;
  const timestamp = Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1, hour - 7, min, sec);

  const now = Date.now();
  const diffDays = (now - timestamp) / (1000 * 60 * 60 * 24);
  const isStale = diffDays > 3;

  return {
    rawTime,
    effectiveAt,
    timestamp,
    diffDays,
    isStale,
    warning: isStale ? 'warning: nguồn có thể đã cũ' : undefined,
  };
}

/**
 * Đối chiếu chéo 2 nguồn: nếu lệch quá 1% thì cảnh báo và không tự ghi đè
 */
export function crossCheckFuelPrices(
  recordA: PriceRecord,
  recordB: PriceRecord,
): { match: boolean; diffPct: number; warning?: string } {
  const priceA = recordA.ask ?? recordA.bid ?? 0;
  const priceB = recordB.ask ?? recordB.bid ?? 0;

  if (priceA <= 0 || priceB <= 0) {
    return { match: true, diffPct: 0 };
  }

  const base = Math.max(priceA, priceB);
  const diffPct = Math.round((Math.abs(priceA - priceB) / base) * 10000) / 10000;

  if (diffPct > 0.01) {
    const pctDisplay = (diffPct * 100).toFixed(2);
    return {
      match: false,
      diffPct,
      warning: `[Đối chiếu chéo] Nguồn '${recordA.source}' (${priceA}) và '${recordB.source}' (${priceB}) lệch ${pctDisplay}% (> 1%) cho mã ${recordA.symbol}. Cảnh báo: không tự ghi đè, chờ duyệt.`,
    };
  }

  return { match: true, diffPct };
}

/**
 * Parse bảng HTML xăng dầu Petrolimex từ webgia.com
 */
export function parsePetrolimexHtml(html: string): PriceRecord[] {
  const records: PriceRecord[] = [];
  const fetchedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const timeInfo = extractWebGiaFuelEffectiveTime(html);

  // Cấu hình các loại nhiên liệu cần bóc tách (hỗ trợ cả tên mới E10 và tên cũ)
  const targets: Array<{
    matchPatterns: string[];
    symbol: string;
    name: string;
  }> = [
    {
      matchPatterns: ['Xăng E10 RON 95-V', 'E10 RON 95-V', 'Xăng RON 95-V', 'RON 95-V'],
      symbol: 'RON95_V',
      name: 'Xăng E10 RON 95-V',
    },
    {
      matchPatterns: ['Xăng E10 RON 95-III', 'E10 RON 95-III', 'Xăng RON 95-III', 'RON 95-III'],
      symbol: 'RON95_III',
      name: 'Xăng RON 95-III',
    },
    {
      matchPatterns: ['Xăng E5 RON 92-II', 'E5 RON 92-II', 'Xăng E5'],
      symbol: 'RON92_E5',
      name: 'Xăng E5 RON 92-II',
    },
    {
      matchPatterns: ['DO 0,05S-II', '0,05S-II', 'DO 0.05S'],
      symbol: 'DO0005',
      name: 'Dầu DO 0.05S-II',
    },
    {
      matchPatterns: ['DO 0,001S-V', '0,001S-V', 'DO 0.001S'],
      symbol: 'DO001',
      name: 'Dầu DO 0.001S-V',
    },
  ];

  // Duyệt qua các hàng <tr> trong bảng
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowContent = rowMatch[1] ?? '';

    for (const target of targets) {
      // Kiểm tra tên sản phẩm
      const isMatch = target.matchPatterns.some((pattern) => rowContent.includes(pattern));
      if (!isMatch) continue;

      // Không lặp lại nếu đã trích xuất
      if (records.some((r) => r.symbol === target.symbol)) continue;

      // Trích xuất các ô <td> (cột 1 = Vùng 1, cột 2 = Vùng 2)
      const tdMatches = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
        (m[1] ?? '').replace(/<[^>]+>/g, '').trim(),
      );

      if (tdMatches.length >= 1 && tdMatches[0]) {
        const vung1Price = parseFuelPrice(tdMatches[0]);

        if (vung1Price != null && vung1Price > 0) {
          records.push({
            symbol: target.symbol,
            name: target.name,
            category: 'fuel',
            bid: null,
            ask: vung1Price,
            unit: 'VND/lít',
            source: 'WebGia (Petrolimex)',
            fetched_at: fetchedAt,
            effective_at: timeInfo.effectiveAt,
            stale: timeInfo.isStale ? 1 : 0,
          });
        }
      }
    }
  }

  return records;
}

/**
 * Fetch và parse bảng giá xăng dầu Petrolimex từ webgia.com
 */
export async function fetchFuelPrices(): Promise<{
  records: PriceRecord[];
  sourceUsed: string;
  isStale?: boolean;
  effectiveAt?: string | null;
  warning?: string | undefined;
}> {
  const res = await fetch(WEBGIA_FUEL_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`WebGia Petrolimex trả về HTTP ${res.status}`);
  }

  const html = await res.text();
  const timeInfo = extractWebGiaFuelEffectiveTime(html);
  const records = parsePetrolimexHtml(html);

  if (records.length === 0) {
    throw new Error('Không parse được bản ghi xăng dầu nào từ HTML WebGia');
  }

  return {
    records,
    sourceUsed: 'WebGia (Petrolimex)',
    isStale: timeInfo.isStale,
    effectiveAt: timeInfo.effectiveAt,
    warning: timeInfo.warning,
  };
}

/**
 * Trích xuất giá từ văn bản thông cáo báo chí điều hành giá Petrolimex bằng Regex (Yêu cầu 3 & 7)
 * KHÔNG đọc ảnh, chỉ trích phần văn bản (nếu có).
 */
export function extractPricesFromAnnouncementText(text: string): FuelSuggestionRecord[] {
  const suggestions: FuelSuggestionRecord[] = [];

  // 1. Trích xuất mốc thời gian có hiệu lực
  let effectiveAt: string | null = null;
  const timeMatch1 = text.match(/từ\s*(\d{1,2})\s*giờ\s*(\d{1,2})\s*phút\s*ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/i);
  const timeMatch2 = text.match(/từ\s*(\d{1,2})h(\d{2})?\s*ngày\s*(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})/i);
  const timeMatch3 = text.match(/ngày\s*(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})/i);

  const pad = (n: number | string) => String(n).padStart(2, '0');

  if (timeMatch1 && timeMatch1[1] && timeMatch1[3] && timeMatch1[4] && timeMatch1[5]) {
    const [, h, min, d, m, y] = timeMatch1;
    effectiveAt = `${y}-${pad(m!)}-${pad(d!)} ${pad(h!)}:${pad(min || '00')}:00`;
  } else if (timeMatch2 && timeMatch2[1] && timeMatch2[3] && timeMatch2[4] && timeMatch2[5]) {
    const [, h, min, d, m, y] = timeMatch2;
    effectiveAt = `${y}-${pad(m!)}-${pad(d!)} ${pad(h!)}:${pad(min || '00')}:00`;
  } else if (timeMatch3 && timeMatch3[1] && timeMatch3[2] && timeMatch3[3]) {
    const [, d, m, y] = timeMatch3;
    effectiveAt = `${y}-${pad(m!)}-${pad(d!)} 15:00:00`;
  }

  // 2. Cấu hình 5 loại nhiên liệu chính của Petrolimex
  const targets = [
    {
      symbol: 'RON95_V',
      name: 'Xăng E10 RON 95-V',
      patterns: [/E10\s*RON\s*95-V/i, /RON\s*95-V/i],
    },
    {
      symbol: 'RON95_III',
      name: 'Xăng E10 RON 95-III',
      patterns: [/E10\s*RON\s*95-III/i, /RON\s*95-III/i],
    },
    {
      symbol: 'RON92_E5',
      name: 'Xăng E5 RON 92-II',
      patterns: [/E5\s*RON\s*92-II/i, /E5\s*RON\s*92/i, /Xăng\s*E5/i],
    },
    {
      symbol: 'DO0005',
      name: 'Dầu DO 0,05S-II',
      patterns: [/0[,\.]05S-II/i, /0[,\.]05S/i, /DO\s*0[,\.]05/i, /điêzen\s*0[,\.]05/i],
    },
    {
      symbol: 'DO001',
      name: 'Dầu DO 0,001S-V',
      patterns: [/0[,\.]001S-V/i, /0[,\.]001S/i, /DO\s*0[,\.]001/i, /điêzen\s*0[,\.]001/i],
    },
  ];

  // Tách từng dòng hoặc câu
  const lines = text.split(/[\r\n;]+/).map((l) => l.trim()).filter(Boolean);

  for (const target of targets) {
    for (const line of lines) {
      const isMatch = target.patterns.some((p) => p.test(line));
      if (!isMatch) continue;

      if (suggestions.some((s) => s.symbol === target.symbol)) continue;

      // Trích xuất các số dạng giá tiền VN (e.g. 28.250 hoặc 28250)
      const numMatches = [...line.matchAll(/\b(\d{2}[\.,]\d{3})\b/g)].map((m) =>
        parseFloat((m[1] || '').replace(/[\.,]/g, '')),
      );

      const firstPrice = numMatches[0];
      if (firstPrice != null && firstPrice > 10000 && firstPrice < 100000) {
        const zone1 = firstPrice;
        const secondPrice = numMatches[1];
        const zone2 =
          secondPrice != null && secondPrice > 10000 && secondPrice < 100000
            ? secondPrice
            : null;

        suggestions.push({
          source: 'Petrolimex (Thông cáo)',
          symbol: target.symbol,
          name: target.name,
          price_zone1: zone1,
          price_zone2: zone2,
          effective_at: effectiveAt,
          raw_text: line.slice(0, 200),
          status: 'pending',
        });
      }
    }
  }

  return suggestions;
}

/**
 * Đọc bài thông cáo báo chí điều hành giá mới nhất từ website Petrolimex
 */
export async function fetchPetrolimexAnnouncementText(): Promise<{ text: string; url: string } | null> {
  const listUrl = 'https://www.petrolimex.com.vn/nd/thong-cao-bao-chi.html';
  try {
    const listRes = await fetch(listUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!listRes.ok) return null;
    const listHtml = await listRes.text();

    const linkMatches = [...listHtml.matchAll(/href="([^"]*(?:dieu-chinh-gia|gia-xang-dau)[^"]*)"/gi)];
    if (linkMatches.length === 0 || !linkMatches[0] || !linkMatches[0][1]) return null;

    let targetHref = linkMatches[0][1];
    if (targetHref.startsWith('/')) {
      targetHref = `https://www.petrolimex.com.vn${targetHref}`;
    }

    const artRes = await fetch(targetHref, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!artRes.ok) return null;
    const artHtml = await artRes.text();

    const cleanText = artHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');

    return { text: cleanText, url: targetHref };
  } catch (err) {
    console.warn('[Petrolimex Scraper] Lỗi đọc thông cáo:', err);
    return null;
  }
}

/**
 * Thu thập gợi ý xăng dầu tự động (Yêu cầu 3):
 * Mỗi ngày chạy:
 * (a) parse WebGia (kiểm tra mốc "Cập nhật lúc", bỏ qua nếu cũ hơn 3 ngày)
 * (b) đọc trang thông cáo báo chí của Petrolimex và thử trích giá từ phần văn bản bằng regex (không đọc ảnh)
 * Kết quả trả về gợi ý, KHÔNG ghi đè giá hiển thị
 */
export async function fetchFuelSuggestions(): Promise<{
  suggestions: FuelSuggestionRecord[];
  warnings: string[];
}> {
  const suggestions: FuelSuggestionRecord[] = [];
  const warnings: string[] = [];

  // (a) Parse WebGia
  try {
    const res = await fetch(WEBGIA_FUEL_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const html = await res.text();
      const timeInfo = extractWebGiaFuelEffectiveTime(html);

      if (timeInfo.isStale) {
        warnings.push(`WebGia bị bỏ qua vì mốc cập nhật (${timeInfo.rawTime ?? 'N/A'}) cũ hơn 3 ngày.`);
      } else {
        const records = parsePetrolimexHtml(html);
        for (const r of records) {
          if (r.ask != null) {
            suggestions.push({
              source: 'WebGia',
              symbol: r.symbol,
              name: r.name,
              price_zone1: r.ask,
              price_zone2: r.bid ?? null,
              effective_at: r.effective_at ?? timeInfo.effectiveAt,
              raw_text: `WebGia lúc ${timeInfo.rawTime ?? 'N/A'}`,
              status: 'pending',
            });
          }
        }
      }
    } else {
      warnings.push(`WebGia trả về HTTP ${res.status}`);
    }
  } catch (err) {
    warnings.push(`Lỗi kết nối WebGia: ${err instanceof Error ? err.message : String(err)}`);
  }

  // (b) Đọc thông cáo báo chí Petrolimex (chỉ regex văn bản, không đọc ảnh)
  try {
    const art = await fetchPetrolimexAnnouncementText();
    if (art && art.text) {
      const extracted = extractPricesFromAnnouncementText(art.text);
      if (extracted.length > 0) {
        for (const s of extracted) {
          if (!suggestions.some((x) => x.symbol === s.symbol)) {
            suggestions.push(s);
          }
        }
      } else {
        warnings.push('Thông cáo báo chí Petrolimex không chứa bảng giá dạng văn bản (đăng dạng ảnh, bỏ qua theo yêu cầu).');
      }
    }
  } catch (err) {
    warnings.push(`Lỗi kết nối Petrolimex: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { suggestions, warnings };
}

