import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/auth/guard';
import { CreateTaskSchema } from '@/lib/schemas';
import { createTask, listTasksWithLeads } from '@/lib/repository';
import { apiError, apiSuccess, handleZodOrServerError } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireOperator(req);
    if ('denied' in auth) return auth.denied;
    const { searchParams } = new URL(req.url);
    const view =
      (searchParams.get('view') as
        | 'all'
        | 'overdue'
        | 'today'
        | 'upcoming'
        | 'completed') || 'all';
    const owner = searchParams.get('owner') || 'all';

    const tasks = await listTasksWithLeads({ view, owner });
    return apiSuccess({ tasks });
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to fetch tasks.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireOperator(req);
    if ('denied' in auth) return auth.denied;
    const body = await req.json();
    const parsed = CreateTaskSchema.parse(body);
    const actorLabel =
      typeof body.actor_label === 'string' && body.actor_label.trim()
        ? body.actor_label.trim()
        : 'CRM Operator';

    const task = await createTask(parsed, actorLabel);
    if (!task) {
      return apiError('NOT_FOUND', 'Associated lead record not found.', 404);
    }

    return apiSuccess({ task }, 201);
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to create task.');
  }
}
