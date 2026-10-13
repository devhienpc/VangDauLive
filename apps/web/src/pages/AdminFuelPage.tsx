// src/pages/AdminFuelPage.tsx
// Trang quản trị nhập giá xăng dầu thủ công & duyệt gợi ý từ scraper & AI OCR (Yêu cầu 1, 4, 6)

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { getBaseUrl } from '../api/client';

interface FuelRow {
  symbol: string;
  name: string;
  price_zone1: number | string;
  price_zone2: number | string;
}

interface FuelSuggestion {
  id: number;
  source: string;
  symbol: string;
  name?: string;
  price_zone1: number;
  price_zone2?: number | null;
  effective_at?: string;
  raw_text?: string;
  status: string;
  created_at?: string;
  image_url?: string | null;
  needs_review?: number;
  flags?: string | null;
}

const DEFAULT_ROWS: FuelRow[] = [
  { symbol: 'RON95_V',   name: 'Xăng E10 RON 95-V',   price_zone1: 29050, price_zone2: 29630 },
  { symbol: 'RON95_III', name: 'Xăng E10 RON 95-III', price_zone1: 28250, price_zone2: 28810 },
  { symbol: 'RON92_E5',  name: 'Xăng E5 RON 92-II',   price_zone1: 27700, price_zone2: 28250 },
  { symbol: 'DO0005',    name: 'Dầu DO 0,05S-II',     price_zone1: 29120, price_zone2: 29700 },
  { symbol: 'DO001',     name: 'Dầu DO 0,001S-V',     price_zone1: 30520, price_zone2: 31130 },
];

function parseFlags(flagsJson?: string | null): string[] {
  if (!flagsJson) return [];
  try {
    const parsed = JSON.parse(flagsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [flagsJson];
  }
}

function getFlagBadge(flag: string): { label: string; isDanger: boolean } {
  if (flag.includes('diff_over_10pct')) {
    return { label: 'Lệch > 10% so với giá cũ', isDanger: false };
  }
  if (flag.includes('invalid_range')) {
    return { label: 'Giá ngoài khoảng 10k-60k', isDanger: true };
  }
  if (flag.includes('zone2_less_than_zone1')) {
    return { label: 'Giá Vùng 2 < Vùng 1', isDanger: true };
  }
  if (flag.includes('inconsistent_runs')) {
    return { label: '2 lần chạy AI không khớp số', isDanger: false };
  }
  if (flag.includes('missing_products')) {
    return { label: 'Thiếu sản phẩm', isDanger: false };
  }
  return { label: flag, isDanger: false };
}

export function AdminFuelPage({ onBack }: { onBack?: () => void }) {
  const queryClient = useQueryClient();
  const [adminKey, setAdminKey] = useState<string>(() => {
    return sessionStorage.getItem('vangdau_admin_key') || '';
  });
  const [inputKey, setInputKey] = useState('');
  const [isAuth, setIsAuth] = useState(Boolean(adminKey));
  const [authError, setAuthError] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Form states
  const [rows, setRows] = useState<FuelRow[]>(DEFAULT_ROWS);
  const [effectiveAt, setEffectiveAt] = useState<string>(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T15:00`;
  });
  const [note, setNote] = useState('Petrolimex điều hành giá');

  // Suggestions state
  const [suggestions, setSuggestions] = useState<FuelSuggestion[]>([]);
  const [hasDifference, setHasDifference] = useState(false);

  // OCR custom modal / inputs
  const [showOcrInput, setShowOcrInput] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);

  // Tách gợi ý OCR và gợi ý Scraper thông thường
  const ocrSuggestions = useMemo(() => {
    return suggestions.filter(
      (s) => (s.source && s.source.includes('OCR')) || Boolean(s.image_url),
    );
  }, [suggestions]);

  const scraperSuggestions = useMemo(() => {
    return suggestions.filter(
      (s) => !((s.source && s.source.includes('OCR')) || Boolean(s.image_url)),
    );
  }, [suggestions]);

  // URL ảnh bảng giá từ gợi ý OCR gần nhất (nếu có)
  const latestOcrImageUrl = useMemo(() => {
    const found = ocrSuggestions.find((s) => s.image_url);
    return found ? found.image_url : null;
  }, [ocrSuggestions]);

  // Lấy dữ liệu từ backend
  const loadAdminFuel = useCallback(async (key: string) => {
    setLoading(true);
    setActionMsg(null);
    try {
      const res = await fetch(`${getBaseUrl()}/admin/fuel`, {
        headers: {
          'X-Admin-Key': key,
          Accept: 'application/json',
        },
      });

      if (res.status === 401 || res.status === 403) {
        setIsAuth(false);
        setAuthError('Mật mã quản trị không chính xác.');
        sessionStorage.removeItem('vangdau_admin_key');
        setLoading(false);
        return;
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi tải dữ liệu');
      }

      setIsAuth(true);
      sessionStorage.setItem('vangdau_admin_key', key);

      // Điền sẵn giá hiện tại vào 5 dòng
      if (json.data?.current && Array.isArray(json.data.current)) {
        const currentMap = new Map(json.data.current.map((c: any) => [c.symbol, c]));
        setRows((prev) =>
          prev.map((r) => {
            const cur: any = currentMap.get(r.symbol);
            return {
              ...r,
              price_zone1: cur?.price_zone1 || r.price_zone1,
              price_zone2: cur?.price_zone2 || r.price_zone2,
            };
          }),
        );

        const firstEff = json.data.current[0]?.effective_at;
        if (firstEff) {
          const formatted = firstEff.replace(' ', 'T').slice(0, 16);
          setEffectiveAt(formatted);
        }
      }

      setSuggestions(json.data?.suggestions || []);
      setHasDifference(Boolean(json.data?.hasDifference));
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi kết nối máy chủ API',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminKey) {
      loadAdminFuel(adminKey);
    }
  }, [adminKey, loadAdminFuel]);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;
    setAdminKey(inputKey.trim());
    loadAdminFuel(inputKey.trim());
  };

  const handlePriceChange = (symbol: string, field: 'price_zone1' | 'price_zone2', val: string) => {
    setRows((prev) =>
      prev.map((r) => (r.symbol === symbol ? { ...r, [field]: val } : r)),
    );
  };

  // Lưu bảng giá 5 dòng thủ công
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setActionMsg(null);

    try {
      const formattedEffective = effectiveAt.replace('T', ' ') + (effectiveAt.length === 16 ? ':00' : '');
      const items = rows.map((r) => ({
        symbol: r.symbol,
        name: r.name,
        price_zone1: Number(r.price_zone1),
        price_zone2: Number(r.price_zone2) || null,
        effective_at: formattedEffective,
        note: note.trim() || 'Cập nhật thủ công',
      }));

      const res = await fetch(`${getBaseUrl()}/admin/fuel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey,
        },
        body: JSON.stringify({ items }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi khi lưu bảng giá');
      }

      setActionMsg({
        type: 'success',
        text: `Đã lưu thành công ${items.length} mặt hàng xăng dầu! Dữ liệu đã hiển thị trên website.`,
      });

      // Làm mới cache React Query của trang chủ ngay lập tức
      await queryClient.invalidateQueries({ queryKey: ['prices'] });
      await queryClient.refetchQueries({ queryKey: ['prices'] });
      await loadAdminFuel(adminKey);
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể lưu bảng giá',
      });
    } finally {
      setSaving(false);
    }
  };

  // Kích hoạt quét OCR
  const handleTriggerOcr = async (urlToScan?: string) => {
    setOcrLoading(true);
    setActionMsg(null);

    try {
      const res = await fetch(`${getBaseUrl()}/admin/fuel/trigger-ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey,
        },
        body: JSON.stringify({
          imageUrl: urlToScan || customImageUrl.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi trong quá trình quét OCR');
      }

      const count = json.data?.items?.length || 0;
      const isNeedsReview = json.data?.validation?.needsReview;

      setActionMsg({
        type: isNeedsReview ? 'warning' : 'success',
        text: `Đã trích xuất ${count} mặt hàng từ ảnh bảng giá! ${
          isNeedsReview
            ? '⚠️ Có ô cần kiểm tra đối chiếu kỹ với ảnh gốc trước khi bấm Lưu.'
            : 'Các con số đã sẵn sàng. Hãy bấm "Duyệt" để copy vào form.'
        }`,
      });

      setShowOcrInput(false);
      setCustomImageUrl('');
      await loadAdminFuel(adminKey);
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi kích hoạt OCR',
      });
    } finally {
      setOcrLoading(false);
    }
  };

  // Nút "Duyệt": Copy 1 sản phẩm vào form fuel_manual để kiểm tra/sửa trước khi lưu (Yêu cầu 6)
  const handleApproveOcrItem = (s: FuelSuggestion) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.symbol === s.symbol) {
          return {
            ...r,
            price_zone1: s.price_zone1,
            price_zone2: s.price_zone2 ?? r.price_zone2,
          };
        }
        return r;
      }),
    );
    if (s.effective_at) {
      setEffectiveAt(s.effective_at.replace(' ', 'T').slice(0, 16));
    }
    setNote(`Duyệt từ OCR ảnh Petrolimex`);

    setActionMsg({
      type: 'success',
      text: `Đã copy giá ${s.name || s.symbol} (${s.price_zone1.toLocaleString('vi-VN')}đ) vào bảng nhập bên dưới. Hãy kiểm tra và nhấn "Lưu Bảng Giá Mới"!`,
    });

    const el = document.getElementById(`input-v1-${s.symbol}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus();
  };

  // Nút "Duyệt tất cả": Copy toàn bộ 5 số OCR vào form fuel_manual để kiểm tra/sửa trước khi lưu (Yêu cầu 6)
  const handleApproveAllOcrItems = (items: FuelSuggestion[]) => {
    const itemMap = new Map(items.map((i) => [i.symbol, i]));
    setRows((prev) =>
      prev.map((r) => {
        const found = itemMap.get(r.symbol);
        if (found) {
          return {
            ...r,
            price_zone1: found.price_zone1,
            price_zone2: found.price_zone2 ?? r.price_zone2,
          };
        }
        return r;
      }),
    );

    const firstEff = items.find((i) => i.effective_at)?.effective_at;
    if (firstEff) {
      setEffectiveAt(firstEff.replace(' ', 'T').slice(0, 16));
    }
    setNote('Duyệt bảng giá từ OCR ảnh Petrolimex');

    setActionMsg({
      type: 'success',
      text: `Đã copy toàn bộ ${items.length} số OCR vào biểu giá 5 dòng! Vui lòng đối chiếu với ảnh gốc và nhấn "Lưu Bảng Giá Mới".`,
    });

    const el = document.getElementById('btn-save-fuel');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Bỏ qua gợi ý
  const handleDismissSuggestion = async (suggestionId: number) => {
    try {
      const res = await fetch(`${getBaseUrl()}/admin/fuel/dismiss-suggestion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey,
        },
        body: JSON.stringify({ id: suggestionId }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Không thể bỏ qua gợi ý');
      }

      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
      setActionMsg({ type: 'success', text: `Đã bỏ qua gợi ý #${suggestionId}.` });
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi bỏ qua gợi ý',
      });
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('vangdau_admin_key');
    setAdminKey('');
    setIsAuth(false);
  };

  // ── Màn hình Đăng nhập Secret ──────────────────────────────────────────────
  if (!isAuth) {
    return (
      <div className="admin-page-container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="dash-card" style={{ maxWidth: '440px', width: '100%', padding: '32px', border: '1px solid var(--line-dim)' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <img src="/logo.png" alt="VàngDầu Live" style={{ height: '40px', margin: '0 auto 16px', objectFit: 'contain' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-hi)' }}>Bảo mật Quản trị Xăng Dầu</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-mid)', marginTop: '6px' }}>
              Nhập mật mã quản trị (X-Admin-Key) để truy cập giao diện nhập giá và duyệt scraper.
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label htmlFor="admin-key-input" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-hi)', marginBottom: '8px' }}>
                Secret Key / Admin Token
              </label>
              <input
                id="admin-key-input"
                type="password"
                className="tbl-search-input"
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', fontSize: '0.95rem' }}
                placeholder="Nhập secret key..."
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                autoFocus
              />
            </div>

            {authError && (
              <p style={{ color: '#f87171', fontSize: '0.82rem', margin: 0 }}>⚠️ {authError}</p>
            )}

            <button
              id="btn-login-admin"
              type="submit"
              className="btn-export"
              style={{ width: '100%', padding: '12px', justifyContent: 'center', fontSize: '0.95rem', fontWeight: 600, background: 'var(--gold)', color: '#000', border: 'none' }}
              disabled={loading}
            >
              {loading ? 'Đang xác thực...' : 'Mở khóa Quản trị'}
            </button>

            {onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-mid)', fontSize: '0.82rem', padding: '8px', cursor: 'pointer' }}
              >
                ← Quay lại trang chủ
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // ── Màn hình Quản trị chính ───────────────────────────────────────────────
  return (
    <div className="admin-page-container" style={{ maxWidth: '1160px', margin: '0 auto', padding: '32px 16px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="btn-export"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                ← Quay lại Dashboard
              </button>
            ) : (
              <a href="/" className="btn-export" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                ← Quay lại Dashboard
              </a>
            )}
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-hi)' }}>
              Quản trị Giá Xăng Dầu Việt Nam
            </h1>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-mid)', marginTop: '4px' }}>
            Giá nhập tay luôn được ưu tiên cao nhất trên website. OCR chỉ điền sẵn vào gợi ý để duyệt, không tự ghi đè.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Nút quét OCR */}
          <button
            type="button"
            id="btn-trigger-ocr"
            onClick={() => handleTriggerOcr()}
            disabled={ocrLoading}
            className="btn-export"
            style={{
              padding: '8px 14px',
              fontSize: '0.82rem',
              fontWeight: 600,
              background: 'linear-gradient(135deg, rgba(245, 166, 35, 0.2), rgba(96, 165, 250, 0.2))',
              border: '1px solid rgba(245, 166, 35, 0.4)',
              color: 'var(--gold)',
            }}
            title="Tự động tìm thông cáo báo chí Petrolimex gần nhất và chạy AI OCR"
          >
            {ocrLoading ? '⏳ Đang quét AI OCR...' : '📷 Quét OCR Bảng Giá Petrolimex'}
          </button>

          <button
            type="button"
            onClick={() => setShowOcrInput(!showOcrInput)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--line-soft)',
              color: 'var(--text-mid)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '0.8rem',
            }}
            title="Nhập URL ảnh tùy ý để thử nghiệm OCR"
          >
            {showOcrInput ? 'Đóng ô URL' : 'Tùy chỉnh URL ảnh...'}
          </button>

          <button
            type="button"
            onClick={() => loadAdminFuel(adminKey)}
            className="btn-export"
            disabled={loading}
            style={{ padding: '8px 12px', fontSize: '0.8rem' }}
          >
            🔄 {loading ? 'Đang tải...' : 'Làm mới'}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--line-soft)',
              color: 'var(--text-mid)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '0.8rem',
            }}
          >
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Accordion nhập URL ảnh tùy chỉnh */}
      <AnimatePresence>
        {showOcrInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: 'rgba(11, 22, 40, 0.7)',
              border: '1px solid var(--line-soft)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="url"
                value={customImageUrl}
                onChange={(e) => setCustomImageUrl(e.target.value)}
                placeholder="https://files.petrolimex.com.vn/.../bang-gia.jpg"
                className="tbl-search-input"
                style={{ flex: 1, minWidth: '280px', padding: '10px 14px', borderRadius: '8px', fontSize: '0.88rem' }}
              />
              <button
                type="button"
                onClick={() => handleTriggerOcr(customImageUrl)}
                disabled={ocrLoading || !customImageUrl.trim()}
                className="btn-export"
                style={{
                  padding: '10px 18px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background: 'var(--gold)',
                  color: '#000',
                  border: 'none',
                }}
              >
                {ocrLoading ? 'Đang xử lý...' : 'Quét ảnh này'}
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-lo)', marginTop: '8px' }}>
              * Dữ liệu bóc tách được sẽ ghi vào bảng gợi ý bên dưới để bạn duyệt trước khi áp dụng. Tuyệt đối không ghi đè tự động.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thông báo Alert */}
      <AnimatePresence>
        {actionMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '0.88rem',
              fontWeight: 500,
              background:
                actionMsg.type === 'success'
                  ? 'rgba(52, 211, 153, 0.12)'
                  : actionMsg.type === 'warning'
                  ? 'rgba(245, 166, 35, 0.12)'
                  : 'rgba(248, 113, 113, 0.14)',
              color:
                actionMsg.type === 'success'
                  ? '#34d399'
                  : actionMsg.type === 'warning'
                  ? '#fbbf24'
                  : '#fca5a5',
              border: `1px solid ${
                actionMsg.type === 'success'
                  ? 'rgba(52, 211, 153, 0.3)'
                  : actionMsg.type === 'warning'
                  ? 'rgba(245, 166, 35, 0.3)'
                  : 'rgba(248, 113, 113, 0.3)'
              }`,
            }}
          >
            {actionMsg.type === 'success' ? '✅ ' : actionMsg.type === 'warning' ? '⚠️ ' : '❌ '}
            {actionMsg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── KHU VỰC BẢNG GIÁ OCR (AI VISION) – YÊU CẦU 6: ẢNH GỐC CẠNH SỐ ĐÃ NHẬN DIỆN ──────── */}
      {ocrSuggestions.length > 0 && (
        <section
          className="dash-card"
          style={{
            marginBottom: '28px',
            padding: '24px',
            border: '1px solid rgba(245, 166, 35, 0.35)',
            background: 'linear-gradient(135deg, rgba(245, 166, 35, 0.05), rgba(11, 22, 40, 0.98))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.4rem' }}>📷</span>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--gold)', margin: 0 }}>
                  Đối Chiếu Bảng Giá OCR Petrolimex (AI Vision)
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-mid)', marginTop: '2px' }}>
                  Hiển thị ảnh bảng giá gốc cạnh các số đã nhận diện. Kiểm tra các ô được đánh dấu trước khi duyệt.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                id="btn-approve-all-ocr"
                onClick={() => handleApproveAllOcrItems(ocrSuggestions)}
                className="btn-export"
                style={{
                  padding: '8px 16px',
                  background: 'var(--gold)',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: 'none',
                }}
                title="Sao chép toàn bộ 5 số OCR vào form bên dưới để xem lại trước khi lưu"
              >
                📋 Duyệt toàn bộ 5 số vào Form
              </button>
            </div>
          </div>

          {/* Bố cục Side-by-Side: Cột Trái = Ảnh Gốc, Cột Phải = Số Nhận Diện */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', alignItems: 'start' }}>
            {/* Cột Trái: Ảnh gốc Petrolimex */}
            <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '12px', border: '1px solid var(--line-soft)', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-hi)' }}>
                  🖼️ Ảnh bảng giá gốc từ Petrolimex
                </span>
                {latestOcrImageUrl && (
                  <button
                    type="button"
                    onClick={() => setPreviewModalImage(latestOcrImageUrl)}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--line-soft)',
                      color: 'var(--text-mid)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                    }}
                  >
                    🔍 Phóng to ảnh
                  </button>
                )}
              </div>

              {latestOcrImageUrl ? (
                <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <img
                    id="ocr-source-image"
                    src={latestOcrImageUrl}
                    alt="Bảng giá xăng dầu Petrolimex"
                    onClick={() => setPreviewModalImage(latestOcrImageUrl)}
                    style={{
                      width: '100%',
                      maxHeight: '340px',
                      objectFit: 'contain',
                      background: '#09101d',
                      cursor: 'zoom-in',
                      display: 'block',
                      transition: 'transform 0.2s ease',
                    }}
                    title="Nhấp để phóng to ảnh bảng giá"
                  />
                  <div style={{ padding: '8px 12px', background: 'rgba(6, 13, 26, 0.85)', fontSize: '0.72rem', color: 'var(--text-mid)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                      Nguồn: {latestOcrImageUrl}
                    </span>
                    <a
                      href={latestOcrImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#60a5fa', textDecoration: 'underline' }}
                    >
                      Mở tab mới ↗
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-lo)', fontSize: '0.85rem' }}>
                  Không có liên kết ảnh gốc.
                </div>
              )}
            </div>

            {/* Cột Phải: Bảng 5 số nhận diện được */}
            <div>
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-hi)' }}>
                  📊 Các số nhận diện được ({ocrSuggestions.length} mặt hàng)
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-lo)' }}>
                  Nhấn "Duyệt" để copy từng số vào form
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {ocrSuggestions.map((s) => {
                  const flags = parseFlags(s.flags);
                  const isFlagged = s.needs_review === 1 || flags.length > 0;
                  const currentMatch = rows.find((r) => r.symbol === s.symbol);
                  const currentP1 = currentMatch ? Number(currentMatch.price_zone1) : 0;
                  const diff1 = s.price_zone1 - currentP1;

                  return (
                    <div
                      key={s.id}
                      id={`ocr-row-${s.symbol}`}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: isFlagged ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                        border: isFlagged
                          ? '1px solid rgba(239, 68, 68, 0.4)'
                          : '1px solid var(--line-soft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ minWidth: '150px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <strong style={{ color: 'var(--text-hi)', fontSize: '0.88rem' }}>
                            {s.symbol}
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-mid)' }}>
                            ({s.name || s.symbol})
                          </span>
                        </div>

                        {/* Cờ cảnh báo nếu bị flagged */}
                        {flags.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {flags.map((flag, idx) => {
                              const b = getFlagBadge(flag);
                              return (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 600,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: b.isDanger ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 166, 35, 0.2)',
                                    color: b.isDanger ? '#f87171' : '#fbbf24',
                                    border: `1px solid ${b.isDanger ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 166, 35, 0.4)'}`,
                                  }}
                                >
                                  ⚠️ {b.label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Số Vùng 1 và Vùng 2 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-lo)' }}>Vùng 1 (OCR)</div>
                          <div
                            style={{
                              fontSize: '0.98rem',
                              fontWeight: 700,
                              fontFamily: 'Roboto Mono',
                              color: isFlagged ? '#fbbf24' : 'var(--gold)',
                            }}
                          >
                            {s.price_zone1.toLocaleString('vi-VN')} đ
                          </div>
                        </div>

                        {s.price_zone2 != null && (
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-lo)' }}>Vùng 2 (OCR)</div>
                            <div
                              style={{
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                fontFamily: 'Roboto Mono',
                                color: 'var(--text-hi)',
                              }}
                            >
                              {s.price_zone2.toLocaleString('vi-VN')} đ
                            </div>
                          </div>
                        )}

                        {Math.abs(diff1) > 1 && (
                          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: diff1 > 0 ? 'var(--up)' : 'var(--down)' }}>
                            {diff1 > 0 ? `▲ +${diff1.toLocaleString('vi-VN')}` : `▼ ${diff1.toLocaleString('vi-VN')}`}
                          </div>
                        )}
                      </div>

                      {/* Nút hành động */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          id={`btn-approve-ocr-${s.symbol}`}
                          onClick={() => handleApproveOcrItem(s)}
                          className="btn-export"
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(52, 211, 153, 0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(52, 211, 153, 0.35)',
                            fontWeight: 600,
                            fontSize: '0.78rem',
                          }}
                          title="Copy số này vào dòng tương ứng trong bảng biểu mẫu bên dưới"
                        >
                          Duyệt vào Form
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDismissSuggestion(s.id)}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--line-soft)',
                            color: 'var(--text-lo)',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            fontSize: '0.75rem',
                          }}
                          title="Bỏ qua số này"
                        >
                          Bỏ qua
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Banner Gợi ý Scraper Văn bản (WebGia / Regex khác) ────────────────────────── */}
      {scraperSuggestions.length > 0 && (
        <section
          className="dash-card"
          style={{
            marginBottom: '24px',
            padding: '20px',
            border: hasDifference ? '1px solid rgba(245, 166, 35, 0.4)' : '1px solid var(--line-soft)',
            background: hasDifference ? 'linear-gradient(135deg, rgba(245, 166, 35, 0.08), rgba(11, 22, 40, 0.95))' : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>🔔</span>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: hasDifference ? 'var(--gold)' : 'var(--text-hi)' }}>
                {hasDifference ? 'Có thể đã đổi giá từ Scraper WebGia, xác nhận?' : 'Gợi ý giá từ Scraper tự động'}
              </h2>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-mid)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
              {scraperSuggestions.length} gợi ý chờ duyệt
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {scraperSuggestions.map((s) => {
              const currentMatch = rows.find((r) => r.symbol === s.symbol);
              const currentP = currentMatch ? Number(currentMatch.price_zone1) : 0;
              const diff = s.price_zone1 - currentP;
              const isDiff = Math.abs(diff) > 1;

              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--line-soft)',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ minWidth: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ color: 'var(--text-hi)', fontSize: '0.9rem' }}>{s.symbol}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-mid)' }}>({s.name || s.symbol})</span>
                      <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa' }}>
                        {s.source}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-mid)', marginTop: '4px' }}>
                      Mốc hiệu lực: <strong>{s.effective_at || 'Không xác định'}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '200px' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-lo)' }}>Giá đề xuất V1</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gold)', fontFamily: 'Roboto Mono' }}>
                        {s.price_zone1.toLocaleString('vi-VN')} đ
                      </div>
                    </div>
                    {isDiff && (
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: diff > 0 ? 'var(--up)' : 'var(--down)' }}>
                        {diff > 0 ? `▲ +${diff.toLocaleString('vi-VN')}` : `▼ ${diff.toLocaleString('vi-VN')}`} đ
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      id={`btn-approve-scrape-${s.id}`}
                      onClick={() => handleApproveOcrItem(s)}
                      className="btn-export"
                      style={{
                        padding: '6px 14px',
                        background: 'rgba(52, 211, 153, 0.18)',
                        color: '#34d399',
                        border: '1px solid rgba(52, 211, 153, 0.4)',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                      }}
                      title="Copy vào bảng biểu mẫu bên dưới"
                    >
                      Duyệt vào Form
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDismissSuggestion(s.id)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--line-soft)',
                        color: 'var(--text-lo)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                      }}
                    >
                      Bỏ qua
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Form 5 dòng nhập giá thủ công (Yêu cầu 1) ────────────────────────── */}
      <section className="dash-card" style={{ padding: '24px' }}>
        <div style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: '16px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-hi)' }}>
            Biểu giá bán lẻ 5 dòng chính thức
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-mid)', marginTop: '4px' }}>
            Hệ thống đã điền sẵn giá hiện tại hoặc số vừa được duyệt từ OCR. Bạn có thể sửa số và nhấn nút "Lưu Bảng Giá Mới" bên dưới.
          </p>
        </div>

        <form onSubmit={handleSave}>
          {/* Metadata chung: Ngày giờ hiệu lực + Ghi chú */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label htmlFor="fuel-effective-at" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-hi)', marginBottom: '6px' }}>
                📅 Ngày giờ hiệu lực <span style={{ color: 'var(--gold)' }}>*</span>
              </label>
              <input
                id="fuel-effective-at"
                type="datetime-local"
                value={effectiveAt}
                onChange={(e) => setEffectiveAt(e.target.value)}
                required
                className="tbl-search-input"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', fontSize: '0.9rem' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-lo)', display: 'block', marginTop: '4px' }}>
                Hiển thị trên web dưới dạng: "Giá có hiệu lực từ dd/MM HH:mm"
              </span>
            </div>

            <div>
              <label htmlFor="fuel-note" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-hi)', marginBottom: '6px' }}>
                📝 Ghi chú kỳ điều hành
              </label>
              <input
                id="fuel-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: Kỳ điều hành 15h 08/10/2026"
                className="tbl-search-input"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          {/* Bảng 5 dòng */}
          <div className="table-scroll-wrap" style={{ border: '1px solid var(--line-soft)', borderRadius: '10px', overflow: 'hidden', marginBottom: '24px' }}>
            <table className="quote-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th scope="col" style={{ width: '35%' }}>Mặt hàng nhiên liệu</th>
                  <th scope="col" className="text-right" style={{ width: '32%' }}>Giá Vùng 1 (VND/lít)</th>
                  <th scope="col" className="text-right" style={{ width: '33%' }}>Giá Vùng 2 (VND/lít)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.symbol} className="quote-row">
                    <td>
                      <div>
                        <strong style={{ color: 'var(--text-hi)', fontSize: '0.92rem' }}>{row.name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-mid)', fontFamily: 'Roboto Mono' }}>
                          Mã: {row.symbol}
                        </div>
                      </div>
                    </td>

                    <td className="text-right">
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          id={`input-v1-${row.symbol}`}
                          type="number"
                          step="10"
                          min="1000"
                          max="999000"
                          value={row.price_zone1}
                          onChange={(e) => handlePriceChange(row.symbol, 'price_zone1', e.target.value)}
                          className="tbl-search-input"
                          style={{
                            width: '140px',
                            textAlign: 'right',
                            fontFamily: 'Roboto Mono',
                            fontSize: '1rem',
                            fontWeight: 700,
                            padding: '8px 10px',
                            color: 'var(--gold)',
                          }}
                          required
                          aria-label={`Giá Vùng 1 của ${row.name}`}
                        />
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-lo)' }}>đ</span>
                      </div>
                    </td>

                    <td className="text-right">
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          id={`input-v2-${row.symbol}`}
                          type="number"
                          step="10"
                          min="1000"
                          max="999000"
                          value={row.price_zone2}
                          onChange={(e) => handlePriceChange(row.symbol, 'price_zone2', e.target.value)}
                          className="tbl-search-input"
                          style={{
                            width: '140px',
                            textAlign: 'right',
                            fontFamily: 'Roboto Mono',
                            fontSize: '1rem',
                            fontWeight: 700,
                            padding: '8px 10px',
                            color: 'var(--text-hi)',
                          }}
                          aria-label={`Giá Vùng 2 của ${row.name}`}
                        />
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-lo)' }}>đ</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer nút Lưu */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-lo)' }}>
              * Khi nhấn Lưu, biểu giá mới sẽ lập tức ghi đè lên bộ nhớ đệm và hiển thị ra trang chủ.
            </p>

            <button
              id="btn-save-fuel"
              type="submit"
              className="btn-export"
              disabled={saving}
              style={{
                padding: '12px 28px',
                fontSize: '0.95rem',
                fontWeight: 700,
                background: 'var(--gold)',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(245, 166, 35, 0.3)',
              }}
            >
              {saving ? '⏳ Đang lưu dữ liệu...' : '💾 Lưu Bảng Giá Mới'}
            </button>
          </div>
        </form>
      </section>

      {/* Modal phóng to ảnh */}
      <AnimatePresence>
        {previewModalImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewModalImage(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                position: 'relative',
                background: '#09101d',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid var(--line-dim)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-hi)' }}>
                  Bảng Giá Gốc Petrolimex
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewModalImage(null)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
              <img
                src={previewModalImage}
                alt="Bảng giá phóng to"
                style={{
                  maxWidth: '100%',
                  maxHeight: '75vh',
                  objectFit: 'contain',
                  borderRadius: '6px',
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
