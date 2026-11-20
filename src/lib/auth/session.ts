/**
 * Signed session tokens using Web Crypto (works in middleware and Node routes).
 * Token format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload)).
 */

export interface SessionPayload {
  sub: string; // operator email
  exp: number; // unix seconds
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createSessionToken(
  email: string,
  secret: string,
  ttlSeconds: number,
  nowMs = Date.now()
): Promise<string> {
  const payload: SessionPayload = {
    sub: email.toLowerCase(),
    exp: Math.floor(nowMs / 1000) + ttlSeconds,
  };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  nowMs = Date.now()
): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  try {
    // crypto.subtle.verify compares in constant time.
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      fromBase64Url(sig) as BufferSource,
      encoder.encode(body)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 <= nowMs) return null;
    return payload;
  } catch {
    return null;
  }
}
