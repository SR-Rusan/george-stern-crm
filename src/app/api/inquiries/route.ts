import { NextRequest } from 'next/server';
import { PublicInquirySubmissionSchema } from '@/lib/schemas';
import { createInquiryLead } from '@/lib/repository';
import { client } from '@/config/client';
import {
  apiError,
  apiSuccess,
  checkRateLimit,
  getClientIp,
  handleZodOrServerError,
  readJsonBody,
} from '@/lib/api-utils';

/**
 * POST /api/inquiries
 * Public Inquiry Intake Endpoint (separated from internal CRM operations).
 * - Rate-limited per IP
 * - Honeypot spam check
 * - Server-side Zod validation
 * - Persists lead even if OpenRouter is offline
 * - Returns calm confirmation without disclosing internal priority score or routing logic
 */
export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);

    const rate = checkRateLimit(`public_inquiry:${clientIp}`, 10, 60_000);
    if (!rate.allowed) {
      return apiError(
        'RATE_LIMITED',
        `Too many submissions from this connection. Please wait ${rate.retryAfterSec} seconds and try again.`,
        429
      );
    }

    const rawBody = (await readJsonBody(req, 16_000)) as Record<string, unknown>;

    // Honeypot check: if a bot filled in website_url_hp, return a quiet 200 without storing spam
    if (
      rawBody &&
      typeof rawBody.website_url_hp === 'string' &&
      rawBody.website_url_hp.trim().length > 0
    ) {
      return apiSuccess(
        {
          received: true,
          reference_code: 'INQ-RECEIVED',
          message:
            'Thank you. Your inquiry has been received and a member of our team will review it.',
        },
        200
      );
    }

    const parsed = PublicInquirySubmissionSchema.parse(rawBody);
    const { lead, duplicate_prevented } = await createInquiryLead(parsed, {
      is_demo: false,
    });

    // Public response deliberately omits priority_score, suggested_route, score_breakdown, and email
    return apiSuccess(
      {
        received: true,
        duplicate_prevented,
        reference_code: `INQ-${lead.id.slice(0, 8).toUpperCase()}`,
        submitted_at: lead.created_at,
        message: client.form.confirmationMessage,
      },
      201
    );
  } catch (err) {
    return handleZodOrServerError(
      err,
      'We could not process your inquiry right now. Please check your entries and try again.'
    );
  }
}
