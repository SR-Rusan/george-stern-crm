import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/auth/guard';
import { StageChangeSchema } from '@/lib/schemas';
import { changeLeadStage, getLeadWithDetails } from '@/lib/repository';
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
    const parsed = StageChangeSchema.parse(body);

    const updated = await changeLeadStage(id, parsed);
    if (!updated) {
      return apiError('NOT_FOUND', 'Lead record not found.', 404);
    }

    const details = await getLeadWithDetails(id);
    return apiSuccess(details);
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to change pipeline stage.');
  }
}
