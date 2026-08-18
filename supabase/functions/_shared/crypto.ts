export interface SessionPayload {
  userId: string;
  sessionId: string;
  sessionType: 'quick' | 'focus' | 'deep';
  durationSeconds: number;
  waterReward: number;
  pointsReward: number;
  adCount: number;
  startedAt: number; // Unix timestamp in ms
  nonce: string;
  quizId: string;
  correctOptionId: string;
}

const DEFAULT_SECRET = 'w4t-super-secure-anti-cheat-signing-key-2026';

function getSecretKey(): string {
  return Deno.env.get('EDGE_FUNCTION_SECRET') || Deno.env.get('JWT_SECRET') || DEFAULT_SECRET;
}

function base64UrlEncode(buffer: Uint8Array): string {
  let str = '';
  for (let i = 0; i < buffer.length; i++) {
    str += String.fromCharCode(buffer[i]);
  }
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const secret = getSecretKey();
  const key = await getCryptoKey(secret);
  const enc = new TextEncoder();

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(enc.encode(payloadJson));

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  const signatureB64 = base64UrlEncode(new Uint8Array(signatureBuffer));

  return `${payloadB64}.${signatureB64}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return null;
    }

    const [payloadB64, signatureB64] = parts;
    const secret = getSecretKey();
    const key = await getCryptoKey(secret);
    const enc = new TextEncoder();

    const signatureBytes = base64UrlDecode(signatureB64);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      enc.encode(payloadB64)
    );

    if (!isValid) {
      return null;
    }

    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    return JSON.parse(payloadJson) as SessionPayload;
  } catch (err) {
    console.error('[verifySessionToken] Error decoding token:', err);
    return null;
  }
}
