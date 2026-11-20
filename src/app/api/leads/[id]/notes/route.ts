import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/auth/guard';
import { AddNoteSchema } from '@/lib/schemas';
import { addLeadNote, getLeadWithDetails } from '@/lib/repository';
import { apiError, apiSuccess, handleZodOrServerError } from '@/lib/api-utils';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOperator(req);
    if ('denied' in auth) return auth.denied;
    const { id } = await context.params;
    const body = await req.json();
    const parsed = AddNoteSchema.parse(body);

    const result = await addLeadNote(id, parsed.note, parsed.actor_label);
    if (!result) {
      return apiError('NOT_FOUND', 'Lead record not found.', 404);
    }

    const details = await getLeadWithDetails(id);
    return apiSuccess(details);
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to add note.');
  }
}
