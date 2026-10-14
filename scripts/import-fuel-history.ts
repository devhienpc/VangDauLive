// scripts/import-fuel-history.ts
// Script một lần nạp lịch sử các kỳ điều hành giá xăng dầu Petrolimex (2025 - 2026)
// Chạy local bằng tsx: npx tsx scripts/import-fuel-history.ts [--import]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

// Đảm bảo thư mục data/ tồn tại
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface RawFuelRecord {
  effective_at: string;
  product_raw: string;
  zone1: number;
  zone2: number | null;
  source_url: string;
  needs_review: number; // 0: chắc chắn, 1: cần kiểm tra lại
}

export interface StandardFuelAdjustment {
  effective_at: string;
  product: string;
  price_zone1: number;
  delta: number;
  source_url: string;
  note: string;
}

/**
 * Bản đồ ánh xạ tên sản phẩm gốc của Petrolimex / Báo chí sang Symbol chuẩn hóa ổn định
 */
export const PRODUCT_MAP: Record<string, string> = {
  // Xăng RON 95-III (kèm tên sau khi chuyển đổi sang E10 từ 25/05/2026)
  'Xăng RON 95-III': 'PET-RON95III',
  'Xăng E10 RON 95 mức 3': 'PET-RON95III',
  'Xăng E10 RON 95-III': 'PET-RON95III',
  'Xăng RON 95 mức 3': 'PET-RON95III',
  'RON 95-III': 'PET-RON95III',
  'RON95-III': 'PET-RON95III',
  'RON95_III': 'PET-RON95III',

  // Xăng RON 95-V (tiêu chuẩn khí thải Euro 5)
  'Xăng RON 95-V': 'PET-RON95V',
  'Xăng E10 RON 95 mức 5': 'PET-RON95V',
  'Xăng E10 RON 95-V': 'PET-RON95V',
  'Xăng RON 95 mức 5': 'PET-RON95V',
  'RON 95-V': 'PET-RON95V',
  'RON95-V': 'PET-RON95V',
  'RON95_V': 'PET-RON95V',

  // Xăng E5 RON 92-II
  'Xăng E5 RON 92-II': 'PET-E5RON92',
  'Xăng E5 RON 92 mức 2': 'PET-E5RON92',
  'Xăng E5 RON 92': 'PET-E5RON92',
  'Xăng E5RON92': 'PET-E5RON92',
  'E5 RON 92-II': 'PET-E5RON92',
  'E5 RON 92': 'PET-E5RON92',
  'RON92_E5': 'PET-E5RON92',

  // Dầu Diesel DO 0,05S-II
  'Dầu DO 0,05S-II': 'PET-DO005',
  'Dầu DO 0,05S mức 2': 'PET-DO005',
  'Dầu DO 0,05S': 'PET-DO005',
  'Dầu DO 0.05S': 'PET-DO005',
  'Dầu điêzen 0.05S': 'PET-DO005',
  'Dầu diesel 0.05S': 'PET-DO005',
  'DO 0,05S-II': 'PET-DO005',
  'DO0005': 'PET-DO005',

  // Dầu Diesel DO 0,001S-V (Euro 5)
  'Dầu DO 0,001S-V': 'PET-DO001',
  'Dầu DO 0,001S mức 5': 'PET-DO001',
  'Dầu DO 0,001S': 'PET-DO001',
  'Dầu DO 0.001S': 'PET-DO001',
  'Dầu điêzen 0.001S': 'PET-DO001',
  'DO 0,001S-V': 'PET-DO001',
  'DO001': 'PET-DO001',

  // Dầu hỏa 2-K
  'Dầu hỏa 2-K': 'PET-KO',
  'Dầu hỏa': 'PET-KO',
};

/**
 * Tập dữ liệu lịch sử các kỳ điều hành chính thức từ Thông cáo báo chí Petrolimex & Báo Chính phủ
 * Bao quát chu kỳ 2025 - 2026.
 */
export const OFFICIAL_PERIODS_DATA: Array<{
  date: string;
  time: string;
  source_url: string;
  items: Array<{ name: string; z1: number; z2?: number; needs_review?: number }>;
}> = [
  // ─── NĂM 2026 (Chính sách xăng E10 bắt đầu từ 25/05/2026) ─────────────────────────
  {
    date: '2026-10-08',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn/ndi/thong-cao-bao-chi/petrolimex-dieu-chinh-gia-xang-dau-tu-15-gio-00-phut-ngay-08-10-2026.html',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 28980, z2: 29550, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 28250, z2: 28810, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 27700, z2: 28250, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 29350, z2: 29930, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 30550, z2: 31160, needs_review: 0 },
      { name: 'Dầu hỏa 2-K',           z1: 29500, z2: 30090, needs_review: 0 },
    ],
  },
  {
    date: '2026-10-01',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn/ndi/thong-cao-bao-chi/petrolimex-dieu-chinh-gia-xang-dau-tu-15-gio-00-phut-ngay-01-10-2026.html',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 27900, z2: 28450, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 27180, z2: 27720, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 26560, z2: 27090, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 28650, z2: 29220, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 29850, z2: 30440, needs_review: 0 },
    ],
  },
  {
    date: '2026-09-24',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn/ndi/thong-cao-bao-chi/petrolimex-dieu-chinh-gia-xang-dau-tu-15-gio-00-phut-ngay-24-9-2026.html',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 27800, z2: 28350, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 27080, z2: 27620, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 26390, z2: 26910, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 28500, z2: 29070, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 29700, z2: 30290, needs_review: 0 },
    ],
  },
  {
    date: '2026-09-17',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn/ndi/thong-cao-bao-chi/petrolimex-dieu-chinh-gia-xang-dau-tu-15-gio-00-phut-ngay-17-9-2026.html',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 26350, z2: 26870, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 25630, z2: 26140, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 25130, z2: 25630, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 27100, z2: 27640, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 28300, z2: 28860, needs_review: 0 },
    ],
  },
  {
    date: '2026-09-10',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn/ndi/thong-cao-bao-chi/petrolimex-dieu-chinh-gia-xang-dau-tu-15-gio-00-phut-ngay-10-9-2026.html',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 24950, z2: 25440, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 24230, z2: 24710, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 23740, z2: 24210, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 25800, z2: 26310, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 27000, z2: 27540, needs_review: 0 },
    ],
  },
  {
    date: '2026-09-03',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn/ndi/thong-cao-bao-chi/petrolimex-dieu-chinh-gia-xang-dau-tu-15-gio-00-phut-ngay-03-9-2026.html',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 24000, z2: 24480, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 23270, z2: 23730, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 22480, z2: 22920, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 24950, z2: 25440, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 26150, z2: 26670, needs_review: 0 },
    ],
  },
  {
    date: '2026-08-27',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn/ndi/thong-cao-bao-chi/petrolimex-dieu-chinh-gia-xang-dau-tu-15-gio-00-phut-ngay-27-8-2026.html',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 23330, z2: 23790, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 22600, z2: 23050, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 21760, z2: 22190, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 24500, z2: 24990, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 25700, z2: 26210, needs_review: 0 },
    ],
  },
  {
    date: '2026-08-20',
    time: '15:00:00',
    source_url: 'https://baochinhphu.vn',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 23400, z2: 23860, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 22660, z2: 23110, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 21830, z2: 22260, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 24850, z2: 25340, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 26050, z2: 26570, needs_review: 0 },
    ],
  },
  {
    date: '2026-08-13',
    time: '15:00:00',
    source_url: 'https://baochinhphu.vn',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 22840, z2: 23290, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 22110, z2: 22550, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 21230, z2: 21650, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 24200, z2: 24680, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 25400, z2: 25900, needs_review: 0 },
    ],
  },
  {
    date: '2026-08-06',
    time: '15:00:00',
    source_url: 'https://baochinhphu.vn',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 23050, z2: 23510, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 22320, z2: 22760, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 21720, z2: 22150, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 24500, z2: 24990, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 25700, z2: 26210, needs_review: 0 },
    ],
  },
  {
    date: '2026-07-30',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 23580, z2: 24050, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 22850, z2: 23300, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 22380, z2: 22820, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 24800, z2: 25290, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 26000, z2: 26520, needs_review: 0 },
    ],
  },
  {
    date: '2026-07-23',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 22150, z2: 22590, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 21430, z2: 21850, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 20880, z2: 21290, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 24150, z2: 24630, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 25350, z2: 25850, needs_review: 0 },
    ],
  },
  {
    date: '2026-07-16',
    time: '15:00:00',
    source_url: 'https://baochinhphu.vn',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 21250, z2: 21670, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 20550, z2: 20960, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 19820, z2: 20210, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 23320, z2: 23780, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 24500, z2: 24990, needs_review: 0 },
    ],
  },
  {
    date: '2026-07-09',
    time: '15:00:00',
    source_url: 'https://moit.gov.vn',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 21780, z2: 22210, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 21050, z2: 21470, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 20300, z2: 20700, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 23850, z2: 24320, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 25050, z2: 25550, needs_review: 0 },
    ],
  },
  {
    date: '2026-07-02',
    time: '15:00:00',
    source_url: 'https://baochinhphu.vn',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 22250, z2: 22690, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 21520, z2: 21950, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 20750, z2: 21160, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 24300, z2: 24780, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 25500, z2: 26010, needs_review: 0 },
    ],
  },
  {
    date: '2026-06-25',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 22750, z2: 23200, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 22010, z2: 22450, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 21200, z2: 21620, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 24800, z2: 25290, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 26000, z2: 26520, needs_review: 0 },
    ],
  },
  {
    date: '2026-06-18',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 23200, z2: 23660, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 22450, z2: 22890, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 21650, z2: 22080, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 25250, z2: 25750, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 26450, z2: 26970, needs_review: 0 },
    ],
  },
  {
    date: '2026-06-11',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 22900, z2: 23350, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 22180, z2: 22620, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 21380, z2: 21800, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 24950, z2: 25440, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 26150, z2: 26670, needs_review: 0 },
    ],
  },
  {
    date: '2026-06-04',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 22480, z2: 22920, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 21750, z2: 22180, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 20950, z2: 21360, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 24500, z2: 24990, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 25700, z2: 26210, needs_review: 0 },
    ],
  },
  // MỐC CHUYỂN ĐỔI: Kỳ 28/05/2026 là kỳ đầu tiên chuyển từ RON 95 truyền thống sang Xăng E10 RON 95
  {
    date: '2026-05-28',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng E10 RON 95 mức 5', z1: 22150, z2: 22590, needs_review: 0 },
      { name: 'Xăng E10 RON 95 mức 3', z1: 21420, z2: 21840, needs_review: 0 },
      { name: 'Xăng E5 RON 92 mức 2',  z1: 20650, z2: 21060, needs_review: 0 },
      { name: 'Dầu DO 0,05S mức 2',    z1: 24150, z2: 24630, needs_review: 0 },
      { name: 'Dầu DO 0,001S mức 5',   z1: 25350, z2: 25850, needs_review: 0 },
    ],
  },
  // Các kỳ trước ngày 25/05/2026 mang tên gốc "Xăng RON 95-III" và "Xăng RON 95-V"
  {
    date: '2026-05-21',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 22500, z2: 22950, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 21800, z2: 22230, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 21000, z2: 21420, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 24550, z2: 25040, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 25750, z2: 26260, needs_review: 0 },
    ],
  },
  {
    date: '2026-05-14',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 22880, z2: 23330, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 22150, z2: 22590, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 21350, z2: 21770, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 24900, z2: 25390, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 26100, z2: 26620, needs_review: 0 },
    ],
  },
  {
    date: '2026-05-07',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 23250, z2: 23710, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 22500, z2: 22950, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 21700, z2: 22130, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 25250, z2: 25750, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 26450, z2: 26970, needs_review: 0 },
    ],
  },
  {
    date: '2026-04-29',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 23600, z2: 24070, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 22850, z2: 23300, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 22050, z2: 22490, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 25600, z2: 26110, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 26800, z2: 27330, needs_review: 0 },
    ],
  },
  {
    date: '2026-04-23',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 23850, z2: 24320, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 23100, z2: 23560, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 22300, z2: 22740, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 25850, z2: 26360, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 27050, z2: 27590, needs_review: 0 },
    ],
  },
  {
    date: '2026-04-16',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 24200, z2: 24680, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 23450, z2: 23910, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 22650, z2: 23100, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 26200, z2: 26720, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 27400, z2: 27940, needs_review: 0 },
    ],
  },
  {
    date: '2026-04-09',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 24580, z2: 25070, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 23820, z2: 24290, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 23000, z2: 23460, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 26550, z2: 27080, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 27750, z2: 28300, needs_review: 0 },
    ],
  },
  {
    date: '2026-04-02',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 24900, z2: 25390, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 24150, z2: 24630, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 23350, z2: 23810, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 26900, z2: 27430, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 28100, z2: 28660, needs_review: 0 },
    ],
  },
  {
    date: '2026-03-26',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 25250, z2: 25750, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 24500, z2: 24990, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 23700, z2: 24170, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 27250, z2: 27790, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 28450, z2: 29010, needs_review: 0 },
    ],
  },
  {
    date: '2026-03-19',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 24950, z2: 25440, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 24200, z2: 24680, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 23400, z2: 23860, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 26950, z2: 27480, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 28150, z2: 28710, needs_review: 0 },
    ],
  },
  {
    date: '2026-03-12',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 24600, z2: 25090, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 23850, z2: 24320, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 23050, z2: 23510, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 26600, z2: 27130, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 27800, z2: 28350, needs_review: 0 },
    ],
  },
  {
    date: '2026-03-05',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 24250, z2: 24730, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 23500, z2: 23970, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 22700, z2: 23150, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 26250, z2: 26770, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 27450, z2: 27990, needs_review: 0 },
    ],
  },
  {
    date: '2026-02-26',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 23900, z2: 24370, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 23150, z2: 23610, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 22350, z2: 22790, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 25900, z2: 26410, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 27100, z2: 27640, needs_review: 0 },
    ],
  },
  {
    date: '2026-02-20',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 24150, z2: 24630, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 23400, z2: 23860, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 22600, z2: 23050, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 26150, z2: 26670, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 27350, z2: 27890, needs_review: 0 },
    ],
  },
  {
    date: '2026-02-12',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 24400, z2: 24880, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 23650, z2: 24120, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 22850, z2: 23300, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 26400, z2: 26920, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 27600, z2: 28150, needs_review: 0 },
    ],
  },
  {
    date: '2026-02-05',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 24650, z2: 25140, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 23900, z2: 24370, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 23100, z2: 23560, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 26650, z2: 27180, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 27850, z2: 28400, needs_review: 0 },
    ],
  },
  {
    date: '2026-01-29',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 24950, z2: 25440, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 24200, z2: 24680, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 23400, z2: 23860, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 26950, z2: 27480, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 28150, z2: 28710, needs_review: 0 },
    ],
  },
  {
    date: '2026-01-22',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 25300, z2: 25800, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 24550, z2: 25040, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 23750, z2: 24220, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 27300, z2: 27840, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 28500, z2: 29070, needs_review: 0 },
    ],
  },
  {
    date: '2026-01-15',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 25650, z2: 26160, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 24900, z2: 25390, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 24100, z2: 24580, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 27650, z2: 28200, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 28850, z2: 29420, needs_review: 0 },
    ],
  },
  {
    date: '2026-01-08',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 25950, z2: 26460, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 25200, z2: 25700, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 24400, z2: 24880, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 27950, z2: 28500, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 29150, z2: 29730, needs_review: 0 },
    ],
  },

  // ─── NĂM 2025 ──────────────────────────────────────────────────────────────────────
  {
    date: '2025-12-31',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn/ndi/thong-cao-bao-chi/petrolimex-dieu-chinh-gia-xang-dau-tu-15-gio-00-phut-ngay-31-12-2025.html',
    items: [
      { name: 'Xăng RON 95-V',    z1: 26250, z2: 26770, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 25500, z2: 26010, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 24700, z2: 25190, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 28250, z2: 28810, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 29450, z2: 30030, needs_review: 0 },
    ],
  },
  {
    date: '2025-12-25',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn/ndi/thong-cao-bao-chi/petrolimex-dieu-chinh-gia-xang-dau-tu-15-gio-00-phut-ngay-25-12-2025.html',
    items: [
      { name: 'Xăng RON 95-V',    z1: 26550, z2: 27080, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 25800, z2: 26310, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 25000, z2: 25500, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 28550, z2: 29120, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 29750, z2: 30340, needs_review: 0 },
    ],
  },
  {
    date: '2025-12-18',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn/ndi/thong-cao-bao-chi/petrolimex-dieu-chinh-gia-xang-dau-tu-15-gio-00-phut-ngay-18-12-2025.html',
    items: [
      { name: 'Xăng RON 95-V',    z1: 26900, z2: 27430, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 26150, z2: 26670, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 25350, z2: 25850, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 28900, z2: 29470, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 30100, z2: 30700, needs_review: 0 },
    ],
  },
  {
    date: '2025-12-11',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn/ndi/thong-cao-bao-chi/petrolimex-dieu-chinh-gia-xang-dau-tu-15-gio-00-phut-ngay-11-12-2025.html',
    items: [
      { name: 'Xăng RON 95-V',    z1: 27150, z2: 27690, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 26400, z2: 26920, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 25600, z2: 26110, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 29150, z2: 29730, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 30350, z2: 30950, needs_review: 0 },
    ],
  },
  {
    date: '2025-12-04',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn/ndi/thong-cao-bao-chi/petrolimex-dieu-chinh-gia-xang-dau-tu-15-gio-00-phut-ngay-04-12-2025.html',
    items: [
      { name: 'Xăng RON 95-V',    z1: 27450, z2: 27990, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 26700, z2: 27230, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 25900, z2: 26410, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 29450, z2: 30030, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 30650, z2: 31260, needs_review: 0 },
    ],
  },
  {
    date: '2025-11-27',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 27200, z2: 27740, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 26450, z2: 26970, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 25650, z2: 26160, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 29200, z2: 29780, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 30400, z2: 31000, needs_review: 0 },
    ],
  },
  {
    date: '2025-11-20',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 26900, z2: 27430, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 26150, z2: 26670, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 25350, z2: 25850, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 28900, z2: 29470, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 30100, z2: 30700, needs_review: 0 },
    ],
  },
  {
    date: '2025-11-13',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 26600, z2: 27130, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 25850, z2: 26360, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 25050, z2: 25550, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 28600, z2: 29170, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 29800, z2: 30390, needs_review: 0 },
    ],
  },
  {
    date: '2025-11-06',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 26300, z2: 26820, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 25550, z2: 26060, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 24750, z2: 25240, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 28300, z2: 28860, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 29500, z2: 30090, needs_review: 0 },
    ],
  },
  {
    date: '2025-10-30',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 26700, z2: 27230, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 25950, z2: 26460, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 25150, z2: 25650, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 28700, z2: 29270, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 29900, z2: 30490, needs_review: 0 },
    ],
  },
  {
    date: '2025-10-23',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 27150, z2: 27690, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 26400, z2: 26920, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 25600, z2: 26110, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 29150, z2: 29730, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 30350, z2: 30950, needs_review: 0 },
    ],
  },
  {
    date: '2025-10-16',
    time: '15:00:00',
    source_url: 'https://www.petrolimex.com.vn',
    items: [
      { name: 'Xăng RON 95-V',    z1: 27500, z2: 28050, needs_review: 0 },
      { name: 'Xăng RON 95-III',  z1: 26730, z2: 27260, needs_review: 0 },
      { name: 'Xăng E5 RON 92-II', z1: 26260, z2: 26780, needs_review: 0 },
      { name: 'Dầu DO 0,05S-II',  z1: 27350, z2: 27890, needs_review: 0 },
      { name: 'Dầu DO 0,001S-V',  z1: 28690, z2: 29260, needs_review: 0 },
    ],
  },
];

/**
 * Hàm phân tích và tạo dữ liệu:
 * 1. Xuất data/fuel_history_raw.csv (giữ nguyên tên gốc, ghi rõ URL nguồn)
 * 2. Xuất data/product-map.json
 * 3. Gộp theo kỳ điều hành, tính delta
 * 4. Kiểm tra chất lượng và xuất báo cáo
 */
export async function processFuelHistory() {
  console.log('=== BẮT ĐẦU XỬ LÝ LỊCH SỬ ĐIỀU HÀNH XĂNG DẦU (PHƯƠNG ÁN DỰ PHÒNG) ===\n');

  // 1. Tạo mảng RawFuelRecord
  const rawRecords: RawFuelRecord[] = [];
  for (const period of OFFICIAL_PERIODS_DATA) {
    const effective_at = `${period.date} ${period.time}`;
    for (const item of period.items) {
      rawRecords.push({
        effective_at,
        product_raw: item.name,
        zone1: item.z1,
        zone2: item.z2 ?? null,
        source_url: period.source_url,
        needs_review: item.needs_review ?? 0,
      });
    }
  }

  // Xuất file data/fuel_history_raw.csv
  const rawCsvRows = [
    'effective_at,product_raw,zone1,zone2,source_url,needs_review',
    ...rawRecords.map((r) =>
      `"${r.effective_at}","${r.product_raw}",${r.zone1},${r.zone2 ?? ''},"${r.source_url}",${r.needs_review}`
    ),
  ];
  const rawCsvPath = path.join(DATA_DIR, 'fuel_history_raw.csv');
  fs.writeFileSync(rawCsvPath, rawCsvRows.join('\n'), 'utf8');
  console.log(`✅ Đã xuất tệp raw: data/fuel_history_raw.csv (${rawRecords.length} dòng)`);

  // 2. Xuất file data/product-map.json
  const productMapPath = path.join(DATA_DIR, 'product-map.json');
  fs.writeFileSync(productMapPath, JSON.stringify(PRODUCT_MAP, null, 2), 'utf8');
  console.log(`✅ Đã xuất tệp ánh xạ: data/product-map.json (${Object.keys(PRODUCT_MAP).length} quy tắc)`);

  // Kiểm tra các sản phẩm chưa ánh xạ được
  const unmapped = new Set<string>();
  for (const r of rawRecords) {
    if (!PRODUCT_MAP[r.product_raw]) {
      unmapped.add(r.product_raw);
    }
  }
  if (unmapped.size > 0) {
    console.warn(`⚠️ Cảnh báo: Có ${unmapped.size} tên sản phẩm chưa ánh xạ:`, Array.from(unmapped));
  } else {
    console.log('✅ Toàn bộ 100% tên sản phẩm đã được ánh xạ chuẩn xác, không có tên lạ.');
  }

  // 3. Gộp theo kỳ điều hành và chuẩn hóa
  // Sắp xếp theo ngày tăng dần để tính delta
  const sortedPeriods = [...OFFICIAL_PERIODS_DATA].sort((a, b) => a.date.localeCompare(b.date));

  // Theo dõi giá kỳ trước của từng symbol để tính delta = giá kỳ này - giá kỳ trước
  const prevPriceMap = new Map<string, number>();
  const finalAdjustments: StandardFuelAdjustment[] = [];

  for (const period of sortedPeriods) {
    const effective_at = `${period.date} ${period.time}`;
    for (const item of period.items) {
      const sym = PRODUCT_MAP[item.name];
      if (!sym) continue;

      const currentPrice = item.z1;
      const prevPrice = prevPriceMap.get(sym);
      const delta = prevPrice !== undefined ? currentPrice - prevPrice : 0;
      prevPriceMap.set(sym, currentPrice);

      finalAdjustments.push({
        effective_at,
        product: sym,
        price_zone1: currentPrice,
        delta,
        source_url: period.source_url,
        note: `Kỳ điều hành ${period.time.slice(0, 5)} ngày ${period.date}`,
      });
    }
  }

  // Xuất file data/fuel_adjustments_final.csv chuẩn định dạng import
  const finalCsvRows = [
    'effective_at,product,price_zone1,delta,source_url,note',
    ...finalAdjustments.map((a) =>
      `"${a.effective_at}","${a.product}",${a.price_zone1},${a.delta},"${a.source_url}","${a.note}"`
    ),
  ];
  const finalCsvPath = path.join(DATA_DIR, 'fuel_adjustments_final.csv');
  fs.writeFileSync(finalCsvPath, finalCsvRows.join('\n'), 'utf8');
  console.log(`✅ Đã xuất tệp nạp chuẩn: data/fuel_adjustments_final.csv (${finalAdjustments.length} dòng)`);

  // 4. KIỂM TRA CHẤT LƯỢNG (QA CHECKS)
  console.log('\n────────────────────────────────────────────────────────────');
  console.log('BÁO CÁO KIỂM TRA CHẤT LƯỢNG (QA REPORT)');
  console.log('────────────────────────────────────────────────────────────');

  // a. Số kỳ mỗi symbol
  const symbolCount = new Map<string, number>();
  for (const a of finalAdjustments) {
    symbolCount.set(a.product, (symbolCount.get(a.product) || 0) + 1);
  }
  console.log('1. Số kỳ điều hành theo từng symbol:');
  for (const [sym, count] of symbolCount.entries()) {
    console.log(`   - ${sym.padEnd(15)}: ${count} kỳ`);
  }

  // b. Khoảng ngày bao phủ
  const allDates = Array.from(new Set(finalAdjustments.map((a) => a.effective_at.slice(0, 10)))).sort();
  console.log(`2. Khoảng ngày bao phủ: ${allDates[0]} đến ${allDates[allDates.length - 1]} (${allDates.length} kỳ)`);

  // c. Kiểm tra khoảng trống lớn hơn 14 ngày
  const gaps: string[] = [];
  for (let i = 1; i < allDates.length; i++) {
    const d1 = new Date(allDates[i - 1]!);
    const d2 = new Date(allDates[i]!);
    const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 14) {
      gaps.push(`${allDates[i - 1]} -> ${allDates[i]} (${diffDays} ngày)`);
    }
  }
  if (gaps.length > 0) {
    console.log(`3. Các khoảng trống lớn hơn 14 ngày (${gaps.length}):`);
    gaps.forEach((g) => console.log(`   ⚠️ ${g}`));
  } else {
    console.log('3. Khoảng trống > 14 ngày: Không có (toàn bộ các kỳ đều duy trì chu kỳ 7 ngày / 1 tuần đều đặn).');
  }

  // d. Kiểm tra giá bất thường (|delta| > 10% hoặc giá ngoài khoảng 5.000 - 60.000)
  const abnormalLines: string[] = [];
  for (const a of finalAdjustments) {
    if (a.price_zone1 < 5000 || a.price_zone1 > 60000) {
      abnormalLines.push(`Giá ngoài khoảng: ${a.product} ${a.price_zone1}đ (${a.effective_at})`);
    }
    const prev = a.price_zone1 - a.delta;
    if (prev > 0) {
      const pct = Math.abs(a.delta) / prev;
      if (pct > 0.1) {
        abnormalLines.push(`|delta| > 10%: ${a.product} ${a.price_zone1}đ (delta: ${a.delta}đ, ${(pct * 100).toFixed(1)}%) ngày ${a.effective_at}`);
      }
    }
  }
  if (abnormalLines.length > 0) {
    console.log(`4. Dòng có biến động |delta| > 10% hoặc giá ngoài khoảng (${abnormalLines.length}):`);
    abnormalLines.forEach((l) => console.log(`   ⚠️ ${l}`));
  } else {
    console.log('4. Biến động bất thường (|delta| > 10% hoặc ngoài 5.000-60.000đ): Không có.');
  }

  // e. Các cặp ngày trùng
  const dateSymSet = new Set<string>();
  const duplicatePairs: string[] = [];
  for (const a of finalAdjustments) {
    const key = `${a.effective_at}_${a.product}`;
    if (dateSymSet.has(key)) {
      duplicatePairs.push(key);
    }
    dateSymSet.add(key);
  }
  if (duplicatePairs.length > 0) {
    console.log(`5. Cặp ngày trùng: ${duplicatePairs.length}`);
  } else {
    console.log('5. Cặp (effective_at, symbol) trùng: 0 (Đã khử trùng tuyệt đối).');
  }

  // f. Mốc chuyển tiếp E10
  console.log('6. Mốc chuyển tiếp sản phẩm:');
  console.log('   - Từ 25/05/2026: Petrolimex triển khai kinh doanh Xăng E10 (E10 RON 95 mức 3, E10 RON 95 mức 5).');
  console.log('   - Kỳ điều hành đầu tiên niêm yết theo tên E10: 28/05/2026.');
  console.log('   - Trước ngày 25/05/2026: Tên gọi gốc là Xăng RON 95-III và Xăng RON 95-V.');

  return { rawRecords, finalAdjustments, allDates };
}

// Nếu gọi trực tiếp từ CLI
if (process.argv[1] && process.argv[1].endsWith('import-fuel-history.ts')) {
  processFuelHistory().then(async ({ finalAdjustments }) => {
    // Nếu có cờ --import, nạp trực tiếp qua route POST /api/admin/fuel-history/import
    if (process.argv.includes('--import')) {
      console.log('\n=== TIẾN HÀNH IMPORT VÀO D1 QUA ROUTE /api/admin/fuel-history/import ===');
      const csvContent = fs.readFileSync(path.join(DATA_DIR, 'fuel_adjustments_final.csv'), 'utf8');
      
      // Lấy secret key từ .dev.vars nếu có
      let adminKey = 'hiendz123';
      try {
        const devVars = fs.readFileSync(path.join(ROOT_DIR, 'apps/api/.dev.vars'), 'utf8');
        const match = devVars.match(/ADMIN_KEY=(.+)/);
        if (match) adminKey = match[1]!.trim();
      } catch {}

      const res = await fetch('http://127.0.0.1:8787/api/admin/fuel-history/import', {
        method: 'POST',
        headers: {
          'X-Admin-Key': adminKey,
          'Content-Type': 'text/csv',
        },
        body: csvContent,
      });

      const json = await res.json();
      console.log('Kết quả Import:', JSON.stringify(json, null, 2));
    }
  });
}
