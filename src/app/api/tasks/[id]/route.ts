import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/auth/guard';
import { CompleteTaskSchema } from '@/lib/schemas';
import { toggleTaskCompletion } from '@/lib/repository';
import { apiError, apiSuccess, handleZodOrServerError } from '@/lib/api-utils';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOperator(req);
    if ('denied' in auth) return auth.denied;
    const { id } = await context.params;
    const body = await req.json();
    const parsed = CompleteTaskSchema.parse(body);

    const updated = await toggleTaskCompletion(
      id,
      parsed.completed,
      parsed.actor_label
    );
    if (!updated) {
      return apiError('NOT_FOUND', 'Task record not found.', 404);
    }

    return apiSuccess({ task: updated });
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to update task.');
  }
}
