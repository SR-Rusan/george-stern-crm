import { NextRequest } from 'next/server';
import { getMakeWebhookStatus, verifyInboundWebhookAuth } from '@/lib/make-webhook';
import { PublicInquirySubmissionSchema } from '@/lib/schemas';
import { createInquiryLead } from '@/lib/repository';
import {
  apiError,
  apiSuccess,
  checkRateLimit,
  getClientIp,
  handleZodOrServerError,
  RequestBodyError,
} from '@/lib/api-utils';

/**
 * POST /api/webhooks/make
 * Optional Make.com inbound webhook adapter.
 * Disabled by default unless MAKE_WEBHOOK_ENABLED=true and MAKE_WEBHOOK_SECRET is configured.
 */
export async function POST(req: NextRequest) {
  try {
    const status = getMakeWebhookStatus();
    const secret = (process.env.MAKE_WEBHOOK_SECRET || '').trim();

    if (!status.secret_configured) {
      return apiError(
        'WEBHOOK_DISABLED',
        'Make.com inbound webhook is disabled by default. Configure MAKE_WEBHOOK_SECRET on the server to authorize inbound scenarios.',
        503
      );
    }

    const rate = checkRateLimit(`make_webhook:${getClientIp(req)}`, 60, 60_000);
    if (!rate.allowed) {
      return apiError('RATE_LIMITED', 'Too many webhook calls.', 429);
    }

    const rawText = await req.text();
    if (Buffer.byteLength(rawText, 'utf8') > 32_000) {
      throw new RequestBodyError('Request body is too large.', 413);
    }

    const authorized = verifyInboundWebhookAuth({
      rawBody: rawText,
      secret,
      headerSecret: req.headers.get('x-webhook-secret'),
      signatureHeader: req.headers.get('x-webhook-signature'),
    });

    if (!authorized) {
      return apiError(
        'UNAUTHORIZED_WEBHOOK',
        'Invalid or missing Make.com webhook signature/secret.',
        401
      );
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawText);
    } catch {
      throw new RequestBodyError('Request body must be valid JSON.', 400);
    }
    const parsed = PublicInquirySubmissionSchema.parse({
      ...body,
      source: body.source || 'make_webhook_inbound',
      consent_response: true,
    });

    const result = await createInquiryLead(parsed, {
      is_demo: Boolean(body.is_demo),
    });

    return apiSuccess(
      {
        processed: true,
        duplicate_prevented: result.duplicate_prevented,
        lead_id: result.lead.id,
        suggested_route: result.lead.suggested_route,
        priority_score: result.lead.priority_score,
      },
      201
    );
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to process Make.com webhook event.');
  }
}
