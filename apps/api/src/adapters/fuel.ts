// src/adapters/fuel.ts
// Adapter giá xăng dầu Việt Nam (Petrolimex)
// - Parse bảng webgia.com/gia-xang-dau/petrolimex/, lấy giá Vùng 1 cho:
//   + RON 95-III (symbol: RON95_III)
//   + E5 RON 92-II (symbol: RON92_E5)
//   + DO 0,05S-II (symbol: DO0005)
//   + DO 0,001S-V (symbol: DO001)
// - Unit = 'VND/lít'

import type { PriceRecord } from '../types.js';

const WEBGIA_FUEL_URL = 'https://webgia.com/gia-xang-dau/petrolimex/';

/**
 * Xử lý số tiền trong bảng xăng dầu: "28.250" -> 28250
 */
export function parseFuelPrice(raw?: string | null): number | null {
  if (!raw || raw.trim() === '-' || raw.trim() === '') return null;
  const cleaned = raw.replace(/\./g, '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse bảng HTML xăng dầu Petrolimex từ webgia.com
 */
export function parsePetrolimexHtml(html: string): PriceRecord[] {
  const records: PriceRecord[] = [];
  const fetchedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // Cấu hình các loại nhiên liệu cần bóc tách
  const targets: Array<{
    matchPatterns: string[];
    symbol: string;
    name: string;
  }> = [
    {
      matchPatterns: ['Xăng RON 95-III', 'RON 95-III'],
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
  const records = parsePetrolimexHtml(html);

  if (records.length === 0) {
    throw new Error('Không parse được bản ghi xăng dầu nào từ HTML WebGia');
  }

  return { records, sourceUsed: 'WebGia (Petrolimex)' };
}
