import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/auth/guard';
import {
  executeQualificationForLead,
  getLeadWithDetails,
} from '@/lib/repository';
import { apiError, apiSuccess, handleZodOrServerError } from '@/lib/api-utils';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOperator(req);
    if ('denied' in auth) return auth.denied;
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const actorLabel =
      typeof body.actor_label === 'string' && body.actor_label.trim()
        ? body.actor_label.trim()
        : 'CRM Operator (Manual Re-run)';

    const updated = await executeQualificationForLead(id, actorLabel);
    if (!updated) {
      return apiError('NOT_FOUND', 'Lead record not found.', 404);
    }

    const details = await getLeadWithDetails(id);
    return apiSuccess(details);
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to run qualification.');
  }
}
