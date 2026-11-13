import crypto from 'node:crypto';

/**
 * Resolves the HMAC secret used for capability token signing and verification.
 */
export function getAuthSecret(): string {
  return process.env.SCRAPPY_AUTH_SECRET || 'scrappy-token-secret-key-default';
}

/**
 * Verifies an HMAC-signed capability token against `boardName` and expiration.
 */
export function verifyToken(
  tokenStr: string,
  boardName: string,
  secret: string = getAuthSecret()
): boolean {
  try {
    const [payloadB64, signature] = tokenStr.split('.');
    if (!payloadB64 || !signature) return false;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(payloadB64)
      .digest('hex');
    if (signature !== expectedSig) return false;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (payload.boardName !== boardName) return false;
    if (payload.exp && Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Issues an HMAC-signed 24h capability token scoped to a board and actor.
 */
export function createSignedToken(
  boardName: string,
  actorId: string,
  role = 'human',
  secret: string = getAuthSecret()
): string {
  const payload = {
    boardName,
    actorId,
    role,
    capabilities: ['read', 'write', 'agent', 'admin'],
    iat: Date.now(),
    exp: Date.now() + 24 * 3600 * 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('hex');
  return `${payloadB64}.${signature}`;
}

/**
 * Hashes a board passcode using SHA-256.
 */
export function hashPasscode(passcode: string): string {
  return crypto.createHash('sha256').update(String(passcode)).digest('hex');
}

/**
 * Checks whether an HTTP `Origin` header is permitted by local dev defaults or `CORS_ALLOWED_ORIGINS`.
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[]
): boolean {
  if (!origin) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }
  return allowedOrigins.includes(origin);
}
