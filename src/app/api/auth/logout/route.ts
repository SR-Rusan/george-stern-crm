import { SESSION_COOKIE_NAME } from '@/lib/auth/config';
import { apiSuccess } from '@/lib/api-utils';

export async function POST() {
  const res = apiSuccess({ logged_out: true });
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
