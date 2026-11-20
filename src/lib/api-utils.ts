import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { StoreNotConfiguredError } from './store-backend';

export function generateCorrelationId(): string {
  return `req_${crypto.randomUUID().slice(0, 12)}`;
}

export function apiSuccess<T>(data: T, status = 200) {
  const correlationId = generateCorrelationId();
  return NextResponse.json(
    {
      ok: true,
      correlation_id: correlationId,
      data,
    },
    {
      status,
      headers: {
        'X-Correlation-Id': correlationId,
      },
    }
  );
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  issues?: Array<{ path: string; message: string }>
) {
  const correlationId = generateCorrelationId();
  return NextResponse.json(
    {
      ok: false,
      correlation_id: correlationId,
      error: {
        code,
        message,
        issues: issues ?? [],
      },
    },
    {
      status,
      headers: {
        'X-Correlation-Id': correlationId,
      },
    }
  );
}

export class RequestBodyError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'RequestBodyError';
  }
}

/** Reads and parses a JSON body, rejecting anything larger than `maxBytes`. */
export async function readJsonBody(req: Request, maxBytes = 64_000): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > maxBytes) {
    throw new RequestBodyError('Request body is too large.', 413);
  }
  const text = await req.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new RequestBodyError('Request body is too large.', 413);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new RequestBodyError('Request body must be valid JSON.', 400);
  }
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for') || '';
  return forwardedFor.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
}

export function handleZodOrServerError(err: unknown, fallbackMessage = 'Request could not be processed.') {
  if (err instanceof RequestBodyError) {
    return apiError(err.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON', err.message, err.status);
  }
  if (err instanceof StoreNotConfiguredError) {
    console.error('[crm] storage not configured:', err.message);
    return apiError('STORAGE_NOT_CONFIGURED', 'The CRM database is not configured on this server.', 503);
  }
  if (err instanceof ZodError) {
    return apiError(
      'VALIDATION_ERROR',
      err.issues[0]?.message || 'Validation failed.',
      400,
      err.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }))
    );
  }

  console.error('[crm] unhandled API error:', err);
  return apiError('INTERNAL_ERROR', fallbackMessage, 500);
}

// Simple in-memory rate limiter for the public inquiry form
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests = 8,
  windowMs = 60_000
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const existing = rateLimitBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}
