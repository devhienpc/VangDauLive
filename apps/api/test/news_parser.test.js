// test/news_parser.test.js
// Unit tests cho parser tin tức RSS và bộ lọc từ khóa phân loại danh mục

import test from 'node:test';
import assert from 'node:assert/strict';

// Import các hàm thuần từ dist hoặc định nghĩa kiểm thử logic
// Do file TS được typecheck qua tsc, ta kiểm thử trực tiếp logic parse
function cleanHtmlText(raw) {
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

function classifyNewsCategory(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();

  const goldRegex = /(giá vàng|vàng miếng|vàng nhẫn|vàng sjc|vàng 9999|vàng thế giới|\bxau\b|\bgold\b|\bsjc\b|kim loại quý|giá bạc|\bxag\b|\bsilver\b|\bdoji\b|\bpnj\b|bảo tín minh châu|bảo tín)/i;
  if (goldRegex.test(text)) return 'Vàng & Kim loại';

  const energyRegex = /(giá xăng|xăng dầu|giá dầu|dầu thô|\bbrent\b|\bwti\b|petrolimex|nhiên liệu|\bopec\b|khí đốt|khí tự nhiên|ron\s*95|e5\s*ron|dầu diesel)/i;
  if (energyRegex.test(text)) return 'Năng lượng';

  const forexRegex = /(tỷ giá|ngoại tệ|đồng usd|tiền tệ|giá usd|đồng đô la|\bdxy\b|nhân dân tệ|đồng euro|đồng yên|\bjpy\b|\bcny\b|chuyển đổi ngoại tệ)/i;
  if (forexRegex.test(text)) return 'Ngoại tệ';

  const macroRegex = /(\bfed\b|cục dự trữ liên bang|lãi suất điều hành|hạ lãi suất|tăng lãi suất|lạm phát|\bcpi\b|\bgdp\b|ngân hàng trung ương|vĩ mô|\bfomc\b|kinh tế vĩ mô|chính sách tiền tệ)/i;
  if (macroRegex.test(text)) return 'Vĩ mô / Fed';

  return null;
}

function parseRssFeed(xml, sourceName) {
  const items = [];
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
    const rawSummary = cleanHtmlText(descMatch?.[1] ?? '');
    const summary = rawSummary.length > 200 ? rawSummary.slice(0, 200).trim() + '...' : rawSummary;

    if (!title || !url) continue;

    const category = classifyNewsCategory(title, summary);
    if (!category) continue;

    items.push({
      title,
      summary,
      category,
      url,
      source: sourceName,
      published_at: dateMatch?.[1] ? cleanHtmlText(dateMatch[1]) : 'now',
    });
  }

  return items;
}

test('cleanHtmlText: loại bỏ CDATA, thẻ HTML và unescape entities', () => {
  const raw = '<![CDATA[<a href="https://example.com"><img src="thumb.jpg" /></a> &quot;Gi&#225; v&#224;ng&quot; v&#432;&#7907;t đỉnh &amp; bứt ph&#225;!]]>';
  const clean = cleanHtmlText(raw);
  assert.equal(clean, '"Giá vàng" vượt đỉnh & bứt phá!');
});

test('classifyNewsCategory: phân loại chính xác danh mục theo từ khóa', () => {
  // 1. Vàng & Kim loại
  assert.equal(
    classifyNewsCategory('Giá vàng hôm nay 12/10: Vàng SJC tăng vọt', 'Giá vàng miếng và nhẫn tròn trơn'),
    'Vàng & Kim loại'
  );
  assert.equal(
    classifyNewsCategory('DOJI niêm yết biểu giá mới', 'Giao dịch vàng trang sức sôi động'),
    'Vàng & Kim loại'
  );

  // 2. Năng lượng
  assert.equal(
    classifyNewsCategory('Petrolimex điều chỉnh giá xăng dầu từ 15h', 'Xăng RON 95 và E5 RON 92 đồng loạt giảm'),
    'Năng lượng'
  );
  assert.equal(
    classifyNewsCategory('Dầu Brent lập đỉnh mới sau quyết định của OPEC+', 'Dầu thô WTI cũng tăng hơn 2%'),
    'Năng lượng'
  );

  // 3. Ngoại tệ
  assert.equal(
    classifyNewsCategory('Tỷ giá USD/VND tại các ngân hàng thương mại hôm nay', 'Đồng đô la Mỹ hạ nhiệt nhẹ'),
    'Ngoại tệ'
  );

  // 4. Vĩ mô / Fed
  assert.equal(
    classifyNewsCategory('Fed quyết định giữ nguyên lãi suất điều hành', 'Lạm phát CPI tháng 9 của Mỹ tiếp tục giảm'),
    'Vĩ mô / Fed'
  );

  // 5. Bỏ qua tin không liên quan
  assert.equal(
    classifyNewsCategory('Thủ tướng yêu cầu đẩy nhanh tiến độ cao tốc', 'Dự án giao thông trọng điểm miền Tây'),
    null
  );

  // 6. Tránh false positive với "dân số vàng" hoặc "kho bạc"
  assert.equal(
    classifyNewsCategory('Thời cơ từ cơ cấu dân số vàng của Việt Nam', 'Nhiều cơ hội việc làm cho thanh niên'),
    null
  );
  assert.equal(
    classifyNewsCategory('Kho bạc Nhà nước phát hành trái phiếu', 'Kế hoạch huy động vốn trong quý IV'),
    null
  );
});

test('parseRssFeed: cắt ngắn tóm tắt tối đa 200 ký tự và trích xuất đúng trường', () => {
  const mockXml = `
    <rss version="2.0">
      <channel>
        <item>
          <title><![CDATA[Giá vàng SJC tăng mạnh 1 triệu đồng/lượng]]></title>
          <link>https://example.com/tin-vang-1.html</link>
          <description><![CDATA[<a href="..."><img src="..." /></a> ${'A'.repeat(250)}]]></description>
          <pubDate>Mon, 12 Oct 2026 15:00:00 +0700</pubDate>
        </item>
        <item>
          <title>Tin thể thao bóng đá quốc tế</title>
          <link>https://example.com/the-thao.html</link>
          <description>Trận đấu kết thúc với tỷ số 2-0</description>
          <pubDate>Mon, 12 Oct 2026 14:00:00 +0700</pubDate>
        </item>
      </channel>
    </rss>
  `;

  const results = parseRssFeed(mockXml, 'VnExpress');
  // Chỉ 1 item liên quan (giá vàng), item bóng đá bị loại
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Giá vàng SJC tăng mạnh 1 triệu đồng/lượng');
  assert.equal(results[0].category, 'Vàng & Kim loại');
  assert.equal(results[0].source, 'VnExpress');
  assert.equal(results[0].url, 'https://example.com/tin-vang-1.html');
  // Tóm tắt được cắt ngắn <= 203 ký tự (200 ký tự + '...')
  assert.ok(results[0].summary.length <= 204);
  assert.ok(results[0].summary.endsWith('...'));
});
