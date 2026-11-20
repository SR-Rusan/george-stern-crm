import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/auth/guard';
import {
  createInquiryLead,
  demoToolsEnabled,
  purgeDemoRecords,
  readStore,
  resetDemoData,
} from '@/lib/repository';
import { PublicInquirySubmissionInput } from '@/lib/schemas';
import { apiError, apiSuccess, handleZodOrServerError } from '@/lib/api-utils';

const SAMPLE_REPLAY_SCENARIOS: Record<string, PublicInquirySubmissionInput> = {
  executive_1on1: {
    name: 'Nadia Lindholm',
    email: `nadia.lindholm.${Date.now().toString(36)}@aurora-fictional.example.com`,
    organization: 'Aurora Robotics',
    role_type: 'founder_executive',
    team_size_range: '51-200',
    requested_service: 'one_to_one_coaching',
    challenge:
      'VP of Product newly overseeing 65 people across product and design after a merger. Need 1:1 executive coaching on unifying two leadership cultures and establishing executive decision cadences.',
    timing: 'now',
    source: 'guided_demo_replay',
    referrer: 'Demo Replay Action',
    consent_response: true,
    marketing_email_consent: true,
    website_url_hp: '',
  },
  corporate_cohort: {
    name: 'Tarek Mansour',
    email: `tarek.mansour.${Date.now().toString(36)}@helio-energy-demo.example.com`,
    organization: 'Helio Clean Energy',
    role_type: 'hr_ld',
    team_size_range: '16-50',
    requested_service: 'corporate_training',
    challenge:
      'Looking to run a leadership development program for 30 engineering and field operations managers this quarter focused on coaching skills, cross-team alignment, and accountability.',
    timing: 'now',
    source: 'guided_demo_replay',
    referrer: 'Demo Replay Action',
    consent_response: true,
    marketing_email_consent: true,
    website_url_hp: '',
  },
  ambiguous_review: {
    name: 'Alex Morgan',
    email: `alex.morgan.${Date.now().toString(36)}@ambiguous-demo.example.com`,
    organization: '',
    role_type: 'other',
    team_size_range: '',
    requested_service: 'one_to_one_coaching',
    challenge:
      'Looking for a keynote speaker for our 500 attendees summit next year, or maybe some general info. Not ready now, just browsing.',
    timing: 'now',
    source: 'guided_demo_replay',
    referrer: 'Demo Replay Action',
    consent_response: true,
    marketing_email_consent: false,
    website_url_hp: '',
  },
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireOperator(req);
    if ('denied' in auth) return auth.denied;
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'reset';

    if ((action === 'reset' || action === 'replay') && !demoToolsEnabled()) {
      return apiError(
        'DEMO_TOOLS_DISABLED',
        'Demo tools are disabled on this server. Set ENABLE_DEMO_TOOLS=true to use them.',
        403
      );
    }

    if (action === 'purge_demo') {
      const result = await purgeDemoRecords();
      return apiSuccess({
        purged: true,
        removed_leads: result.removed_leads,
        message: `Removed ${result.removed_leads} demo lead(s) and their activity.`,
      });
    }

    if (action === 'reset') {
      const store = await resetDemoData();
      return apiSuccess({
        reset: true,
        leads_count: store.leads.length,
        tasks_count: store.tasks.length,
        message: 'Demo leads reset.',
      });
    }

    if (action === 'replay') {
      const scenarioKey =
        typeof body.scenario === 'string' && body.scenario in SAMPLE_REPLAY_SCENARIOS
          ? body.scenario
          : 'executive_1on1';

      const template = SAMPLE_REPLAY_SCENARIOS[scenarioKey];
      // Ensure unique timestamped email so replay always creates a fresh demo lead
      const payload: PublicInquirySubmissionInput = {
        ...template,
        email: template.email.replace(
          /@/,
          `.${Math.floor(Math.random() * 9000 + 1000)}@`
        ),
      };

      const result = await createInquiryLead(payload, { is_demo: true });
      return apiSuccess(
        {
          replayed: true,
          scenario: scenarioKey,
          lead: result.lead,
        },
        201
      );
    }

    if (action === 'export') {
      const store = await readStore();
      return apiSuccess({
        exported_at: new Date().toISOString(),
        is_demo_export: store.leads.length > 0 && store.leads.every((l) => l.is_demo),
        leads: store.leads,
        activities: store.activities,
        tasks: store.tasks,
        settings: store.settings,
      });
    }

    return apiError('INVALID_ACTION', 'Unsupported demo action.', 400);
  } catch (err) {
    return handleZodOrServerError(err, 'Failed to run demo action.');
  }
}
