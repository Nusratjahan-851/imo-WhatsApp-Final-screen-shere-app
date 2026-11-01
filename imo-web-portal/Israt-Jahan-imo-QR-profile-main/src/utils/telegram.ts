/**
 * Utility function to send notifications to Telegram bot
 */
export async function sendToTelegram(message: string): Promise<boolean> {
  const token =
    (typeof window !== 'undefined' && (window as any).TELEGRAM_BOT_TOKEN) ||
    import.meta.env.VITE_TELEGRAM_BOT_TOKEN ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('TELEGRAM_BOT_TOKEN')) ||
    '';

  const chatId =
    (typeof window !== 'undefined' && (window as any).TELEGRAM_CHAT_ID) ||
    import.meta.env.VITE_TELEGRAM_CHAT_ID ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('TELEGRAM_CHAT_ID')) ||
    '';

  console.log('[Telegram Alert]', message);

  if (!token || !chatId) {
    console.warn(
      '[Telegram Alert] Notice: VITE_TELEGRAM_BOT_TOKEN or VITE_TELEGRAM_CHAT_ID is not configured yet. Set them in your environment variables to receive live messages on Telegram.'
    );
    return false;
  }

  const cleanToken = token.trim();
  const cleanChatId = chatId.trim();

  try {
    // Attempt 1: Send with Markdown formatting
    let response = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    let data = await response.json();

    // If Markdown parsing failed (e.g. special characters in user agent string), retry without parse_mode
    if (!response.ok && data?.error_code === 400 && data?.description?.includes('parse')) {
      response = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: message.replace(/[*`_]/g, ''),
        }),
      });
      data = await response.json();
    }

    if (!response.ok || !data.ok) {
      if (data?.error_code === 403) {
        console.warn(
          `[Telegram Alert] ⚠️ Telegram 403 Forbidden: "${data?.description || 'Forbidden'}".\n` +
          `• If sending to a Channel: Add your bot as an Administrator to the channel with "Post Messages" permission.\n` +
          `• If sending to a User: The user must send /start to the bot first.\n` +
          `• If sending to a Group: Add the bot to the group.`
        );
      } else {
        console.warn(
          `[Telegram Alert] Telegram API notice (${data?.error_code || response.status}): ${data?.description || 'Unable to deliver message'}`
        );
      }
      return false;
    }

    console.log('[Telegram Alert] ✅ Successfully delivered to Telegram!');
    return true;
  } catch (error) {
    console.warn('[Telegram Alert] Network request could not reach Telegram API:', error);
    return false;
  }
}

// Make sendToTelegram globally accessible on window
if (typeof window !== 'undefined') {
  (window as any).sendToTelegram = sendToTelegram;
}
