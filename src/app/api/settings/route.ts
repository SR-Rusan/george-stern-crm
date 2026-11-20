import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/auth/guard';
import { CRMSettingsSchema } from '@/lib/schemas';
import {
  getIntegrationRuntimeStatus,
  getSettings,
  updateSettings,
} from '@/lib/repository';
import { SAMPLE_MAKE_WEBHOOK_PAYLOAD } from '@/lib/make-webhook';
import { apiSuccess, handleZodOrServerError } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireOperator(req);
    if ('denied' in auth) return auth.denied;
    const settings = await getSettings();
    const runtime = getIntegrationRuntimeStatus();
    return apiSuccess({
      settings,
      runtime,
      sample_make_payload: SAMPLE_MAKE_WEBHOOK_PAYLOAD,
    });
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to fetch settings.');
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireOperator(req);
    if ('denied' in auth) return auth.denied;
    const body = await req.json();
    const current = await getSettings();

    const parsed = CRMSettingsSchema.parse({
      ...current,
      ...body,
      id: 'default',
      updated_at: new Date().toISOString(),
    });

    const updated = await updateSettings(parsed);
    const runtime = getIntegrationRuntimeStatus();

    return apiSuccess({
      settings: updated,
      runtime,
    });
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to update settings.');
  }
}
