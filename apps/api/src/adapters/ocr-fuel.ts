// src/adapters/ocr-fuel.ts
// Module trích xuất giá xăng dầu từ ảnh bảng giá Petrolimex bằng Thị giác máy tính (VLM / OCR)
// Tuân thủ các nguyên tắc:
// 1. Chỉ ghi vào fuel_suggestions, TUYỆT ĐỐI không ghi đè giá hiển thị
// 2. Chạy mô hình 2 lần để đối chiếu, nếu lệch thì gắn cờ needs_review
// 3. Validate đầy đủ: đủ 5 sản phẩm, khoảng giá 10k-60k, lệch <=10% so với fuel_manual, zone2 >= zone1
// 4. Hỗ trợ Workers AI (@cf/moondream/moondream3.1-9B-A2B, @cf/meta/llama-3.2-11b-vision-instruct)
//    và dễ dàng đổi sang Claude API (qua ANTHROPIC_API_KEY)
// 5. Không in API key ra log

import type { Env, FuelSuggestionRecord } from '../types.js';

export interface OcrExtractedItem {
  product: string;
  symbol: string;
  name: string;
  zone1: number;
  zone2: number | null;
}

export interface OcrValidationResult {
  isValid: boolean;
  needsReview: boolean;
  flags: string[];
  reasons: string[];
}

export const TARGET_PRODUCTS = [
  {
    symbol: 'RON95_V',
    name: 'Xăng E10 RON 95-V',
    matchKeys: ['ron 95 mức 5', 'ron 95-v', 'e10 ron 95-v', 'ron 95 v', 'ron95-v'],
  },
  {
    symbol: 'RON95_III',
    name: 'Xăng E10 RON 95-III',
    matchKeys: ['ron 95 mức 3', 'ron 95-iii', 'e10 ron 95-iii', 'ron 95 iii', 'ron95-iii'],
  },
  {
    symbol: 'RON92_E5',
    name: 'Xăng E5 RON 92-II',
    matchKeys: ['ron 92 mức 2', 'ron 92-ii', 'e5 ron 92-ii', 'e5 ron 92', 'e5'],
  },
  {
    symbol: 'DO0005',
    name: 'Dầu DO 0,05S-II',
    matchKeys: ['0,05s mức 2', '0.05s mức 2', '0,05s-ii', '0.05s-ii', 'do 0,05s', 'điêzen 0,05s'],
  },
  {
    symbol: 'DO001',
    name: 'Dầu DO 0,001S-V',
    matchKeys: ['0,001s mức 5', '0.001s mức 5', '0,001s-v', '0.001s-v', 'do 0,001s', 'điêzen 0,001s'],
  },
];

export const OCR_SYSTEM_PROMPT = `Bạn là trợ lý OCR chuyên trích xuất dữ liệu bảng giá bán lẻ xăng dầu Petrolimex.
Hãy quan sát hình ảnh bảng giá và đọc chính xác giá Vùng 1 và Vùng 2 cho 5 mặt hàng sau:
1. Xăng E10 RON 95 Mức 5 (hoặc E10 RON 95-V)
2. Xăng E10 RON 95 Mức 3 (hoặc E10 RON 95-III)
3. Xăng E5 RON 92 Mức 2 (hoặc E5 RON 92-II)
4. Điêzen 0,05S Mức 2 (hoặc DO 0,05S-II)
5. Điêzen 0,001S Mức 5 (hoặc DO 0,001S-V)

YÊU CẦU BẮT BUỘC:
- Trả về DUY NHẤT một mảng JSON hợp lệ, KHÔNG bọc văn bản giải thích.
- Các trường: "product" (tên sản phẩm), "zone1" (số nguyên đơn vị đồng/lít, bỏ dấu chấm), "zone2" (số nguyên đơn vị đồng/lít).
- Ví dụ: 28.250 -> 28250, 28.810 -> 28810.

Ví dụ định dạng trả về:
[
  {"product": "E10 RON 95-V", "zone1": 29050, "zone2": 29630},
  {"product": "E10 RON 95-III", "zone1": 28250, "zone2": 28810},
  {"product": "E5 RON 92-II", "zone1": 27700, "zone2": 28250},
  {"product": "DO 0,05S-II", "zone1": 29120, "zone2": 29700},
  {"product": "DO 0,001S-V", "zone1": 30520, "zone2": 31130}
]`;

/**
 * Chuẩn hóa tên sản phẩm đọc được từ AI sang symbol chuẩn
 */
export function mapProductToSymbol(productName: string): { symbol: string; name: string } | null {
  const norm = productName.toLowerCase().trim();
  for (const target of TARGET_PRODUCTS) {
    if (target.matchKeys.some((k) => norm.includes(k))) {
      return { symbol: target.symbol, name: target.name };
    }
  }
  return null;
}

/**
 * Trích xuất mảng JSON an toàn từ phản hồi text của mô hình
 */
export function extractJsonFromAiResponse(rawText: string): any[] {
  if (!rawText) return [];

  // 1. Thử parse trực tiếp
  try {
    const direct = JSON.parse(rawText);
    if (Array.isArray(direct)) return direct;
    if (direct && Array.isArray(direct.items)) return direct.items;
  } catch {}

  // 2. Tìm khối ```json ... ```
  const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  // 3. Tìm regex mảng JSON [ ... ]
  const arrayMatch = rawText.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  return [];
}

/**
 * Gọi mô hình qua Workers AI
 */
async function callWorkersAi(imageBytes: ArrayBuffer, env: Env): Promise<string> {
  if (!env.AI) {
    throw new Error('Cloudflare Workers AI binding [env.AI] không khả dụng');
  }

  const imgArray = Array.from(new Uint8Array(imageBytes));

  // Thử mô hình Moondream (tối ưu cho OCR)
  try {
    const res = await env.AI.run('@cf/moondream/moondream3.1-9B-A2B', {
      image: imgArray,
      prompt: OCR_SYSTEM_PROMPT,
      max_tokens: 512,
    });
    return typeof res === 'string' ? res : (res?.description || res?.response || JSON.stringify(res));
  } catch (err) {
    // Fallback sang Llama 3.2 Vision nếu Moondream bận
    console.warn('[OCR Workers AI] Moondream gặp lỗi, fallback sang Llama 3.2 Vision:', err);
    const fallbackRes = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      image: imgArray,
      prompt: OCR_SYSTEM_PROMPT,
      max_tokens: 512,
    });
    return typeof fallbackRes === 'string' ? fallbackRes : (fallbackRes?.response || JSON.stringify(fallbackRes));
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Gọi mô hình qua Claude API (Anthropic Vision) nếu có cấu hình ANTHROPIC_API_KEY
 */
async function callClaudeVision(imageBytes: ArrayBuffer, apiKey: string): Promise<string> {
  const base64 = arrayBufferToBase64(imageBytes);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64,
              },
            },
            {
              type: 'text',
              text: OCR_SYSTEM_PROMPT,
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Claude API trả về mã lỗi HTTP ${res.status}`);
  }

  const data: any = await res.json();
  const textContent = data.content?.find((c: any) => c.type === 'text')?.text || '';
  return textContent;
}

/**
 * Đọc 1 lượt ảnh qua mô hình thị giác (chọn Claude nếu có key, ngược lại chọn Workers AI)
 */
export async function runSingleOcrPass(
  imageBytes: ArrayBuffer,
  env: Env,
): Promise<OcrExtractedItem[]> {
  let rawResponse = '';

  if (env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim().length > 0) {
    try {
      rawResponse = await callClaudeVision(imageBytes, env.ANTHROPIC_API_KEY);
    } catch (err) {
      console.warn('[OCR] Claude API gặp sự cố, thử qua Workers AI:', err);
      if (env.AI) {
        rawResponse = await callWorkersAi(imageBytes, env);
      } else {
        throw err;
      }
    }
  } else if (env.AI) {
    rawResponse = await callWorkersAi(imageBytes, env);
  } else {
    throw new Error('Chưa cấu hình dịch vụ AI (cần Workers AI binding hoặc secret ANTHROPIC_API_KEY)');
  }

  const rawJsonArray = extractJsonFromAiResponse(rawResponse);
  const results: OcrExtractedItem[] = [];

  for (const item of rawJsonArray) {
    const rawProd = String(item.product || item.name || '');
    const mapped = mapProductToSymbol(rawProd);
    if (!mapped) continue;

    const z1 = typeof item.zone1 === 'number' ? item.zone1 : parseInt(String(item.zone1).replace(/[\.,]/g, ''), 10);
    const z2 = item.zone2 != null
      ? (typeof item.zone2 === 'number' ? item.zone2 : parseInt(String(item.zone2).replace(/[\.,]/g, ''), 10))
      : null;

    if (!isNaN(z1) && z1 > 0) {
      // Tránh trùng lặp
      if (!results.some((r) => r.symbol === mapped.symbol)) {
        results.push({
          product: rawProd,
          symbol: mapped.symbol,
          name: mapped.name,
          zone1: z1,
          zone2: isNaN(z2 as number) ? null : z2,
        });
      }
    }
  }

  return results;
}

/**
 * Yêu cầu 3: So sánh 2 lần chạy mô hình. Nếu kết quả khác nhau thì gắn cờ needs_review
 */
export function compareTwoRuns(
  run1: OcrExtractedItem[],
  run2: OcrExtractedItem[],
): { isConsistent: boolean; diffDetails: string[] } {
  const diffDetails: string[] = [];
  const map1 = new Map(run1.map((r) => [r.symbol, r]));
  const map2 = new Map(run2.map((r) => [r.symbol, r]));

  const allSymbols = new Set([...map1.keys(), ...map2.keys()]);
  for (const sym of allSymbols) {
    const item1 = map1.get(sym);
    const item2 = map2.get(sym);
    if (!item1 || !item2) {
      diffDetails.push(`${sym}: Lần 1 ${item1 ? 'có' : 'thiếu'}, lần 2 ${item2 ? 'có' : 'thiếu'}`);
      continue;
    }
    if (item1.zone1 !== item2.zone1 || item1.zone2 !== item2.zone2) {
      diffDetails.push(
        `${sym}: Lần 1 (V1=${item1.zone1}, V2=${item1.zone2}) khác Lần 2 (V1=${item2.zone1}, V2=${item2.zone2})`,
      );
    }
  }

  return {
    isConsistent: diffDetails.length === 0,
    diffDetails,
  };
}

/**
 * Yêu cầu 4: Validate dữ liệu OCR:
 * - Đủ 5 sản phẩm
 * - Giá trong khoảng 10.000 - 60.000
 * - Lệch tối đa 10% so với bản ghi fuel_manual gần nhất (vượt thì gắn cờ)
 * - zone2 >= zone1
 */
export function validateOcrFuelData(
  items: Array<{ symbol: string; zone1: number; zone2?: number | null }>,
  referencePrices?: Map<string, number>,
): OcrValidationResult {
  const flags: string[] = [];
  const reasons: string[] = [];

  // 1. Đủ 5 sản phẩm
  const requiredSymbols = ['RON95_V', 'RON95_III', 'RON92_E5', 'DO0005', 'DO001'];
  const presentSymbols = new Set(items.map((i) => i.symbol));
  const missing = requiredSymbols.filter((s) => !presentSymbols.has(s));
  if (missing.length > 0) {
    flags.push('missing_products');
    reasons.push(`Thiếu ${missing.length} sản phẩm: ${missing.join(', ')}`);
  }

  for (const item of items) {
    // 2. Giá trong khoảng 10.000 - 60.000
    if (item.zone1 < 10000 || item.zone1 > 60000) {
      flags.push(`invalid_range_${item.symbol}_zone1`);
      reasons.push(`Giá Vùng 1 của ${item.symbol} (${item.zone1}) ngoài khoảng 10.000 - 60.000đ`);
    }
    if (item.zone2 != null && (item.zone2 < 10000 || item.zone2 > 60000)) {
      flags.push(`invalid_range_${item.symbol}_zone2`);
      reasons.push(`Giá Vùng 2 của ${item.symbol} (${item.zone2}) ngoài khoảng 10.000 - 60.000đ`);
    }

    // 3. zone2 >= zone1
    if (item.zone2 != null && item.zone2 < item.zone1) {
      flags.push(`zone2_less_than_zone1_${item.symbol}`);
      reasons.push(`Giá Vùng 2 (${item.zone2}) thấp hơn Vùng 1 (${item.zone1}) tại mã ${item.symbol}`);
    }

    // 4. Lệch tối đa 10% so với bản ghi fuel_manual gần nhất
    if (referencePrices && referencePrices.has(item.symbol)) {
      const refPrice = referencePrices.get(item.symbol)!;
      if (refPrice > 0) {
        const diffPct = Math.abs(item.zone1 - refPrice) / refPrice;
        if (diffPct > 0.10) {
          flags.push(`diff_over_10pct_${item.symbol}`);
          reasons.push(
            `Giá Vùng 1 (${item.zone1}) lệch ${(diffPct * 100).toFixed(1)}% (>10%) so với mốc gần nhất (${refPrice}) tại ${item.symbol}`,
          );
        }
      }
    }
  }

  const needsReview = flags.length > 0;
  return {
    isValid: missing.length === 0 && !flags.some((f) => f.startsWith('invalid_range')),
    needsReview,
    flags,
    reasons,
  };
}

/**
 * Quy trình OCR hoàn chỉnh theo Yêu cầu 2, 3, 4, 5:
 * 1. Tải ảnh từ URL
 * 2. Chạy 2 lần để đối chiếu
 * 3. Validate đầy đủ và tạo danh sách bản ghi FuelSuggestionRecord
 * 4. Trả về kết quả (ghi vào fuel_suggestions, KHÔNG ghi đè giá hiển thị)
 */
export async function processFuelImageOcr(
  imageUrl: string,
  env: Env,
  referencePrices?: Map<string, number>,
  effectiveAt?: string,
): Promise<{
  suggestions: FuelSuggestionRecord[];
  validation: OcrValidationResult;
  isConsistent: boolean;
  diffDetails: string[];
}> {
  // 1. Tải ảnh từ URL nguồn (không lưu vào R2/DB)
  const imgRes = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      Referer: 'https://www.petrolimex.com.vn/',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!imgRes.ok) {
    throw new Error(`Tải ảnh thất bại từ ${imageUrl}: HTTP ${imgRes.status}`);
  }

  const imageBytes = await imgRes.arrayBuffer();

  // 2. Chạy mô hình 2 lần độc lập
  const [run1, run2] = await Promise.all([
    runSingleOcrPass(imageBytes, env),
    runSingleOcrPass(imageBytes, env),
  ]);

  // 3. So sánh 2 lần chạy
  const { isConsistent, diffDetails } = compareTwoRuns(run1, run2);

  // Chọn run1 làm kết quả cơ sở, nếu run1 thiếu sản phẩm mà run2 có thì bổ sung
  const combinedMap = new Map<string, OcrExtractedItem>();
  for (const item of run1) combinedMap.set(item.symbol, item);
  for (const item of run2) {
    if (!combinedMap.has(item.symbol)) combinedMap.set(item.symbol, item);
  }
  const extractedList = Array.from(combinedMap.values());

  // 4. Validate
  const validation = validateOcrFuelData(extractedList, referencePrices);

  // Nếu 2 lần chạy không khớp thì thêm cờ
  if (!isConsistent) {
    validation.needsReview = true;
    validation.flags.push('inconsistent_runs');
    validation.reasons.push(`2 lần chạy AI cho kết quả khác nhau: ${diffDetails.join('; ')}`);
  }

  // 5. Chuẩn bị bản ghi lưu vào fuel_suggestions
  const suggestions: FuelSuggestionRecord[] = extractedList.map((item) => {
    // Thu thập các flag áp dụng riêng cho symbol này hoặc flag chung
    const itemFlags = validation.flags.filter(
      (f) => f.includes(item.symbol) || f === 'missing_products' || f === 'inconsistent_runs',
    );

    return {
      source: 'Petrolimex (OCR Bảng giá)',
      symbol: item.symbol,
      name: item.name,
      price_zone1: item.zone1,
      price_zone2: item.zone2,
      effective_at: effectiveAt ?? null,
      raw_text: `OCR đọc từ ảnh: V1=${item.zone1}, V2=${item.zone2 ?? 'N/A'}`,
      status: 'pending',
      image_url: imageUrl,
      needs_review: validation.needsReview ? 1 : 0,
      flags: itemFlags.length > 0 ? JSON.stringify(itemFlags) : null,
    };
  });

  return {
    suggestions,
    validation,
    isConsistent,
    diffDetails,
  };
}

/**
 * Tự động tìm bài thông cáo mới nhất của Petrolimex để lấy URL ảnh bảng giá và mốc ngày hiệu lực
 */
export async function fetchPetrolimexPriceImageAndEffectiveAt(): Promise<{
  imageUrl: string | null;
  articleUrl: string | null;
  effectiveAt: string | null;
}> {
  const listUrl = 'https://www.petrolimex.com.vn/nd/thong-cao-bao-chi.html';
  try {
    const listRes = await fetch(listUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!listRes.ok) return { imageUrl: null, articleUrl: null, effectiveAt: null };
    const listHtml = await listRes.text();

    const linkMatches = [...listHtml.matchAll(/href="([^"]*(?:dieu-chinh-gia|gia-xang-dau)[^"]*)"/gi)];
    if (linkMatches.length === 0 || !linkMatches[0] || !linkMatches[0][1]) {
      return { imageUrl: null, articleUrl: null, effectiveAt: null };
    }

    let artUrl = linkMatches[0][1];
    if (artUrl.startsWith('/')) artUrl = `https://www.petrolimex.com.vn${artUrl}`;

    const artRes = await fetch(artUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!artRes.ok) return { imageUrl: null, articleUrl: artUrl, effectiveAt: null };
    const artHtml = await artRes.text();

    // 1. Tìm ảnh bảng giá nằm trong <figure class="image"> hoặc ngay sau "mức giá mới"
    let imageUrl: string | null = null;
    const figureMatch = artHtml.match(/<figure[^>]*class="[^"]*image[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^">]+)"/i);
    if (figureMatch && figureMatch[1]) {
      imageUrl = figureMatch[1];
    } else {
      const contentImgs = [...artHtml.matchAll(/<img[^>]+src="([^">]+)"[^>]*>/gi)];
      for (const m of contentImgs) {
        const src = m[1];
        if (src && (src.includes('files.petrolimex.com.vn/jpgs/') || src.includes('files.petrolimex.com.vn/images/'))) {
          if (!src.includes('s256.png') && !src.includes('logo') && !src.includes('icon')) {
            imageUrl = src;
            break;
          }
        }
      }
    }

    if (imageUrl && imageUrl.startsWith('//')) {
      imageUrl = `https:${imageUrl}`;
    }

    // 2. Tìm thời gian có hiệu lực: "Mức giá mới có hiệu lực từ thời điểm 15 giờ 00 phút ngày 08 tháng 10 năm 2026"
    let effectiveAt: string | null = null;
    const timeMatch = artHtml.match(/(?:từ\s+(?:thời\s+điểm\s+)?(\d{1,2})\s*giờ\s*(\d{1,2})?\s*phút?\s*ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4}))/i);
    if (timeMatch && timeMatch[1] && timeMatch[3] && timeMatch[4] && timeMatch[5]) {
      const hour = timeMatch[1].padStart(2, '0');
      const minute = (timeMatch[2] || '00').padStart(2, '0');
      const day = timeMatch[3].padStart(2, '0');
      const month = timeMatch[4].padStart(2, '0');
      const year = timeMatch[5];
      effectiveAt = `${year}-${month}-${day} ${hour}:${minute}:00`;
    }

    return { articleUrl: artUrl, imageUrl: imageUrl ?? null, effectiveAt: effectiveAt ?? null };
  } catch (err) {
    console.warn('[Petrolimex Image Fetcher] Lỗi:', err);
    return { imageUrl: null, articleUrl: null, effectiveAt: null };
  }
}

