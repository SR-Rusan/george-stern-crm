import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  getAuthMode,
  getOperators,
  getSessionSecret,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from '@/lib/auth/config';
import { burnPasswordCheck, verifyPassword } from '@/lib/auth/password';
import { createSessionToken } from '@/lib/auth/session';
import {
  apiError,
  apiSuccess,
  checkRateLimit,
  getClientIp,
  handleZodOrServerError,
  readJsonBody,
} from '@/lib/api-utils';

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().min(1).max(200),
});

const GENERIC_FAILURE = 'Incorrect email or password.';

export async function POST(req: NextRequest) {
  try {
    if (getAuthMode() !== 'enforced') {
      return apiError(
        'AUTH_NOT_CONFIGURED',
        'Operator login is not configured on this server.',
        400
      );
    }

    const ip = getClientIp(req);
    const ipLimit = checkRateLimit(`login_ip:${ip}`, 10, 15 * 60_000);
    if (!ipLimit.allowed) {
      return apiError(
        'RATE_LIMITED',
        `Too many login attempts. Try again in ${Math.ceil(ipLimit.retryAfterSec / 60)} minutes.`,
        429
      );
    }

    const parsed = LoginSchema.parse(await readJsonBody(req, 4_096));
    const emailLimit = checkRateLimit(`login_email:${parsed.email}`, 5, 15 * 60_000);
    if (!emailLimit.allowed) {
      return apiError(
        'RATE_LIMITED',
        `Too many login attempts. Try again in ${Math.ceil(emailLimit.retryAfterSec / 60)} minutes.`,
        429
      );
    }

    const operator = getOperators().find((o) => o.email === parsed.email);
    const valid = operator
      ? await verifyPassword(parsed.password, operator.passwordHash)
      : (await burnPasswordCheck(parsed.password), false);

    if (!operator || !valid) {
      return apiError('INVALID_CREDENTIALS', GENERIC_FAILURE, 401);
    }

    const token = await createSessionToken(
      operator.email,
      getSessionSecret()!,
      SESSION_TTL_SECONDS
    );
    const res = apiSuccess({ email: operator.email });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    return res;
  } catch (err) {
    return handleZodOrServerError(err, 'Login failed.');
  }
}
