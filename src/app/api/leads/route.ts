import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/auth/guard';
import {
  PipelineStage,
  PriorityLabel,
  PublicInquirySubmissionSchema,
  ServiceRoute,
} from '@/lib/schemas';
import { createInquiryLead, listLeads } from '@/lib/repository';
import { apiSuccess, handleZodOrServerError } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireOperator(req);
    if ('denied' in auth) return auth.denied;
    const { searchParams } = new URL(req.url);
    const result = await listLeads({
      search: searchParams.get('search') || undefined,
      stage: (searchParams.get('stage') as PipelineStage | 'all') || 'all',
      route: (searchParams.get('route') as ServiceRoute | 'all') || 'all',
      priority: (searchParams.get('priority') as PriorityLabel | 'all') || 'all',
      source: searchParams.get('source') || 'all',
      owner: searchParams.get('owner') || 'all',
      follow_up_status:
        (searchParams.get('follow_up_status') as
          | 'all'
          | 'overdue'
          | 'upcoming'
          | 'none') || 'all',
      sort_by:
        (searchParams.get('sort_by') as
          | 'created_at'
          | 'priority_score'
          | 'last_activity_at'
          | 'follow_up_at') || 'created_at',
      sort_dir: (searchParams.get('sort_dir') as 'asc' | 'desc') || 'desc',
      page: Number(searchParams.get('page') || 1),
      page_size: Number(searchParams.get('page_size') || 50),
    });

    return apiSuccess(result);
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to list leads.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireOperator(req);
    if ('denied' in auth) return auth.denied;
    const body = await req.json();
    const parsed = PublicInquirySubmissionSchema.parse({
      ...body,
      consent_response: true,
      source: body.source || 'crm_manual_entry',
    });

    const result = await createInquiryLead(parsed, {
      is_demo: Boolean(body.is_demo),
    });

    return apiSuccess(result, 201);
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to create lead.');
  }
}
