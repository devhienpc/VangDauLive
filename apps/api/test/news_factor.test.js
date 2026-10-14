// apps/api/test/news_factor.test.js
// Unit tests kiểm tra:
// 1. Validate JSON và các quy tắc chống bịa (thiếu news_id, factor ngoài danh sách, one_line quá dài)
// 2. Trích xuất JSON an toàn từ phản hồi AI
// 3. Gom nhóm top 3 yếu tố nổi bật và xác định xu hướng chủ đạo (dominantImpact)
// 4. Phát hiện tin tức về Quỹ bình ổn giá / thuế phí để hạ mức tin cậy

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALLOWED_FACTORS,
  ALLOWED_IMPACTS,
  ALLOWED_CERTAINTIES,
  validateAndSanitizeItem,
  extractJsonFromAiResponse,
  aggregateTopFactors,
  analyzeNewsImpactFactors,
  ruleBasedClassifyItem,
} from '../src/forecast/news-factor.ts';

const mockNews1 = {
  id: 101,
  title: 'OPEC+ nhất trí gia hạn cắt giảm sản lượng tự nguyện đến hết quý I',
  summary: 'Các nước thành viên OPEC+ đạt thỏa thuận nhằm cân bằng thị trường dầu mỏ.',
  category: 'Năng lượng',
  url: 'https://vnexpress.net/opec-cat-giam-san-luong-101.html',
  published_at: '2026-10-12 10:00:00',
};

const mockNews2 = {
  id: 102,
  title: 'Căng thẳng eo biển Hormuz khiến cước tàu chở dầu tăng vọt',
  summary: 'Rủi ro địa chính trị tại Trung Đông đe dọa các tuyến vận tải biển.',
  category: 'Năng lượng',
  url: 'https://vnexpress.net/cang-thang-hormuz-102.html',
  published_at: '2026-10-12 11:00:00',
};

const mockNews3 = {
  id: 103,
  title: 'Liên Bộ quyết định chi sử dụng Quỹ bình ổn giá 1.250 đồng/lít cho xăng',
  summary: 'Nhằm kìm đà tăng giá sốc cho người tiêu dùng trong kỳ điều hành mới.',
  category: 'Năng lượng',
  url: 'https://baochinhphu.vn/chi-quy-bog-103.html',
  published_at: '2026-10-13 09:00:00',
};

const validMap = new Map([
  [101, mockNews1],
  [102, mockNews2],
  [103, mockNews3],
]);

test('1. Validate JSON: Bản ghi chuẩn đầy đủ hợp lệ được chấp nhận', () => {
  const item = {
    news_id: 101,
    factor: 'OPEC+/sản lượng',
    impact: 'đẩy giá lên',
    certainty: 'cao',
    one_line: 'OPEC+ gia hạn cắt giảm sản lượng tự nguyện giúp hỗ trợ giá dầu.',
  };

  const validated = validateAndSanitizeItem(item, validMap);
  assert.notEqual(validated, null);
  assert.equal(validated?.news_id, 101);
  assert.equal(validated?.factor, 'OPEC+/sản lượng');
  assert.equal(validated?.impact, 'đẩy giá lên');
  assert.equal(validated?.certainty, 'cao');
  assert.equal(validated?.url, mockNews1.url);
  assert.equal(validated?.title, mockNews1.title);
});

test('2. Validate JSON: Loại bỏ bản ghi thiếu news_id hoặc news_id không tồn tại (chống bịa)', () => {
  // Thiếu news_id
  const itemNoId = {
    factor: 'OPEC+/sản lượng',
    impact: 'đẩy giá lên',
    certainty: 'cao',
    one_line: 'Tin không rõ nguồn gốc.',
  };
  assert.equal(validateAndSanitizeItem(itemNoId, validMap), null);

  // news_id là số lạ không có trong DB
  const itemFakeId = {
    news_id: 9999, // Không có trong validMap
    factor: 'OPEC+/sản lượng',
    impact: 'đẩy giá lên',
    certainty: 'cao',
    one_line: 'Tin ảo tưởng tượng.',
  };
  assert.equal(validateAndSanitizeItem(itemFakeId, validMap), null);
});

test('3. Validate JSON: Loại bỏ factor không nằm trong danh mục 6 yếu tố cho phép', () => {
  const itemInvalidFactor = {
    news_id: 101,
    factor: 'Thời tiết xấu / Bão', // Không có trong ALLOWED_FACTORS
    impact: 'đẩy giá lên',
    certainty: 'vừa',
    one_line: 'Bão đổ bộ làm chậm tàu dầu.',
  };
  assert.equal(validateAndSanitizeItem(itemInvalidFactor, validMap), null);
});

test('4. Validate JSON: Loại bỏ impact hoặc certainty sai định dạng', () => {
  const itemInvalidImpact = {
    news_id: 101,
    factor: 'OPEC+/sản lượng',
    impact: 'tăng phi mã', // Không nằm trong ALLOWED_IMPACTS
    certainty: 'cao',
    one_line: 'OPEC+ cắt giảm.',
  };
  assert.equal(validateAndSanitizeItem(itemInvalidImpact, validMap), null);

  const itemInvalidCertainty = {
    news_id: 101,
    factor: 'OPEC+/sản lượng',
    impact: 'đẩy giá lên',
    certainty: '100% tuyệt đối', // Không nằm trong ALLOWED_CERTAINTIES
    one_line: 'OPEC+ cắt giảm.',
  };
  assert.equal(validateAndSanitizeItem(itemInvalidCertainty, validMap), null);
});

test('5. Validate JSON: Cắt ngắn one_line quá 140 ký tự đảm bảo giới hạn độ dài', () => {
  const longText = 'A'.repeat(160);
  const itemLong = {
    news_id: 101,
    factor: 'OPEC+/sản lượng',
    impact: 'đẩy giá lên',
    certainty: 'cao',
    one_line: longText,
  };

  const validated = validateAndSanitizeItem(itemLong, validMap);
  assert.notEqual(validated, null);
  assert.ok(validated && validated.one_line.length <= 140);
  assert.ok(validated && validated.one_line.endsWith('...'));
});

test('6. Parser: Bóc tách JSON an toàn từ markdown codeblock hoặc text lộn xộn', () => {
  const rawMarkdown = `
    Dưới đây là kết quả phân tích:
    \`\`\`json
    [
      {
        "news_id": 101,
        "factor": "OPEC+/sản lượng",
        "impact": "đẩy giá lên",
        "certainty": "cao",
        "one_line": "OPEC+ gia hạn cắt giảm sản lượng."
      }
    ]
    \`\`\`
    Xin cảm ơn.
  `;

  const parsed = extractJsonFromAiResponse(rawMarkdown);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].news_id, 101);

  // Parse lỗi trả về mảng rỗng, không văng lỗi
  assert.deepEqual(extractJsonFromAiResponse('Văn bản không có json nào cả'), []);
});

test('7. Gom nhóm yếu tố: Chọn tối đa 3 yếu tố nổi bật nhất và xác định xu hướng áp đảo', () => {
  const classified = [
    { news_id: 1, factor: 'Trung Đông/địa chính trị', impact: 'đẩy giá lên', certainty: 'cao', one_line: 'Tin 1' },
    { news_id: 2, factor: 'Trung Đông/địa chính trị', impact: 'đẩy giá lên', certainty: 'cao', one_line: 'Tin 2' },
    { news_id: 3, factor: 'OPEC+/sản lượng', impact: 'kéo giá xuống', certainty: 'vừa', one_line: 'Tin 3' },
    { news_id: 4, factor: 'USD/Fed', impact: 'kéo giá xuống', certainty: 'thấp', one_line: 'Tin 4' },
    { news_id: 5, factor: 'Khác', impact: 'trung tính', certainty: 'thấp', one_line: 'Tin 5' },
  ];

  const top = aggregateTopFactors(classified);
  assert.ok(top.length <= 3);

  // Yếu tố có nhiều tin nhất xếp đầu tiên
  assert.equal(top[0].factor, 'Trung Đông/địa chính trị');
  assert.equal(top[0].supportingCount, 2);
  assert.equal(top[0].dominantImpact, 'đẩy giá lên');

  // "Khác" không được lấn át các nhóm có ý nghĩa
  assert.notEqual(top[0].factor, 'Khác');
});

test('8. Nhận diện Quỹ bình ổn giá / Thuế: Gắn cờ chính sách trong nước và hạ mức tin cậy', async () => {
  const mockDb = {
    prepare: (query) => ({
      bind: () => ({
        all: async () => {
          if (query.includes('FROM news')) {
            return { results: [mockNews1, mockNews3] };
          }
          if (query.includes('FROM news_factor_cache')) {
            return { results: [] };
          }
          return { results: [] };
        },
        run: async () => {},
      }),
    }),
  };

  const res = await analyzeNewsImpactFactors(mockDb, undefined, {
    customAiCaller: async () => JSON.stringify([
      {
        news_id: 101,
        factor: 'OPEC+/sản lượng',
        impact: 'đẩy giá lên',
        certainty: 'cao',
        one_line: 'OPEC+ cắt giảm.',
      },
      {
        news_id: 103,
        factor: 'Chính sách trong nước/quỹ bình ổn/thuế',
        impact: 'kéo giá xuống',
        certainty: 'cao',
        one_line: 'Liên Bộ chi Quỹ bình ổn kìm đà tăng giá xăng.',
      },
    ]),
  });

  // Có tin tức về quỹ BOG -> Gắn cờ chính sách trong nước thành công
  assert.equal(res.hasDomesticPolicyIntervention, true);
  assert.ok(res.domesticPolicyReason?.includes('Quỹ bình ổn'));
  assert.ok(res.topFactors.some((f) => f.factor === 'Chính sách trong nước/quỹ bình ổn/thuế'));
});

test('9. Bộ phân loại quy tắc dự phòng (Rule-based Fallback): Hoạt động chuẩn xác khi AI offline', () => {
  const itemBog = ruleBasedClassifyItem(mockNews3);
  assert.equal(itemBog.factor, 'Chính sách trong nước/quỹ bình ổn/thuế');
  assert.equal(itemBog.news_id, 103);

  const itemOpec = ruleBasedClassifyItem(mockNews1);
  assert.equal(itemOpec.factor, 'OPEC+/sản lượng');
  assert.equal(itemOpec.news_id, 101);

  const itemGeo = ruleBasedClassifyItem(mockNews2);
  assert.equal(itemGeo.factor, 'Trung Đông/địa chính trị');
  assert.equal(itemGeo.news_id, 102);
});
