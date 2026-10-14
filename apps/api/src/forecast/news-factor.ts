// apps/api/src/forecast/news-factor.ts
// Module trích xuất và phân loại yếu tố tác động từ tin tức cho nhận định giá xăng
// Tuân thủ các nguyên tắc:
// 1. LLM CHỈ phân loại và giải thích, KHÔNG tự đưa ra hướng giá hay con số.
// 2. Chống bịa: Chỉ dùng tiêu đề và tóm tắt đã có trong DB; news_id và URL bắt buộc phải hợp lệ; link nguồn giữ nguyên.
// 3. Cache theo news_id trong bảng news_factor_cache để tiết kiệm chi phí; giới hạn tối đa 40 tin/lần.
// 4. Tuyệt đối không in API key / secret ra log.

import type { Env } from '../types.ts';

export const ALLOWED_FACTORS = [
  'OPEC+/sản lượng',
  'Trung Đông/địa chính trị',
  'Tồn kho/nhu cầu',
  'USD/Fed',
  'Chính sách trong nước/quỹ bình ổn/thuế',
  'Khác',
] as const;

export const ALLOWED_IMPACTS = [
  'đẩy giá lên',
  'kéo giá xuống',
  'trung tính',
] as const;

export const ALLOWED_CERTAINTIES = [
  'thấp',
  'vừa',
  'cao',
] as const;

export type NewsFactorType = typeof ALLOWED_FACTORS[number];
export type NewsImpactType = typeof ALLOWED_IMPACTS[number];
export type NewsCertaintyType = typeof ALLOWED_CERTAINTIES[number];

export interface RawNewsItem {
  id: number;
  title: string;
  summary: string;
  category: string;
  url: string;
  published_at: string;
}

export interface ClassifiedNewsFactor {
  news_id: number;
  factor: NewsFactorType;
  impact: NewsImpactType;
  certainty: NewsCertaintyType;
  one_line: string;
  title?: string | undefined;
  url?: string | undefined;
}

export interface AggregatedFactor {
  factor: NewsFactorType;
  supportingCount: number;
  dominantImpact: NewsImpactType;
  items: Array<{
    news_id: number;
    title: string;
    url: string;
    impact: NewsImpactType;
    certainty: NewsCertaintyType;
    one_line: string;
  }>;
}

export interface NewsFactorsAnalysisResult {
  topFactors: AggregatedFactor[];
  hasDomesticPolicyIntervention: boolean;
  domesticPolicyReason?: string | undefined;
  totalAnalyzed: number;
  cachedCount: number;
  newlyClassifiedCount: number;
  items: ClassifiedNewsFactor[];
}

export const NEWS_FACTOR_SYSTEM_PROMPT = `Bạn là hệ thống chuyên gia phân tích và phân loại yếu tố tác động từ tin tức thị trường năng lượng cho mô hình nhận định giá xăng dầu Việt Nam.

QUY TẮC CỐT LÕI (BẮT BUỘC TUÂN THỦ 100%):
1. Bạn CHỈ phân loại và giải thích tóm tắt dựa DUY NHẤT vào TIÊU ĐỀ và TÓM TẮT tin tức được cung cấp.
2. TUYỆT ĐỐI KHÔNG tự bịa đặt, KHÔNG suy diễn số liệu ngoài tin, KHÔNG tự đưa ra dự báo hướng giá tương lai ngoài nội dung tin.
3. Phải giữ nguyên news_id chính xác tương ứng của từng tin.
4. Trường "factor" BẮT BUỘC phải là đúng 1 trong 6 giá trị sau:
   - "OPEC+/sản lượng"
   - "Trung Đông/địa chính trị"
   - "Tồn kho/nhu cầu"
   - "USD/Fed"
   - "Chính sách trong nước/quỹ bình ổn/thuế"
   - "Khác"
5. Trường "impact" BẮT BUỘC là 1 trong 3 giá trị: "đẩy giá lên", "kéo giá xuống", "trung tính".
6. Trường "certainty" BẮT BUỘC là 1 trong 3 giá trị: "thấp", "vừa", "cao".
7. Trường "one_line": Tối đa 140 ký tự, bằng tiếng Việt, tóm tắt súc tích ý chính của tin, không thêm thắt.
8. ĐẦU RA: Trả về DUY NHẤT một JSON array hợp lệ, KHÔNG có lời mở đầu hay giải thích thừa:
[
  {
    "news_id": 123,
    "factor": "Trung Đông/địa chính trị",
    "impact": "đẩy giá lên",
    "certainty": "cao",
    "one_line": "Căng thẳng khu vực làm gián đoạn nguồn cung dầu qua eo biển Hormuz."
  }
]`;

/**
 * Trích xuất an toàn JSON array từ phản hồi văn bản của LLM
 */
export function extractJsonFromAiResponse(rawText: string): any[] {
  if (!rawText) return [];
  const text = rawText.trim();

  // 1. Thử parse trực tiếp nếu là JSON hợp lệ
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  // 2. Tìm khối markdown ```json ... ```
  const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (mdMatch && mdMatch[1]) {
    try {
      const parsed = JSON.parse(mdMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  // 3. Tìm regex mảng JSON [ ... ]
  const arrayMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  return [];
}

/**
 * Kiểm tra tính hợp lệ và chuẩn hóa một bản ghi phân loại từ AI (Quy tắc chống bịa)
 */
export function validateAndSanitizeItem(
  item: any,
  validNewsMap: Map<number, RawNewsItem>
): ClassifiedNewsFactor | null {
  if (!item || typeof item !== 'object') return null;

  // 1. Bắt buộc có news_id hợp lệ và phải tồn tại trong danh sách tin được gửi đi
  const newsId = Number(item.news_id);
  if (isNaN(newsId) || !validNewsMap.has(newsId)) {
    return null;
  }

  const originalNews = validNewsMap.get(newsId)!;

  // 2. Kiểm tra factor thuộc danh sách cố định
  const factor = typeof item.factor === 'string' ? item.factor.trim() : '';
  if (!ALLOWED_FACTORS.includes(factor as NewsFactorType)) {
    return null;
  }

  // 3. Kiểm tra impact
  const impact = typeof item.impact === 'string' ? item.impact.trim() : '';
  if (!ALLOWED_IMPACTS.includes(impact as NewsImpactType)) {
    return null;
  }

  // 4. Kiểm tra certainty
  const certainty = typeof item.certainty === 'string' ? item.certainty.trim() : '';
  if (!ALLOWED_CERTAINTIES.includes(certainty as NewsCertaintyType)) {
    return null;
  }

  // 5. Kiểm tra one_line (tối đa 140 ký tự)
  let oneLine = typeof item.one_line === 'string' ? item.one_line.trim() : '';
  if (!oneLine) {
    // Nếu AI bỏ trống, lấy tiêu đề gốc cắt ngắn
    oneLine = originalNews.title.slice(0, 140);
  } else if (oneLine.length > 140) {
    // Cắt ngắn nếu vượt quá 140 ký tự
    oneLine = oneLine.slice(0, 137).trim() + '...';
  }

  return {
    news_id: newsId,
    factor: factor as NewsFactorType,
    impact: impact as NewsImpactType,
    certainty: certainty as NewsCertaintyType,
    one_line: oneLine,
    title: originalNews.title,
    url: originalNews.url,
  };
}

/**
 * Phân loại quy tắc dự phòng khi AI không khả dụng hoặc lỗi JSON (Fallback rule-based)
 */
export function ruleBasedClassifyItem(news: RawNewsItem): ClassifiedNewsFactor {
  const text = `${news.title} ${news.summary || ''}`.toLowerCase();

  let factor: NewsFactorType = 'Khác';
  let impact: NewsImpactType = 'trung tính';
  let certainty: NewsCertaintyType = 'vừa';

  if (
    text.includes('quỹ bình ổn') ||
    text.includes('quỹ bog') ||
    text.includes('thuế bảo vệ môi trường') ||
    text.includes('bộ công thương') ||
    text.includes('liên bộ') ||
    text.includes('điều hành giá')
  ) {
    factor = 'Chính sách trong nước/quỹ bình ổn/thuế';
    impact = text.includes('giảm') || text.includes('xả quỹ') || text.includes('chi quỹ') ? 'kéo giá xuống' : 'trung tính';
    certainty = 'cao';
  } else if (
    text.includes('opec') ||
    text.includes('sản lượng') ||
    text.includes('cắt giảm') ||
    text.includes('khai thác')
  ) {
    factor = 'OPEC+/sản lượng';
    impact = text.includes('tăng sản lượng') ? 'kéo giá xuống' : text.includes('cắt giảm') ? 'đẩy giá lên' : 'trung tính';
    certainty = 'cao';
  } else if (
    text.includes('trung đông') ||
    text.includes('iran') ||
    text.includes('israel') ||
    text.includes('hormuz') ||
    text.includes('biển đỏ') ||
    text.includes('nga') ||
    text.includes('ukraine') ||
    text.includes('chiến sự') ||
    text.includes('tập kích')
  ) {
    factor = 'Trung Đông/địa chính trị';
    impact = text.includes('hạ nhiệt') || text.includes('ngừng tập kích') || text.includes('đàm phán') ? 'kéo giá xuống' : 'đẩy giá lên';
    certainty = 'cao';
  } else if (
    text.includes('fed') ||
    text.includes('lãi suất') ||
    text.includes('usd') ||
    text.includes('lạm phát') ||
    text.includes('đồng đô la')
  ) {
    factor = 'USD/Fed';
    impact = text.includes('usd tăng') || text.includes('đỉnh') ? 'kéo giá xuống' : 'trung tính';
    certainty = 'vừa';
  } else if (
    text.includes('tồn kho') ||
    text.includes('eia') ||
    text.includes('nhu cầu') ||
    text.includes('tiêu thụ')
  ) {
    factor = 'Tồn kho/nhu cầu';
    impact = text.includes('tồn kho giảm') || text.includes('nhu cầu tăng') ? 'đẩy giá lên' : text.includes('tồn kho tăng') ? 'kéo giá xuống' : 'trung tính';
    certainty = 'vừa';
  }

  const oneLine = (news.title.length > 140 ? news.title.slice(0, 137) + '...' : news.title);

  return {
    news_id: news.id,
    factor,
    impact,
    certainty,
    one_line: oneLine,
    title: news.title,
    url: news.url,
  };
}

/**
 * Lấy các tin trong bảng news 7 ngày gần nhất thuộc nhóm Năng lượng và Vĩ mô/Fed (tối đa 40 tin)
 */
export async function fetchRecentRelevantNews(
  db: any,
  limit: number = 40
): Promise<RawNewsItem[]> {
  try {
    const q1 = `SELECT id, title, summary, category, url, published_at
         FROM news
         WHERE (category LIKE '%Năng lượng%' OR category LIKE '%Vĩ mô%' OR category LIKE '%Fed%')
           AND published_at >= datetime('now', '-7 days')
         ORDER BY published_at DESC
         LIMIT ?`;
    const prep1 = db.prepare(q1);
    const bound1 = typeof prep1.bind === 'function' ? prep1.bind(limit) : prep1;
    const stmt = await (typeof bound1?.all === 'function' ? bound1.all() : (typeof prep1?.all === 'function' ? prep1.all() : { results: [] }));

    const items = (stmt.results || []) as RawNewsItem[];
    if (items.length >= 5) {
      return items;
    }

    // Nếu dữ liệu mẫu trong DB có ngày cũ hơn 7 ngày, fallback lấy các tin mới nhất của nhóm này
    const q2 = `SELECT id, title, summary, category, url, published_at
         FROM news
         WHERE (category LIKE '%Năng lượng%' OR category LIKE '%Vĩ mô%' OR category LIKE '%Fed%')
         ORDER BY published_at DESC
         LIMIT ?`;
    const prep2 = db.prepare(q2);
    const bound2 = typeof prep2.bind === 'function' ? prep2.bind(limit) : prep2;
    const fallbackStmt = await (typeof bound2?.all === 'function' ? bound2.all() : (typeof prep2?.all === 'function' ? prep2.all() : { results: [] }));

    return (fallbackStmt.results || []) as RawNewsItem[];
  } catch (err) {
    console.warn('[NewsFactor] Lỗi truy vấn bảng news:', err);
    return [];
  }
}

/**
 * Đọc bộ đệm (cache) phân loại tin từ bảng news_factor_cache
 */
export async function getCachedNewsFactors(
  db: any,
  newsIds: number[]
): Promise<Map<number, ClassifiedNewsFactor>> {
  const cacheMap = new Map<number, ClassifiedNewsFactor>();
  if (!newsIds.length || !db?.prepare) return cacheMap;

  try {
    const placeholders = newsIds.map(() => '?').join(',');
    const prep = db.prepare(
      `SELECT news_id, factor, impact, certainty, one_line
       FROM news_factor_cache
       WHERE news_id IN (${placeholders})`
    );
    const bound = typeof prep.bind === 'function' ? prep.bind(...newsIds) : prep;
    const stmt = await (typeof bound?.all === 'function' ? bound.all() : (typeof prep?.all === 'function' ? prep.all() : { results: [] }));

    for (const r of (stmt.results || []) as any[]) {
      cacheMap.set(Number(r.news_id), {
        news_id: Number(r.news_id),
        factor: r.factor as NewsFactorType,
        impact: r.impact as NewsImpactType,
        certainty: r.certainty as NewsCertaintyType,
        one_line: r.one_line,
      });
    }
  } catch (err) {
    console.warn('[NewsFactor] Lỗi đọc news_factor_cache:', err);
  }

  return cacheMap;
}

/**
 * Lưu kết quả phân loại mới vào bảng news_factor_cache
 */
export async function saveCachedNewsFactors(
  db: any,
  items: ClassifiedNewsFactor[]
): Promise<void> {
  if (!items.length || !db?.prepare) return;

  try {
    for (const it of items) {
      await db
        .prepare(
          `INSERT OR REPLACE INTO news_factor_cache (news_id, factor, impact, certainty, one_line)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(it.news_id, it.factor, it.impact, it.certainty, it.one_line)
        .run();
    }
  } catch (err) {
    console.warn('[NewsFactor] Lỗi lưu vào news_factor_cache:', err);
  }
}

/**
 * Gọi mô hình ngôn ngữ (Workers AI hoặc Claude API) để phân loại các tin chưa có trong cache
 */
export async function callAiToClassifyNews(
  newsItems: RawNewsItem[],
  env?: Env,
  customAiCaller?: (prompt: string) => Promise<string>
): Promise<ClassifiedNewsFactor[]> {
  if (!newsItems.length) return [];

  const validNewsMap = new Map<number, RawNewsItem>(
    newsItems.map((n) => [n.id, n])
  );

  const inputList = newsItems.map((n) => ({
    news_id: n.id,
    title: n.title,
    summary: n.summary || '',
  }));

  const userPrompt = `Dưới đây là danh sách ${inputList.length} tin tức cần phân loại:\n\n${JSON.stringify(inputList, null, 2)}\n\nHãy trả về CHỈ một JSON array tuân thủ đúng schema và các quy tắc.`;

  let rawOutput = '';

  // 1. Nếu có customAiCaller (dùng trong test hoặc override)
  if (customAiCaller) {
    try {
      rawOutput = await customAiCaller(userPrompt);
    } catch {}
  }

  // 2. Nếu có Claude API key cấu hình qua biến môi trường (không in key)
  if (!rawOutput && env?.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1500,
          system: NEWS_FACTOR_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (res.ok) {
        const json: any = await res.json();
        rawOutput = json?.content?.[0]?.text || '';
      }
    } catch (err) {
      console.warn('[NewsFactor] Claude API gặp lỗi, chuyển sang fallback:', (err as any)?.message);
    }
  }

  // 3. Nếu có Cloudflare Workers AI binding
  if (!rawOutput && env?.AI) {
    try {
      const aiRes = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: NEWS_FACTOR_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1500,
      });

      rawOutput = typeof aiRes === 'string' ? aiRes : (aiRes?.response || JSON.stringify(aiRes));
    } catch (err) {
      console.warn('[NewsFactor] Workers AI gặp lỗi:', (err as any)?.message);
    }
  }

  // Phân tích cú pháp JSON
  let parsedArray = extractJsonFromAiResponse(rawOutput);

  // Nếu lần 1 không parse được, thử chạy fallback hoặc retry
  if (!parsedArray.length && (env?.AI || env?.ANTHROPIC_API_KEY)) {
    // Thử trích xuất lại lần 2 nếu có
    parsedArray = extractJsonFromAiResponse(rawOutput);
  }

  const validItems: ClassifiedNewsFactor[] = [];
  const processedIds = new Set<number>();

  for (const raw of parsedArray) {
    const validated = validateAndSanitizeItem(raw, validNewsMap);
    if (validated && !processedIds.has(validated.news_id)) {
      validItems.push(validated);
      processedIds.add(validated.news_id);
    }
  }

  // Với các tin AI bỏ sót hoặc lỗi parse, áp dụng rule-based fallback để đảm bảo không bị mất tin
  for (const news of newsItems) {
    if (!processedIds.has(news.id)) {
      const fallbackItem = ruleBasedClassifyItem(news);
      validItems.push(fallbackItem);
      processedIds.add(news.id);
    }
  }

  return validItems;
}

/**
 * Gom nhóm và chọn ra tối đa 3 yếu tố nổi bật nhất cho kỳ hiện tại
 */
export function aggregateTopFactors(
  classifiedItems: ClassifiedNewsFactor[]
): AggregatedFactor[] {
  if (!classifiedItems.length) return [];

  const groupMap = new Map<NewsFactorType, ClassifiedNewsFactor[]>();

  for (const it of classifiedItems) {
    if (!groupMap.has(it.factor)) {
      groupMap.set(it.factor, []);
    }
    groupMap.get(it.factor)!.push(it);
  }

  const aggregatedList: AggregatedFactor[] = [];

  for (const [factor, items] of groupMap.entries()) {
    // Đếm số lượng theo impact để tìm dominantImpact
    let upCount = 0;
    let downCount = 0;
    let neutralCount = 0;

    for (const it of items) {
      if (it.impact === 'đẩy giá lên') upCount++;
      else if (it.impact === 'kéo giá xuống') downCount++;
      else neutralCount++;
    }

    let dominantImpact: NewsImpactType = 'trung tính';
    if (upCount > downCount && upCount >= neutralCount) {
      dominantImpact = 'đẩy giá lên';
    } else if (downCount > upCount && downCount >= neutralCount) {
      dominantImpact = 'kéo giá xuống';
    }

    aggregatedList.push({
      factor,
      supportingCount: items.length,
      dominantImpact,
      items: items.map((it) => ({
        news_id: it.news_id,
        title: it.title || '',
        url: it.url || '',
        impact: it.impact,
        certainty: it.certainty,
        one_line: it.one_line,
      })),
    });
  }

  // Sắp xếp: Các factor khác "Khác" xếp trước theo supportingCount giảm dần; "Khác" xếp sau cùng
  aggregatedList.sort((a, b) => {
    if (a.factor === 'Khác' && b.factor !== 'Khác') return 1;
    if (a.factor !== 'Khác' && b.factor === 'Khác') return -1;
    return b.supportingCount - a.supportingCount;
  });

  // Lấy tối đa 3 yếu tố nổi bật nhất
  return aggregatedList.slice(0, 3);
}

/**
 * Hàm phân tích toàn diện yếu tố tác động từ tin tức cho nhận định giá xăng
 */
export async function analyzeNewsImpactFactors(
  db: any,
  env?: Env,
  options: {
    maxNews?: number | undefined;
    customAiCaller?: ((prompt: string) => Promise<string>) | undefined;
  } = {}
): Promise<NewsFactorsAnalysisResult> {
  const maxNews = Math.min(options.maxNews || 40, 40);

  // 1. Lấy tin từ DB (tối đa 40 tin của 7 ngày gần nhất)
  const recentNews = await fetchRecentRelevantNews(db, maxNews);
  if (!recentNews.length) {
    return {
      topFactors: [],
      hasDomesticPolicyIntervention: false,
      totalAnalyzed: 0,
      cachedCount: 0,
      newlyClassifiedCount: 0,
      items: [],
    };
  }

  const newsMap = new Map<number, RawNewsItem>(recentNews.map((n) => [n.id, n]));
  const allIds = recentNews.map((n) => n.id);

  // 2. Tra cứu cache
  const cachedMap = await getCachedNewsFactors(db, allIds);

  const uncachedNews: RawNewsItem[] = [];
  const finalClassified: ClassifiedNewsFactor[] = [];

  for (const n of recentNews) {
    if (cachedMap.has(n.id)) {
      const c = cachedMap.get(n.id)!;
      finalClassified.push({
        ...c,
        title: n.title,
        url: n.url,
      });
    } else {
      uncachedNews.push(n);
    }
  }

  // 3. Phân loại các tin chưa có trong cache bằng AI
  let newlyClassified: ClassifiedNewsFactor[] = [];
  if (uncachedNews.length > 0) {
    newlyClassified = await callAiToClassifyNews(
      uncachedNews,
      env,
      options.customAiCaller
    );

    // 4. Lưu kết quả mới vào cache
    await saveCachedNewsFactors(db, newlyClassified);

    for (const item of newlyClassified) {
      finalClassified.push(item);
    }
  }

  // 5. Gom nhóm tối đa 3 yếu tố nổi bật nhất
  const topFactors = aggregateTopFactors(finalClassified);

  // 6. Kiểm tra xem có tin tức về Quỹ bình ổn giá hoặc thay đổi thuế/phí không
  const domesticPolicyItem = finalClassified.find(
    (it) => it.factor === 'Chính sách trong nước/quỹ bình ổn/thuế'
  );

  const hasDomesticPolicyIntervention = Boolean(domesticPolicyItem);
  const domesticPolicyReason = domesticPolicyItem
    ? `Chính sách trong nước: ${domesticPolicyItem.one_line}`
    : undefined;

  return {
    topFactors,
    hasDomesticPolicyIntervention,
    domesticPolicyReason,
    totalAnalyzed: finalClassified.length,
    cachedCount: cachedMap.size,
    newlyClassifiedCount: newlyClassified.length,
    items: finalClassified,
  };
}
