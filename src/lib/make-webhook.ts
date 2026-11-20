import crypto from 'crypto';
import { LeadRecord } from './schemas';
import { client } from '@/config/client';

export type MakeWebhookEventName =
  | 'lead.created'
  | 'lead.qualified'
  | 'lead.stage_changed';

export interface MakeOutboundWebhookPayload {
  event_id: string;
  idempotency_key: string;
  event_type: MakeWebhookEventName;
  occurred_at: string;
  is_demo: boolean;
  lead: {
    id: string;
    created_at: string;
    name: string;
    organization: string | null;
    role_type: string;
    team_size_range: string | null;
    requested_service: string;
    timing: string;
    pipeline_stage: string;
    suggested_route: string;
    selected_route: string | null;
    priority_score: number;
    priority_label: string;
    ai_confidence: number | null;
    ai_suggested_next_action: string | null;
    qualification_status: string;
    marketing_email_consent: boolean;
    owner_label: string;
  };
}

export function getMakeWebhookStatus(): {
  enabled: boolean;
  url_configured: boolean;
  secret_configured: boolean;
} {
  const enabled =
    (process.env.MAKE_WEBHOOK_ENABLED || 'false').trim().toLowerCase() === 'true';
  const url = (process.env.MAKE_WEBHOOK_URL || '').trim();
  const secret = (process.env.MAKE_WEBHOOK_SECRET || '').trim();

  return {
    enabled: enabled && url.startsWith('https://'),
    url_configured: url.startsWith('https://'),
    secret_configured: secret.length >= 8,
  };
}

/**
 * Generates an HMAC-SHA256 signature for Make.com webhook verification.
 */
export function signWebhookPayload(bodyJson: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(bodyJson, 'utf8').digest('hex');
}

/** Constant-time string comparison (hashes first so lengths never leak). */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Authorises an inbound Make.com call by either the shared secret header
 * or an HMAC-SHA256 signature of the raw body. Comparisons are constant-time.
 */
export function verifyInboundWebhookAuth(params: {
  rawBody: string;
  secret: string;
  headerSecret: string | null;
  signatureHeader: string | null;
}): boolean {
  const { rawBody, secret, headerSecret, signatureHeader } = params;
  if (!secret) return false;
  const secretOk = headerSecret ? safeEqual(headerSecret, secret) : false;
  const expectedSignature = `sha256=${signWebhookPayload(rawBody, secret)}`;
  const signatureOk = signatureHeader ? safeEqual(signatureHeader, expectedSignature) : false;
  return secretOk || signatureOk;
}

/**
 * Dispatches a normalized, minimal lead event to Make.com if enabled on the server.
 * Never throws or blocks CRM persistence if Make is disabled or unreachable.
 */
export async function dispatchMakeWebhookEvent(
  eventType: MakeWebhookEventName,
  lead: LeadRecord
): Promise<{
  dispatched: boolean;
  reason?: string;
  idempotency_key: string;
}> {
  const idempotencyKey = `${eventType}:${lead.id}:${lead.updated_at}`;
  const status = getMakeWebhookStatus();

  if (!status.enabled) {
    return {
      dispatched: false,
      reason: 'Make.com webhook integration is disabled by default.',
      idempotency_key: idempotencyKey,
    };
  }

  const webhookUrl = (process.env.MAKE_WEBHOOK_URL || '').trim();
  const secret = (process.env.MAKE_WEBHOOK_SECRET || '').trim();

  const payload: MakeOutboundWebhookPayload = {
    event_id: `evt_${crypto.randomUUID()}`,
    idempotency_key: idempotencyKey,
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    is_demo: lead.is_demo,
    lead: {
      id: lead.id,
      created_at: lead.created_at,
      name: lead.name,
      organization: lead.organization,
      role_type: lead.role_type,
      team_size_range: lead.team_size_range || null,
      requested_service: lead.requested_service,
      timing: lead.timing,
      pipeline_stage: lead.pipeline_stage,
      suggested_route: lead.suggested_route,
      selected_route: lead.selected_route,
      priority_score: lead.priority_score,
      priority_label: lead.priority_label,
      ai_confidence: lead.ai_confidence,
      ai_suggested_next_action: lead.ai_suggested_next_action,
      qualification_status: lead.qualification_status,
      marketing_email_consent: lead.marketing_email_consent,
      owner_label: lead.owner_label,
    },
  };

  const serialized = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Idempotency-Key': idempotencyKey,
    'X-Event-Type': eventType,
  };

  if (secret) {
    headers['X-Webhook-Signature'] = `sha256=${signWebhookPayload(serialized, secret)}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: serialized,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return {
      dispatched: res.ok,
      reason: res.ok ? undefined : `Make webhook returned HTTP ${res.status}`,
      idempotency_key: idempotencyKey,
    };
  } catch {
    clearTimeout(timer);
    return {
      dispatched: false,
      reason: 'Make webhook request failed or timed out; CRM state preserved.',
      idempotency_key: idempotencyKey,
    };
  }
}

export const SAMPLE_MAKE_WEBHOOK_PAYLOAD: MakeOutboundWebhookPayload = {
  event_id: 'evt_9f8c7b6a-1234-4abc-8def-0123456789ab',
  idempotency_key:
    'lead.qualified:11111111-1111-4111-8111-111111111101:2026-09-26T10:00:00.000Z',
  event_type: 'lead.qualified',
  occurred_at: '2026-09-26T10:00:02.000Z',
  is_demo: true,
  lead: {
    id: '11111111-1111-4111-8111-111111111101',
    created_at: '2026-09-24T10:00:00.000Z',
    name: 'Elena Rostova',
    organization: 'Apex Cloud Systems (Demo)',
    role_type: 'manager',
    team_size_range: '6-15',
    requested_service: 'one_to_one_coaching',
    timing: 'now',
    pipeline_stage: 'new_inquiry',
    suggested_route: 'one_to_one_coaching',
    selected_route: null,
    priority_score: 5,
    priority_label: 'Medium',
    ai_confidence: 0.94,
    ai_suggested_next_action: 'Offer a discovery call',
    qualification_status: 'mock_completed',
    marketing_email_consent: true,
    owner_label: client.business.ownerLabel,
  },
};
