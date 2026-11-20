import { NextRequest } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { getAuthMode, getSessionSecret, SESSION_COOKIE_NAME } from './config';
import { verifySessionToken } from './session';

export interface OperatorIdentity {
  email: string | null; // null in open local demo mode
}

/**
 * Defence in depth: every operator API route checks the session itself,
 * so protection doesn't rely on middleware alone.
 * Returns an error response to send, or the operator identity.
 */
export async function requireOperator(
  req: NextRequest
): Promise<{ denied: ReturnType<typeof apiError> } | { operator: OperatorIdentity }> {
  const mode = getAuthMode();
  if (mode === 'open_dev') return { operator: { email: null } };
  if (mode === 'misconfigured') {
    return {
      denied: apiError(
        'AUTH_NOT_CONFIGURED',
        'Operator login is not configured on this server. Set CRM_OPERATORS and SESSION_SECRET.',
        503
      ),
    };
  }
  const secret = getSessionSecret()!;
  const session = await verifySessionToken(
    req.cookies.get(SESSION_COOKIE_NAME)?.value,
    secret
  );
  if (!session) {
    return { denied: apiError('UNAUTHENTICATED', 'Please log in to continue.', 401) };
  }
  return { operator: { email: session.sub } };
}
