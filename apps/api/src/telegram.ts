// src/telegram.ts
// Helper gửi thông báo Telegram bot khi phát hiện gợi ý giá xăng dầu thay đổi

import type { Env } from './types.js';

export async function sendTelegramAlert(env: Env, text: string): Promise<boolean> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    // Không có token / chat_id thì bỏ qua âm thầm, không lỗi
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      console.warn(`[Telegram] Gửi tin nhắn không thành công, mã trạng thái HTTP: ${res.status}`);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[Telegram] Gặp lỗi khi gửi thông báo:', err instanceof Error ? err.message : String(err));
    return false;
  }
}
