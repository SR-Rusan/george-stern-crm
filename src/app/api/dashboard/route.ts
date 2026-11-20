import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/auth/guard';
import {
  computeDashboardMetrics,
  getIntegrationRuntimeStatus,
  getSettings,
} from '@/lib/repository';
import { apiSuccess, handleZodOrServerError } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireOperator(req);
    if ('denied' in auth) return auth.denied;
    const { searchParams } = new URL(req.url);
    const periodParam = searchParams.get('period_days') || 'all';
    const periodDays =
      periodParam === 'all' ? 'all' : Math.max(1, Number(periodParam) || 30);
    const source = searchParams.get('source') || 'all';

    const [metrics, settings, runtime] = await Promise.all([
      computeDashboardMetrics({ period_days: periodDays, source }),
      getSettings(),
      Promise.resolve(getIntegrationRuntimeStatus()),
    ]);

    return apiSuccess({
      metrics,
      settings,
      runtime,
    });
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to load dashboard metrics.');
  }
}
