/**
 * Operator login configuration. Edge-safe: no Node-only imports, because
 * middleware.ts imports this file.
 *
 * Env:
 *   CRM_OPERATORS   comma-separated `email=scrypt.<salt>.<hash>` entries
 *                   (generate with `npm run hash-password -- you@example.com`)
 *   SESSION_SECRET  random string, at least 32 characters
 */

export const SESSION_COOKIE_NAME = 'crm_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const MIN_SESSION_SECRET_LENGTH = 32;

export type AuthMode = 'enforced' | 'open_dev' | 'misconfigured';

export interface OperatorAccount {
  email: string;
  passwordHash: string;
}

export function parseOperators(raw: string | undefined): OperatorAccount[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const sep = entry.indexOf('=');
      if (sep <= 0) return null;
      const email = entry.slice(0, sep).trim().toLowerCase();
      const passwordHash = entry.slice(sep + 1).trim();
      if (!email.includes('@') || !passwordHash.startsWith('scrypt.')) return null;
      return { email, passwordHash };
    })
    .filter((x): x is OperatorAccount => x !== null);
}

export function getOperators(): OperatorAccount[] {
  return parseOperators(process.env.CRM_OPERATORS);
}

export function getSessionSecret(): string | null {
  const secret = (process.env.SESSION_SECRET || '').trim();
  return secret.length >= MIN_SESSION_SECRET_LENGTH ? secret : null;
}

/**
 * - enforced:      operators + session secret configured → login required.
 * - open_dev:      nothing configured and not production → local demo stays open.
 * - misconfigured: production without complete login config → operator area locked.
 */
export function getAuthMode(): AuthMode {
  if (getOperators().length > 0 && getSessionSecret()) return 'enforced';
  if (process.env.NODE_ENV !== 'production') return 'open_dev';
  return 'misconfigured';
}

/** Routes anyone may reach without logging in. */
export function isPublicPath(pathname: string, method: string): boolean {
  if (pathname === '/inquire' || pathname === '/login') return true;
  if (pathname === '/api/auth/login' || pathname === '/api/auth/logout') return true;
  if (pathname === '/api/public/branding') return true;
  if (pathname === '/api/webhooks/make') return true; // has its own secret check
  if (pathname === '/api/inquiries' && method === 'POST') return true;
  return false;
}
