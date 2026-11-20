import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/auth/guard';
import {
  EmailDraftRequestSchema,
  EmailSendRequestSchema,
} from '@/lib/schemas';
import {
  getLeadWithDetails,
  getSettings,
  recordLeadActivity,
} from '@/lib/repository';
import {
  composeEmailDraft,
  sendHumanApprovedEmail,
} from '@/lib/email-adapter';
import { apiError, apiSuccess, handleZodOrServerError } from '@/lib/api-utils';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOperator(req);
    if ('denied' in auth) return auth.denied;
    const { id } = await context.params;
    const details = await getLeadWithDetails(id);
    if (!details) {
      return apiError('NOT_FOUND', 'Lead record not found.', 404);
    }

    const settings = await getSettings();
    const body = await req.json();
    const action = body.action === 'send' ? 'send' : 'draft';

    if (action === 'draft') {
      const parsed = EmailDraftRequestSchema.parse(body);
      const draft = composeEmailDraft(
        details.lead,
        settings,
        parsed.template_id
      );

      if (parsed.custom_subject) draft.subject = parsed.custom_subject;
      if (parsed.custom_body) draft.body = parsed.custom_body;

      await recordLeadActivity({
        lead_id: id,
        actor_type: 'user',
        actor_label: 'CRM Operator',
        event_type: 'email_drafted',
        summary: `Generated email draft ("${draft.subject}") for human review.`,
        metadata: {
          template_id: draft.template_id,
          can_send: draft.can_send,
        },
      });

      const refreshed = await getLeadWithDetails(id);
      return apiSuccess({
        draft,
        lead_details: refreshed,
      });
    }

    // Action === 'send'
    const parsedSend = EmailSendRequestSchema.parse(body);
    const sendResult = await sendHumanApprovedEmail({
      lead: details.lead,
      subject: parsedSend.subject,
      body: parsedSend.body,
      humanConfirmed: parsedSend.human_confirmed,
      fromName: settings.business_name,
    });

    if (!sendResult.sent) {
      return sendResult.mode === 'provider_error'
        ? apiError('EMAIL_PROVIDER_ERROR', sendResult.error || 'The email provider failed.', 502)
        : apiError('EMAIL_SEND_BLOCKED', sendResult.error || 'Email sending is blocked.', 400);
    }

    await recordLeadActivity({
      lead_id: id,
      actor_type: 'user',
      actor_label: parsedSend.actor_label,
      event_type: 'email_sent',
      summary: `Sent human-approved email ("${parsedSend.subject}") via ${sendResult.provider}.`,
      metadata: {
        provider: sendResult.provider,
        message_id: sendResult.message_id,
      },
    });

    const refreshed = await getLeadWithDetails(id);
    return apiSuccess({
      send_result: sendResult,
      lead_details: refreshed,
    });
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to process email action.');
  }
}
