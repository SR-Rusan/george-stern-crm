import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthMode,
  getSessionSecret,
  isPublicPath,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/config';
import { verifySessionToken } from '@/lib/auth/session';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { code, message, issues: [] } },
    { status }
  );
}

/**
 * Blocks cross-site form/fetch posts to operator routes. Browsers always send
 * Origin on cross-origin POSTs; same-origin requests either omit it or match.
 */
function isCrossSiteMutation(req: NextRequest): boolean {
  if (!MUTATING_METHODS.has(req.method)) return false;
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.nextUrl.host;
  } catch {
    return true;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');

  if (isPublicPath(pathname, req.method)) return NextResponse.next();

  if (isCrossSiteMutation(req)) {
    return jsonError('CROSS_SITE_REQUEST', 'Cross-site request blocked.', 403);
  }

  const mode = getAuthMode();
  if (mode === 'open_dev') return NextResponse.next();

  if (mode === 'misconfigured') {
    const message =
      'Operator login is not configured on this server. Set CRM_OPERATORS and SESSION_SECRET.';
    return isApi
      ? jsonError('AUTH_NOT_CONFIGURED', message, 503)
      : new NextResponse(message, {
          status: 503,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
  }

  const session = await verifySessionToken(
    req.cookies.get(SESSION_COOKIE_NAME)?.value,
    getSessionSecret()!
  );
  if (session) return NextResponse.next();

  if (isApi) return jsonError('UNAUTHENTICATED', 'Please log in to continue.', 401);

  const loginUrl = new URL('/login', req.url);
  if (pathname !== '/') loginUrl.searchParams.set('next', pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
