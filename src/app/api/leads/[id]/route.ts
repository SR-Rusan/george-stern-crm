import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/auth/guard';
import { UpdateLeadSchema } from '@/lib/schemas';
import {
  deleteLeadRecord,
  getLeadWithDetails,
  updateLeadRecord,
} from '@/lib/repository';
import { apiError, apiSuccess, handleZodOrServerError } from '@/lib/api-utils';

export async function GET(
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
    return apiSuccess(details);
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to fetch lead details.');
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOperator(req);
    if ('denied' in auth) return auth.denied;
    const { id } = await context.params;
    const body = await req.json();
    const actorLabel =
      typeof body.actor_label === 'string' && body.actor_label.trim()
        ? body.actor_label.trim()
        : 'CRM Operator';
    const parsed = UpdateLeadSchema.parse(body);
    const updated = await updateLeadRecord(id, parsed, actorLabel);
    if (!updated) {
      return apiError('NOT_FOUND', 'Lead record not found.', 404);
    }
    const details = await getLeadWithDetails(id);
    return apiSuccess(details);
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to update lead.');
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOperator(req);
    if ('denied' in auth) return auth.denied;
    const { id } = await context.params;
    const removed = await deleteLeadRecord(id);
    if (!removed) {
      return apiError('NOT_FOUND', 'Lead record not found.', 404);
    }
    return apiSuccess({ deleted: true, id });
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to delete lead.');
  }
}
