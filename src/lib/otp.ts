/**
 * Phone verification helpers (WhatsApp OTP).
 *
 * Framework-free on purpose (only Web Crypto + fetch) so it runs on the Netlify edge runtime
 * and can be unit-tested on its own.
 *
 * Environment variables (all set in Netlify, never in code):
 *   OTP_ENABLED              "true" turns the OTP step ON. Anything else = OFF (site works as before).
 *   OTP_FAIL_OPEN            "false" = if WhatsApp cannot send, block the entry.
 *                            Default (unset) = if WhatsApp fails on OUR side, let the person through.
 *   WHATSAPP_ACCESS_TOKEN    Permanent Meta token with whatsapp_business_messaging permission.
 *   WHATSAPP_PHONE_NUMBER_ID The Phone number ID from Meta (WhatsApp Manager > API setup).
 *   WHATSAPP_OTP_TEMPLATE    Approved authentication template name (default: lf_otp).
 *   WHATSAPP_OTP_LANG        Template language code (default: en).
 *   WHATSAPP_API_VERSION     Graph API version (default: v23.0).
 */

export const OTP_TTL_MS = 5 * 60_000;          // a code is valid for 5 minutes
export const OTP_MAX_ATTEMPTS = 5;             // wrong guesses allowed per code
export const OTP_TOKEN_TTL_MS = 30 * 60_000;   // after verifying, the person has 30 min to submit
export const OTP_RESEND_COOLDOWN_MS = 30_000;  // min gap between two codes for one phone
export const OTP_SEND_WINDOW_MS = 10 * 60_000; // window for the per-phone send limit
export const OTP_MAX_SENDS_PER_WINDOW = 4;     // codes per phone per window

export function isOtpEnabled(): boolean {
  return process.env.OTP_ENABLED === "true";
}

export function isOtpFailOpen(): boolean {
  return process.env.OTP_FAIL_OPEN !== "false";
}

/** Uniform random 6-digit code ("000000"–"999999") using rejection sampling. */
export function generateOtpCode(): string {
  const limit = 4_294_000_000; // largest multiple of 1,000,000 below 2^32
  const buf = new Uint32Array(1);
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= limit);
  return String(n % 1_000_000).padStart(6, "0");
}

/** 64-char hex token (256 bits of randomness). */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The stored hash of a code is bound to its row id, so identical codes never share a hash. */
export function hashOtpCode(rowId: string, code: string): Promise<string> {
  return sha256Hex(`${rowId}:${code}`);
}

/** Compare two strings without bailing out at the first difference. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Body for Meta's Cloud API: an authentication template with a "copy code" button. */
export function buildWhatsAppOtpPayload(
  phone10: string,
  code: string,
  templateName: string,
  languageCode: string,
) {
  return {
    messaging_product: "whatsapp",
    to: `91${phone10}`,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: code }],
        },
      ],
    },
  };
}

/** Meta error codes that mean "this person's number cannot receive it" (not our fault). */
const USER_SIDE_ERROR_CODES = new Set([131026, 131021]);

export function isUserSideWhatsAppError(code: number | undefined): boolean {
  return code !== undefined && USER_SIDE_ERROR_CODES.has(code);
}

export type SendResult =
  | { ok: true }
  | { ok: false; userSide: boolean; metaCode?: number; detail: string };

export async function sendWhatsAppOtp(phone10: string, code: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { ok: false, userSide: false, detail: "WhatsApp is not configured on the server." };
  }

  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  const template = process.env.WHATSAPP_OTP_TEMPLATE || "lf_otp";
  const lang = process.env.WHATSAPP_OTP_LANG || "en";
  const body = buildWhatsAppOtpPayload(phone10, code, template, lang);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.ok) return { ok: true };

    let metaCode: number | undefined;
    let message = `WhatsApp API returned ${res.status}`;
    try {
      const json = (await res.json()) as { error?: { code?: number; message?: string } };
      metaCode = json.error?.code;
      if (json.error?.message) message = json.error.message;
    } catch {
      /* body was not JSON */
    }
    return {
      ok: false,
      userSide: isUserSideWhatsAppError(metaCode),
      metaCode,
      detail: message,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      userSide: false,
      detail: aborted ? "WhatsApp API timed out." : "Could not reach the WhatsApp API.",
    };
  } finally {
    clearTimeout(timer);
  }
}
