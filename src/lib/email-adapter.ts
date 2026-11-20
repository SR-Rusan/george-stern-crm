import crypto from 'crypto';
import { CRMSettings, EmailTemplate, LeadRecord, SERVICE_ROUTE_LABELS } from './schemas';

export interface EmailDraftResult {
  recipient_name: string;
  recipient_email: string;
  subject: string;
  body: string;
  template_id: string;
  consent_granted: boolean;
  consent_timestamp: string | null;
  provider_configured: boolean;
  provider_name: string;
  can_send: boolean;
  send_blocked_reasons: string[];
}

export interface EmailSendResult {
  sent: boolean;
  mode: 'authorized_provider' | 'blocked' | 'provider_error';
  provider: string;
  message_id?: string;
  error?: string;
}

export const SUPPORTED_EMAIL_PROVIDERS = ['resend'] as const;
const RESEND_API_URL = 'https://api.resend.com/emails';
const EMAIL_SEND_TIMEOUT_MS = 10_000;

export function getEmailProviderStatus(): {
  provider: string;
  configured: boolean;
  from_address: string;
  problem: string | null;
} {
  const provider = (process.env.EMAIL_PROVIDER || 'disabled').trim().toLowerCase();
  const apiKey = (process.env.EMAIL_API_KEY || '').trim();
  const fromAddress = (process.env.EMAIL_FROM_ADDRESS || '').trim();

  let problem: string | null = null;
  if (provider === 'disabled' || provider === 'none' || provider === 'mock' || !provider) {
    problem = 'Email sending isn’t switched on yet. Copy the text and send it from your own inbox for now.';
  } else if (!(SUPPORTED_EMAIL_PROVIDERS as readonly string[]).includes(provider)) {
    problem = `EMAIL_PROVIDER "${provider}" is not supported. Supported: ${SUPPORTED_EMAIL_PROVIDERS.join(', ')}.`;
  } else if (apiKey.length <= 5) {
    problem = 'EMAIL_API_KEY is missing.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromAddress) || /@example\.(com|org|net)$/i.test(fromAddress)) {
    problem = 'EMAIL_FROM_ADDRESS must be a real address on a domain verified with the email provider.';
  }

  const configured = problem === null;
  return {
    provider: configured ? provider : 'disabled',
    configured,
    from_address: fromAddress,
    problem,
  };
}

/** Builds `"Business Name" <from@domain>` without letting the name inject headers. */
function formatFromHeader(fromAddress: string, fromName?: string): string {
  const cleanName = (fromName || '').replace(/["<>\r\n]/g, '').trim();
  return cleanName ? `${cleanName} <${fromAddress}>` : fromAddress;
}

/**
 * Generates a human-reviewable email draft from a template and lead record.
 * Never claims a call is already booked or makes guarantees about coaching outcomes.
 */
export function composeEmailDraft(
  lead: LeadRecord,
  settings: CRMSettings,
  templateId?: string
): EmailDraftResult {
  const effectiveRoute = lead.selected_route ?? lead.suggested_route;
  const templates = settings.email_templates || [];

  let chosenTemplate: EmailTemplate | undefined = templateId
    ? templates.find((t) => t.id === templateId)
    : templates.find((t) => t.route === effectiveRoute) || templates[0];

  if (!chosenTemplate) {
    chosenTemplate = {
      id: 'fallback_default',
      name: 'Standard follow-up',
      route: effectiveRoute,
      subject: `Following up on your inquiry — ${settings.business_name}`,
      body: `Hi {{lead_name}},\n\nThank you for contacting ${settings.business_name} regarding {{route_label}}.\n\nIf you would like to share any additional context or explore a brief introductory conversation, you can view our scheduling link here:\n{{booking_url}}\n\nBest regards,\n{{owner_label}}\n{{business_name}}`,
    };
  }

  const replacements: Record<string, string> = {
    // Greetings read better with the first name only ("Hi Hannah," not "Hi Hannah Okafor,").
    '{{lead_name}}': (lead.name.replace(/\s*\(Fictional Demo\)\s*/i, '').trim() || lead.name).split(/\s+/)[0],
    '{{organization}}': lead.organization?.trim() || 'your organization',
    '{{business_name}}': settings.business_name,
    '{{owner_label}}': lead.owner_label || settings.default_owner,
    '{{booking_url}}': settings.booking_url_placeholder,
    '{{route_label}}': SERVICE_ROUTE_LABELS[effectiveRoute],
  };

  let subject = chosenTemplate.subject;
  let body = chosenTemplate.body;

  for (const [token, val] of Object.entries(replacements)) {
    subject = subject.split(token).join(val);
    body = body.split(token).join(val);
  }

  const providerStatus = getEmailProviderStatus();
  const blockedReasons: string[] = [];

  if (!lead.email || !lead.email.includes('@')) {
    blockedReasons.push('Lead does not have a valid recipient email address.');
  }
  if (!lead.marketing_email_consent) {
    blockedReasons.push(
      'They didn’t agree to follow-up emails on the form.'
    );
  }
  if (lead.is_demo) {
    blockedReasons.push(
      'This is a demo lead, so emails to it are never sent.'
    );
  }
  if (!providerStatus.configured && providerStatus.problem) {
    blockedReasons.push(providerStatus.problem);
  }

  return {
    recipient_name: lead.name,
    recipient_email: lead.email,
    subject,
    body,
    template_id: chosenTemplate.id,
    consent_granted: Boolean(lead.marketing_email_consent),
    consent_timestamp: lead.marketing_email_consent_at,
    provider_configured: providerStatus.configured,
    provider_name: providerStatus.provider,
    can_send: blockedReasons.length === 0,
    send_blocked_reasons: blockedReasons,
  };
}

/**
 * Attempts to send a human-confirmed email.
 * Enforces strict guards:
 * 1. Explicit human confirmation flag must be true
 * 2. Recipient email must be valid
 * 3. Lead must have recorded email consent (marketing_email_consent === true)
 * 4. Seeded demo records (is_demo === true) never send real messages
 * 5. Authorized email provider must be configured in server env
 */
export async function sendHumanApprovedEmail(params: {
  lead: LeadRecord;
  subject: string;
  body: string;
  humanConfirmed: boolean;
  fromName?: string;
  /** Injected in tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}): Promise<EmailSendResult> {
  const { lead, subject, body, humanConfirmed, fromName } = params;
  const fetchImpl = params.fetchImpl ?? fetch;
  const providerStatus = getEmailProviderStatus();

  if (!humanConfirmed) {
    return {
      sent: false,
      mode: 'blocked',
      provider: providerStatus.provider,
      error: 'Explicit human confirmation is required before sending any email.',
    };
  }

  if (!lead.email || !lead.email.includes('@')) {
    return {
      sent: false,
      mode: 'blocked',
      provider: providerStatus.provider,
      error: 'Cannot send email: invalid recipient email address.',
    };
  }

  if (!lead.marketing_email_consent) {
    return {
      sent: false,
      mode: 'blocked',
      provider: providerStatus.provider,
      error: 'Cannot send email: follow-up email consent was not recorded for this lead.',
    };
  }

  if (lead.is_demo) {
    return {
      sent: false,
      mode: 'blocked',
      provider: providerStatus.provider,
      error: 'Emails to demo leads are never sent.',
    };
  }

  if (!providerStatus.configured) {
    return {
      sent: false,
      mode: 'blocked',
      provider: 'disabled',
      error: `Email sending is disabled: ${providerStatus.problem}`,
    };
  }

  if (!subject.trim() || !body.trim()) {
    return {
      sent: false,
      mode: 'blocked',
      provider: providerStatus.provider,
      error: 'Subject and body cannot be empty.',
    };
  }

  // Resend — https://resend.com/docs/api-reference/emails/send-email
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMAIL_SEND_TIMEOUT_MS);
  try {
    const replyTo = (process.env.EMAIL_REPLY_TO || '').trim();
    const res = await fetchImpl(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${(process.env.EMAIL_API_KEY || '').trim()}`,
        'Content-Type': 'application/json',
        // Resend de-duplicates retries carrying the same key for 24h.
        'Idempotency-Key': `lead-${lead.id}-${crypto.createHash('sha256').update(subject + '\n' + body).digest('hex').slice(0, 32)}`,
      },
      body: JSON.stringify({
        from: formatFromHeader(providerStatus.from_address, fromName),
        to: [lead.email],
        subject: subject.trim(),
        text: body,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: controller.signal,
    });

    const json = (await res.json().catch(() => null)) as
      | { id?: string; message?: string; name?: string }
      | null;

    if (!res.ok || !json?.id) {
      return {
        sent: false,
        mode: 'provider_error',
        provider: providerStatus.provider,
        error: `The email provider rejected the message (HTTP ${res.status}${
          json?.message ? `: ${json.message}` : ''
        }). Nothing was sent.`,
      };
    }

    return {
      sent: true,
      mode: 'authorized_provider',
      provider: providerStatus.provider,
      message_id: json.id,
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return {
      sent: false,
      mode: 'provider_error',
      provider: providerStatus.provider,
      error: timedOut
        ? 'The email provider did not respond in time. The email may not have been sent — check the provider dashboard before retrying.'
        : 'Could not reach the email provider. Nothing was sent.',
    };
  } finally {
    clearTimeout(timer);
  }
}
