/**
 * Server-side Telegram notification dispatcher
 */
export async function sendServerTelegramAlert(message: string): Promise<boolean> {
  const token = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.VITE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '';

  if (!token || !chatId) {
    console.warn('[Server Telegram] Notice: VITE_TELEGRAM_BOT_TOKEN or VITE_TELEGRAM_CHAT_ID not set on server.');
    return false;
  }

  const cleanToken = token.trim();
  const cleanChatId = chatId.trim();

  try {
    let response = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    let data = await response.json();

    if (!response.ok && data?.error_code === 400 && data?.description?.includes('parse')) {
      // Retry without markdown
      response = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: message.replace(/[*`_]/g, ''),
        }),
      });
      data = await response.json();
    }

    if (response.ok && data.ok) {
      console.log('[Server Telegram] Alert sent successfully.');
      return true;
    } else {
      console.warn('[Server Telegram] Failed to send alert:', data);
      return false;
    }
  } catch (err) {
    console.error('[Server Telegram] Request error:', err);
    return false;
  }
}
