// web/lib/auth/session.ts
import { AUTH_CONFIG } from "./config";
import { AuthUser, SessionPayload } from "./types";

/**
 * Chuyển đổi Uint8Array sang Base64URL an toàn chuẩn Web API
 */
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Chuyển đổi Base64URL sang Uint8Array
 */
function base64UrlToBytes(b64url: string): Uint8Array {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) {
    b64 += "=";
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Tạo khóa CryptoKey HMAC-SHA256 từ secret string
 */
async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Ký và tạo Session Token dạng Base64URL(Payload).Base64URL(HMAC-SHA256)
 */
export async function createSessionToken(user: AuthUser): Promise<string> {
  const now = Date.now();
  const exp = now + AUTH_CONFIG.sessionMaxAge * 1000;

  const payload: SessionPayload = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    iat: now,
    exp,
  };

  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const payloadB64 = bytesToBase64Url(payloadBytes);

  const key = await getCryptoKey(AUTH_CONFIG.secret);
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64)
  );
  const signatureB64 = bytesToBase64Url(new Uint8Array(signatureBuffer));

  return `${payloadB64}.${signatureB64}`;
}

/**
 * Xác minh tính hợp lệ và chữ ký của Session Token
 * Trả về payload nếu hợp lệ và chưa hết hạn; ngược lại trả về null
 */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, signatureB64] = parts;

  try {
    const key = await getCryptoKey(AUTH_CONFIG.secret);
    const signatureBytes = base64UrlToBytes(signatureB64);
    const dataBytes = new TextEncoder().encode(payloadB64);

    // Xác minh chữ ký HMAC
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes as unknown as BufferSource,
      dataBytes
    );

    if (!isValid) {
      return null;
    }

    // Giải mã payload
    const payloadBytes = base64UrlToBytes(payloadB64);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const payload: SessionPayload = JSON.parse(payloadJson);

    // Kiểm tra thời hạn hết hạn
    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }

    // Kiểm tra cấu trúc user
    if (!payload.user || !payload.user.email || !payload.user.role) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
