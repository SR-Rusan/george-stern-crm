import crypto from 'crypto';

/**
 * Password hashing with scrypt (Node built-in, no extra dependency).
 * Stored format: `scrypt.<salt base64url>.<key base64url>` — no `$` characters,
 * because Next.js expands `$VAR` references inside .env files.
 * Keep in sync with scripts/hash-password.mjs.
 */

const KEY_LENGTH = 32;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt.${salt.toString('base64url')}.${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('.');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'base64url');
  const expected = Buffer.from(parts[2], 'base64url');
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;
  const actual = await scryptAsync(password, salt);
  return crypto.timingSafeEqual(actual, expected);
}

/** Same cost as a real check, so unknown emails can't be detected by timing. */
const DUMMY_HASH_PROMISE = hashPassword(crypto.randomBytes(12).toString('hex'));

export async function burnPasswordCheck(password: string): Promise<void> {
  await verifyPassword(password, await DUMMY_HASH_PROMISE);
}
