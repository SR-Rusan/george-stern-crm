import path from 'path';
import crypto from 'crypto';
import {
  ActivityEventType,
  ActivityRecord,
  CreateTaskInput,
  CRMSettings,
  IntegrationRuntimeStatus,
  LeadRecord,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGES,
  PipelineStage,
  PriorityLabel,
  PublicInquirySubmissionInput,
  SERVICE_ROUTE_LABELS,
  SERVICE_ROUTES,
  ServiceRoute,
  StageChangeInput,
  TaskRecord,
  UpdateLeadInput,
} from './schemas';
import { buildDefaultSettings, buildSeedDataset } from './seed-data';
import { computeDeterministicScoreAndRoute } from './scoring';
import { qualifyInquiry } from './qualification';
import { getEmailProviderStatus } from './email-adapter';
import { dispatchMakeWebhookEvent, getMakeWebhookStatus } from './make-webhook';
import {
  createLocalFileBackend,
  createPostgresBackend,
  StoreBackend,
  StoreNotConfiguredError,
} from './store-backend';
import { getAuthMode } from './auth/config';

export interface LocalStoreData {
  leads: LeadRecord[];
  activities: ActivityRecord[];
  tasks: TaskRecord[];
  settings: CRMSettings;
}

export interface LeadListFilters {
  search?: string;
  stage?: PipelineStage | 'all';
  route?: ServiceRoute | 'all';
  priority?: PriorityLabel | 'all';
  source?: string | 'all';
  owner?: string | 'all';
  follow_up_status?: 'all' | 'overdue' | 'upcoming' | 'none';
  sort_by?:
    | 'created_at'
    | 'priority_score'
    | 'last_activity_at'
    | 'follow_up_at';
  sort_dir?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export interface DashboardMetrics {
  period_days: number | 'all';
  source_filter: string;
  is_demo_dataset: boolean;
  total_leads_count: number;
  new_leads_in_period: number;
  qualified_leads_count: number;
  calls_booked_count: number;
  won_deals_count: number;
  lost_deals_count: number;
  won_revenue: number | null;
  won_deals_with_value_count: number;
  qualification_rate_pct: number | null;
  call_booking_rate_pct: number | null;
  win_rate_pct: number | null;
  attention_required_leads: LeadRecord[];
  overdue_tasks_count: number;
  pipeline_by_stage: Record<PipelineStage, number>;
  routes_breakdown: Record<ServiceRoute, number>;
  recent_activities: ActivityRecord[];
  sources_available: string[];
}

// Allow tests to override the file path so tests run in an isolated store
let customStoreFilePath: string | null = null;
let cachedBackend: {
  key: string;
  backend: StoreBackend<LocalStoreData>;
} | null = null;

export function setTestStoreFilePath(filePath: string | null): void {
  customStoreFilePath = filePath;
  cachedBackend = null;
}

function getDatabaseUrl(): string {
  return (process.env.DATABASE_URL || '').trim();
}

export function isDatabaseConfigured(): boolean {
  return !customStoreFilePath && /^postgres(ql)?:\/\//i.test(getDatabaseUrl());
}

function localFileStoreAllowed(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.ALLOW_LOCAL_FILE_STORE === 'true'
  );
}

export type StorageMode = 'postgres' | 'local_file' | 'not_configured';

export function getStorageMode(): StorageMode {
  if (isDatabaseConfigured()) return 'postgres';
  if (customStoreFilePath || localFileStoreAllowed()) return 'local_file';
  return 'not_configured';
}

export function demoToolsEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_DEMO_TOOLS === 'true'
  );
}

export function getIntegrationRuntimeStatus(): IntegrationRuntimeStatus {
  const openrouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
  const openrouterConfigured = openrouterKey.length > 8;
  const openrouterModel = (
    process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'
  ).trim();
  const emailStatus = getEmailProviderStatus();
  const makeStatus = getMakeWebhookStatus();

  return {
    storage_mode: getStorageMode(),
    database_configured: isDatabaseConfigured(),
    auth_mode: getAuthMode(),
    demo_tools_enabled: demoToolsEnabled(),
    openrouter_configured: openrouterConfigured,
    openrouter_model: openrouterModel,
    openrouter_mode: openrouterConfigured ? 'live_openrouter' : 'mock_fallback',
    email_provider: emailStatus.provider,
    email_configured: emailStatus.configured,
    email_mode: emailStatus.configured
      ? 'authorized_provider'
      : 'draft_only_disabled',
    make_webhook_enabled: makeStatus.enabled,
    make_webhook_configured: makeStatus.url_configured,
    make_secret_configured: makeStatus.secret_configured,
  };
}

// ============================================================================
// Versioned Store Access (Postgres in production, JSON file for local demos)
// ============================================================================

function getBackend(): StoreBackend<LocalStoreData> {
  const mode = getStorageMode();
  if (mode === 'not_configured') {
    throw new StoreNotConfiguredError(
      'No database is configured. Set DATABASE_URL to a Postgres connection string before running in production.',
    );
  }
  const filePath =
    customStoreFilePath ?? path.join(process.cwd(), '.data', 'db.json');
  const key =
    mode === 'postgres' ? `pg:${getDatabaseUrl()}` : `file:${filePath}`;
  if (cachedBackend?.key === key) return cachedBackend.backend;

  const backend =
    mode === 'postgres'
      ? createPostgresBackend<LocalStoreData>(getDatabaseUrl())
      : createLocalFileBackend<LocalStoreData>(filePath);
  cachedBackend = { key, backend };
  return backend;
}

function shouldSeedDemoData(
  kind: StoreBackend<LocalStoreData>['kind'],
): boolean {
  const flag = (process.env.SEED_DEMO_DATA || '').trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  // Local demo installs start with fictional leads; real databases start empty.
  return kind === 'local_file';
}

export function buildEmptyDataset(): LocalStoreData {
  return {
    leads: [],
    activities: [],
    tasks: [],
    settings: buildDefaultSettings(),
  };
}

async function loadSnapshot() {
  const backend = getBackend();
  let snap = await backend.load();
  if (!snap) {
    await backend.initialize(
      shouldSeedDemoData(backend.kind)
        ? buildSeedDataset()
        : buildEmptyDataset(),
    );
    snap = await backend.load();
    if (!snap) throw new Error('The CRM data store could not be initialised.');
  }
  return { backend, snap };
}

/** Read-only view of the current dataset. */
export async function readStore(): Promise<LocalStoreData> {
  const { snap } = await loadSnapshot();
  return snap.data;
}

/**
 * Applies `mutator` to the current dataset atomically (row lock in Postgres).
 * Returning null skips the write (e.g. record not found).
 * The mutator must be synchronous and only edit `store`.
 */
async function mutateStore<R>(
  mutator: (store: LocalStoreData) => R | null
): Promise<R | null> {
  const { backend } = await loadSnapshot(); // ensures the store is initialised
  return backend.mutate(mutator);
}

export async function resetDemoData(): Promise<LocalStoreData> {
  const seeded = buildSeedDataset();
  await mutateStore((store) => {
    store.leads = seeded.leads;
    store.activities = seeded.activities;
    store.tasks = seeded.tasks;
    store.settings = seeded.settings;
    return true;
  });
  return seeded;
}

/** Removes every synthetic demo lead (and its activities and tasks). */
export async function purgeDemoRecords(): Promise<{ removed_leads: number }> {
  const removed = await mutateStore((store) => {
    const demoIds = new Set(
      store.leads.filter((l) => l.is_demo).map((l) => l.id),
    );
    store.leads = store.leads.filter((l) => !demoIds.has(l.id));
    store.activities = store.activities.filter((a) => !demoIds.has(a.lead_id));
    store.tasks = store.tasks.filter((t) => !demoIds.has(t.lead_id));
    return demoIds.size;
  });
  return { removed_leads: removed ?? 0 };
}

// ============================================================================
// Activity Helper
// ============================================================================

function buildActivity(params: {
  lead_id: string;
  actor_type: 'user' | 'system';
  actor_label: string;
  event_type: ActivityEventType;
  summary: string;
  metadata?: Record<string, unknown>;
}): ActivityRecord {
  return {
    id: crypto.randomUUID(),
    lead_id: params.lead_id,
    created_at: new Date().toISOString(),
    actor_type: params.actor_type,
    actor_label: params.actor_label,
    event_type: params.event_type,
    summary: params.summary,
    metadata: params.metadata ?? {},
  };
}

// ============================================================================
// Repository Operations
// ============================================================================

export async function getSettings(): Promise<CRMSettings> {
  const store = await readStore();
  return store.settings;
}

export async function updateSettings(
  patch: Partial<Omit<CRMSettings, 'id' | 'updated_at'>>,
): Promise<CRMSettings> {
  const saved = await mutateStore((store) => {
    const updated: CRMSettings = {
      ...store.settings,
      ...patch,
      id: 'default',
      updated_at: new Date().toISOString(),
    };

    // Recompute deterministic priority scores on non-closed leads if score rules or offers changed
    if (patch.score_rules || patch.offers) {
      store.leads = store.leads.map((lead) => {
        const rescored = computeDeterministicScoreAndRoute(
          {
            name: lead.name,
            email: lead.email,
            organization: lead.organization,
            role_type: lead.role_type,
            team_size_range: lead.team_size_range,
            requested_service: lead.requested_service,
            challenge: lead.challenge,
            timing: lead.timing,
            ai_suggested_route: lead.suggested_route,
            ai_confidence: lead.ai_confidence,
            ai_missing_information: lead.ai_missing_information,
          },
          updated.score_rules,
          updated.offers,
        );
        return {
          ...lead,
          priority_score: rescored.priority_score,
          priority_label: rescored.priority_label,
          score_breakdown: rescored.score_breakdown,
        };
      });
    }

    store.settings = updated;
    return updated;
  });
  if (!saved) throw new Error('Settings could not be saved.');
  return saved;
}

export async function listLeads(filters: LeadListFilters = {}): Promise<{
  leads: LeadRecord[];
  total: number;
  page: number;
  page_size: number;
}> {
  const store = await readStore();
  let items = [...store.leads];

  // Search filter
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    items = items.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.organization && l.organization.toLowerCase().includes(q)) ||
        l.challenge.toLowerCase().includes(q) ||
        (l.ai_summary && l.ai_summary.toLowerCase().includes(q)),
    );
  }

  // Stage filter
  if (filters.stage && filters.stage !== 'all') {
    items = items.filter((l) => l.pipeline_stage === filters.stage);
  }

  // Route filter (matches either human selected_route or AI suggested_route)
  if (filters.route && filters.route !== 'all') {
    items = items.filter(
      (l) => (l.selected_route ?? l.suggested_route) === filters.route,
    );
  }

  // Priority filter
  if (filters.priority && filters.priority !== 'all') {
    items = items.filter((l) => l.priority_label === filters.priority);
  }

  // Source filter
  if (filters.source && filters.source !== 'all') {
    items = items.filter((l) => l.source === filters.source);
  }

  // Owner filter
  if (filters.owner && filters.owner !== 'all') {
    items = items.filter((l) => l.owner_label === filters.owner);
  }

  // Follow-up status filter
  const nowMs = Date.now();
  if (filters.follow_up_status && filters.follow_up_status !== 'all') {
    if (filters.follow_up_status === 'overdue') {
      items = items.filter(
        (l) =>
          l.follow_up_at &&
          new Date(l.follow_up_at).getTime() < nowMs &&
          !['won', 'lost', 'not_a_fit'].includes(l.pipeline_stage),
      );
    } else if (filters.follow_up_status === 'upcoming') {
      items = items.filter(
        (l) => l.follow_up_at && new Date(l.follow_up_at).getTime() >= nowMs,
      );
    } else if (filters.follow_up_status === 'none') {
      items = items.filter((l) => !l.follow_up_at);
    }
  }

  // Sorting
  const sortBy = filters.sort_by || 'created_at';
  const sortDir = filters.sort_dir || 'desc';
  const dirMultiplier = sortDir === 'asc' ? 1 : -1;

  items.sort((a, b) => {
    if (sortBy === 'priority_score') {
      const diff = a.priority_score - b.priority_score;
      if (diff !== 0) return diff * dirMultiplier;
      return (
        (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) *
        dirMultiplier
      );
    }
    if (sortBy === 'last_activity_at') {
      return (
        (new Date(a.last_activity_at).getTime() -
          new Date(b.last_activity_at).getTime()) *
        dirMultiplier
      );
    }
    if (sortBy === 'follow_up_at') {
      const aTime = a.follow_up_at
        ? new Date(a.follow_up_at).getTime()
        : Number.MAX_SAFE_INTEGER;
      const bTime = b.follow_up_at
        ? new Date(b.follow_up_at).getTime()
        : Number.MAX_SAFE_INTEGER;
      return (aTime - bTime) * dirMultiplier;
    }
    return (
      (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) *
      dirMultiplier
    );
  });

  const total = items.length;
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(100, filters.page_size || 50));
  const start = (page - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);

  return {
    leads: paged,
    total,
    page,
    page_size: pageSize,
  };
}

export async function getLeadWithDetails(id: string): Promise<{
  lead: LeadRecord;
  activities: ActivityRecord[];
  tasks: TaskRecord[];
} | null> {
  const store = await readStore();
  const lead = store.leads.find((l) => l.id === id);
  if (!lead) return null;

  const activities = store.activities
    .filter((a) => a.lead_id === id)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  const tasks = store.tasks
    .filter((t) => t.lead_id === id)
    .sort(
      (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime(),
    );

  return { lead, activities, tasks };
}

/**
 * Public Inquiry Submission Flow:
 * 1. Check duplicate submission window (same email + challenge within 10 minutes).
 * 2. Persist the lead immediately so it is never lost if OpenRouter is slow or fails.
 * 3. Run AI or mock qualification.
 * 4. Compute deterministic priority score and route verification.
 * 5. Record audit activities (including model identifier).
 */
export async function createInquiryLead(
  input: PublicInquirySubmissionInput,
  options?: {
    is_demo?: boolean;
    qualificationOptions?: Parameters<typeof qualifyInquiry>[1];
  },
): Promise<{
  lead: LeadRecord;
  duplicate_prevented: boolean;
}> {
  const created = await mutateStore((store) => {
    const nowIso = new Date().toISOString();
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedChallenge = input.challenge.trim().toLowerCase();

    // Duplicate submission prevention (within 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const existingDuplicate = store.leads.find(
      (l) =>
        l.email.toLowerCase() === normalizedEmail &&
        l.challenge.trim().toLowerCase() === normalizedChallenge &&
        new Date(l.created_at).getTime() >= tenMinutesAgo,
    );

    if (existingDuplicate) {
      return { lead: existingDuplicate, duplicate: true };
    }

    const settings = store.settings;
    const leadId = crypto.randomUUID();

    // Initial deterministic score before AI runs
    const initialScoring = computeDeterministicScoreAndRoute(
      {
        name: input.name,
        email: input.email,
        organization: input.organization || null,
        role_type: input.role_type,
        team_size_range: input.team_size_range || null,
        requested_service: input.requested_service,
        challenge: input.challenge,
        timing: input.timing,
      },
      settings.score_rules,
      settings.offers,
    );

    const initialLead: LeadRecord = {
      id: leadId,
      created_at: nowIso,
      updated_at: nowIso,
      is_demo: Boolean(options?.is_demo),
      name: input.name.trim(),
      email: input.email.trim(),
      organization: input.organization?.trim()
        ? input.organization.trim()
        : null,
      role_type: input.role_type,
      team_size_range: input.team_size_range || null,
      requested_service: input.requested_service,
      challenge: input.challenge.trim(),
      timing: input.timing,
      source: input.source || 'public_inquiry_form',
      referrer: input.referrer?.trim() ? input.referrer.trim() : null,
      consent_response: true,
      consent_response_at: nowIso,
      marketing_email_consent: Boolean(input.marketing_email_consent),
      marketing_email_consent_at: input.marketing_email_consent ? nowIso : null,
      pipeline_stage: 'new_inquiry',
      suggested_route: initialScoring.effective_suggested_route,
      selected_route: null,
      priority_score: initialScoring.priority_score,
      priority_label: initialScoring.priority_label,
      score_breakdown: initialScoring.score_breakdown,
      ai_summary: null,
      ai_evidence: [],
      ai_missing_information: [],
      ai_confidence: null,
      ai_suggested_next_action: null,
      ai_model: null,
      qualification_status: 'pending',
      qualification_updated_at: null,
      qualification_error: null,
      reviewed_by_human: false,
      reviewed_at: null,
      owner_label: settings.default_owner,
      next_action: 'Review new inquiry',
      follow_up_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      estimated_value: null,
      won_at: null,
      lost_reason: null,
      notes: '',
      last_activity_at: nowIso,
    };

    const createdActivity = buildActivity({
      lead_id: leadId,
      actor_type: 'system',
      actor_label: 'Public Inquiry Form',
      event_type: 'lead_created',
      summary: `Inquiry submitted by ${initialLead.name}${
        initialLead.organization ? ` (${initialLead.organization})` : ''
      }. Consent to respond recorded; follow-up email opt-in: ${
        initialLead.marketing_email_consent ? 'Yes' : 'No'
      }.`,
      metadata: {
        source: initialLead.source,
        marketing_email_consent: initialLead.marketing_email_consent,
        consent_response_at: initialLead.consent_response_at,
      },
    });

    // Persist immediately before calling LLM
    store.leads.unshift(initialLead);
    store.activities.unshift(createdActivity);
    return { lead: initialLead, duplicate: false };
  });

  if (!created) throw new Error('The inquiry could not be saved.');
  if (created.duplicate) {
    return { lead: created.lead, duplicate_prevented: true };
  }
  const initialLead = created.lead;
  const leadId = initialLead.id;

  void dispatchMakeWebhookEvent('lead.created', initialLead);

  // Now run qualification (OpenRouter or deterministic mock fallback)
  const qualifiedLead = await executeQualificationForLead(
    leadId,
    'System Intake Qualifier',
    options?.qualificationOptions,
  );

  return {
    lead: qualifiedLead ?? initialLead,
    duplicate_prevented: false,
  };
}

/**
 * Runs or re-runs qualification for an existing lead.
 * Updates AI fields + deterministic score & suggested_route.
 * Never automatically advances a lead into Contacted, Call Booked, Offer Sent, Won, or Lost.
 */
export async function executeQualificationForLead(
  leadId: string,
  actorLabel = 'CRM Operator',
  qualificationOptions?: Parameters<typeof qualifyInquiry>[1],
): Promise<LeadRecord | null> {
  const snapshot = await readStore();
  const leadBefore = snapshot.leads.find((l) => l.id === leadId);
  if (!leadBefore) return null;

  // The model call runs outside the write so a slow LLM never holds stale data.
  const qualResult = await qualifyInquiry(
    {
      name: leadBefore.name,
      organization: leadBefore.organization,
      role_type: leadBefore.role_type,
      team_size_range: leadBefore.team_size_range,
      requested_service: leadBefore.requested_service,
      challenge: leadBefore.challenge,
      timing: leadBefore.timing,
    },
    qualificationOptions,
  );

  const saved = await mutateStore((store) => {
    const idx = store.leads.findIndex((l) => l.id === leadId);
    if (idx === -1) return null;

    const lead = store.leads[idx];
    const settings = store.settings;

    const finalScoring = computeDeterministicScoreAndRoute(
      {
        name: lead.name,
        email: lead.email,
        organization: lead.organization,
        role_type: lead.role_type,
        team_size_range: lead.team_size_range,
        requested_service: lead.requested_service,
        challenge: lead.challenge,
        timing: lead.timing,
        ai_suggested_route: qualResult.output.suggested_route,
        ai_confidence: qualResult.output.confidence,
        ai_missing_information: qualResult.output.missing_information,
      },
      settings.score_rules,
      settings.offers,
    );

    const nowIso = new Date().toISOString();
    const combinedMissing = Array.from(
      new Set([
        ...qualResult.output.missing_information,
        ...finalScoring.forced_review_reasons,
      ]),
    ).slice(0, 8);

    const updatedLead: LeadRecord = {
      ...lead,
      updated_at: nowIso,
      last_activity_at: nowIso,
      suggested_route: finalScoring.effective_suggested_route,
      priority_score: finalScoring.priority_score,
      priority_label: finalScoring.priority_label,
      score_breakdown: finalScoring.score_breakdown,
      ai_summary: qualResult.output.summary,
      ai_evidence: qualResult.output.evidence,
      ai_missing_information: combinedMissing,
      ai_confidence: qualResult.output.confidence,
      ai_suggested_next_action: finalScoring.forced_review
        ? 'Review the inquiry'
        : qualResult.output.suggested_next_action,
      ai_model: qualResult.model,
      qualification_status: qualResult.status,
      qualification_updated_at: nowIso,
      qualification_error: qualResult.safe_error_message ?? null,
      next_action:
        lead.next_action === 'Review new inquiry' || !lead.next_action
          ? finalScoring.forced_review
            ? 'Review the inquiry'
            : qualResult.output.suggested_next_action
          : lead.next_action,
    };

    store.leads[idx] = updatedLead;

    const isFailed =
      qualResult.status === 'failed' || qualResult.status === 'pending_retry';

    const activity = buildActivity({
      lead_id: leadId,
      actor_type: actorLabel === 'System Intake Qualifier' ? 'system' : 'user',
      actor_label: actorLabel,
      event_type: isFailed ? 'qualification_failed' : 'qualification_completed',
      summary: isFailed
        ? `Qualification fallback to Needs Review (${qualResult.error_category || 'error'}: ${
            qualResult.safe_error_message
          }). Model: ${qualResult.model}.`
        : `${qualResult.is_mock ? 'Rule-based check' : 'AI check'} suggested ${
            SERVICE_ROUTE_LABELS[updatedLead.suggested_route]
          } (${Math.round((updatedLead.ai_confidence ?? 0) * 100)}% confidence, priority ${
            updatedLead.priority_score
          }/8, ${updatedLead.priority_label.toLowerCase()}).`,
      metadata: {
        model: qualResult.model,
        is_mock: qualResult.is_mock,
        status: qualResult.status,
        suggested_route: updatedLead.suggested_route,
        confidence: updatedLead.ai_confidence,
        priority_score: updatedLead.priority_score,
        error_category: qualResult.error_category ?? null,
      },
    });

    store.activities.unshift(activity);
    return { updatedLead, isFailed };
  });

  if (!saved) return null;
  if (!saved.isFailed) {
    void dispatchMakeWebhookEvent('lead.qualified', saved.updatedLead);
  }
  return saved.updatedLead;
}

/**
 * Human Stage Transition.
 * Enforces confirmation for Won, Lost, and Not a Fit, and requires lost_reason for Lost.
 */
export async function changeLeadStage(
  leadId: string,
  input: StageChangeInput,
): Promise<LeadRecord | null> {
  const saved = await mutateStore((store) => {
    const idx = store.leads.findIndex((l) => l.id === leadId);
    if (idx === -1) return null;

    const current = store.leads[idx];
    const previousStage = current.pipeline_stage;
    const targetStage = input.pipeline_stage;
    const nowIso = new Date().toISOString();

    const updated: LeadRecord = {
      ...current,
      pipeline_stage: targetStage,
      updated_at: nowIso,
      last_activity_at: nowIso,
      reviewed_by_human: true,
      reviewed_at: current.reviewed_at || nowIso,
      won_at:
        targetStage === 'won'
          ? current.won_at || nowIso
          : targetStage === 'lost' || targetStage === 'not_a_fit'
            ? null
            : current.won_at,
      lost_reason:
        targetStage === 'lost'
          ? (input.lost_reason ?? current.lost_reason)
          : null,
      estimated_value:
        input.estimated_value !== undefined
          ? input.estimated_value
          : current.estimated_value,
    };

    store.leads[idx] = updated;

    const extraDetails: string[] = [];
    if (targetStage === 'lost' && updated.lost_reason) {
      extraDetails.push(`Loss reason: ${updated.lost_reason}`);
    }
    if (
      targetStage === 'won' &&
      typeof updated.estimated_value === 'number' &&
      updated.estimated_value > 0
    ) {
      extraDetails.push(
        `Recorded deal value: $${updated.estimated_value.toLocaleString()}`,
      );
    }

    const activity = buildActivity({
      lead_id: leadId,
      actor_type: 'user',
      actor_label: input.actor_label || 'CRM Operator',
      event_type: 'stage_changed',
      summary: `Changed stage from ${PIPELINE_STAGE_LABELS[previousStage]} to ${
        PIPELINE_STAGE_LABELS[targetStage]
      }${extraDetails.length ? ` (${extraDetails.join(' · ')})` : ''}.`,
      metadata: {
        from: previousStage,
        to: targetStage,
        lost_reason: updated.lost_reason,
        estimated_value: updated.estimated_value,
        confirmed: input.confirmed,
      },
    });

    store.activities.unshift(activity);
    return updated;
  });

  if (saved) void dispatchMakeWebhookEvent('lead.stage_changed', saved);
  return saved;
}

export async function updateLeadRecord(
  leadId: string,
  patch: UpdateLeadInput,
  actorLabel = 'CRM Operator',
): Promise<LeadRecord | null> {
  const saved = await mutateStore((store) => {
    const idx = store.leads.findIndex((l) => l.id === leadId);
    if (idx === -1) return null;

    const current = store.leads[idx];
    const nowIso = new Date().toISOString();

    const merged: LeadRecord = {
      ...current,
      ...patch,
      organization:
        patch.organization !== undefined
          ? patch.organization || null
          : current.organization,
      team_size_range:
        patch.team_size_range !== undefined
          ? patch.team_size_range || null
          : current.team_size_range,
      updated_at: nowIso,
      last_activity_at: nowIso,
    };

    if (patch.reviewed_by_human && !current.reviewed_by_human) {
      merged.reviewed_by_human = true;
      merged.reviewed_at = nowIso;
    }

    if (
      patch.marketing_email_consent !== undefined &&
      patch.marketing_email_consent !== current.marketing_email_consent
    ) {
      merged.marketing_email_consent = patch.marketing_email_consent;
      merged.marketing_email_consent_at = patch.marketing_email_consent
        ? nowIso
        : null;
    }

    // Re-evaluate deterministic score if core inquiry fields changed
    const rescored = computeDeterministicScoreAndRoute(
      {
        name: merged.name,
        email: merged.email,
        organization: merged.organization,
        role_type: merged.role_type,
        team_size_range: merged.team_size_range,
        requested_service: merged.requested_service,
        challenge: merged.challenge,
        timing: merged.timing,
        ai_suggested_route: merged.suggested_route,
        ai_confidence: merged.ai_confidence,
        ai_missing_information: merged.ai_missing_information,
      },
      store.settings.score_rules,
      store.settings.offers,
    );

    merged.priority_score = rescored.priority_score;
    merged.priority_label = rescored.priority_label;
    merged.score_breakdown = rescored.score_breakdown;

    store.leads[idx] = merged;

    // Record specific activity events
    if (
      patch.selected_route !== undefined &&
      patch.selected_route !== current.selected_route
    ) {
      store.activities.unshift(
        buildActivity({
          lead_id: leadId,
          actor_type: 'user',
          actor_label: actorLabel,
          event_type: 'route_changed',
          summary: patch.selected_route
            ? `Human selected service route: ${SERVICE_ROUTE_LABELS[patch.selected_route]} (AI suggested: ${
                SERVICE_ROUTE_LABELS[current.suggested_route]
              }).`
            : 'Cleared human route override (reverted to AI suggestion).',
          metadata: {
            previous_selected_route: current.selected_route,
            new_selected_route: patch.selected_route,
            ai_suggested_route: current.suggested_route,
          },
        }),
      );
    } else if (patch.reviewed_by_human && !current.reviewed_by_human) {
      store.activities.unshift(
        buildActivity({
          lead_id: leadId,
          actor_type: 'user',
          actor_label: actorLabel,
          event_type: 'lead_reviewed',
          summary: 'Marked inquiry as reviewed by human operator.',
          metadata: { reviewed_at: nowIso },
        }),
      );
    } else if (
      patch.follow_up_at !== undefined &&
      patch.follow_up_at !== current.follow_up_at
    ) {
      store.activities.unshift(
        buildActivity({
          lead_id: leadId,
          actor_type: 'user',
          actor_label: actorLabel,
          event_type: 'followup_scheduled',
          summary: patch.follow_up_at
            ? `Scheduled follow-up for ${new Date(patch.follow_up_at).toLocaleDateString()}${
                merged.next_action ? ` (${merged.next_action})` : ''
              }.`
            : 'Cleared scheduled follow-up date.',
          metadata: {
            follow_up_at: patch.follow_up_at,
            next_action: merged.next_action,
          },
        }),
      );
    } else {
      store.activities.unshift(
        buildActivity({
          lead_id: leadId,
          actor_type: 'user',
          actor_label: actorLabel,
          event_type: 'lead_updated',
          summary: 'Updated lead details.',
          metadata: { fields: Object.keys(patch) },
        }),
      );
    }

    return merged;
  });
  return saved;
}

export async function addLeadNote(
  leadId: string,
  noteText: string,
  actorLabel = 'CRM Operator',
): Promise<{ lead: LeadRecord; activity: ActivityRecord } | null> {
  const saved = await mutateStore((store) => {
    const idx = store.leads.findIndex((l) => l.id === leadId);
    if (idx === -1) return null;

    const current = store.leads[idx];
    const nowIso = new Date().toISOString();
    const timestampPrefix = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const formattedNote = `[${timestampPrefix} · ${actorLabel}] ${noteText.trim()}`;
    const updatedNotes = current.notes
      ? `${formattedNote}\n\n${current.notes}`
      : formattedNote;

    const updatedLead: LeadRecord = {
      ...current,
      notes: updatedNotes,
      updated_at: nowIso,
      last_activity_at: nowIso,
    };

    const activity = buildActivity({
      lead_id: leadId,
      actor_type: 'user',
      actor_label: actorLabel,
      event_type: 'note_added',
      summary: `Added note: "${noteText.trim().slice(0, 140)}${
        noteText.trim().length > 140 ? '...' : ''
      }"`,
      metadata: { note_length: noteText.trim().length },
    });

    store.leads[idx] = updatedLead;
    store.activities.unshift(activity);
    return { lead: updatedLead, activity };
  });
  return saved;
}

export async function recordLeadActivity(params: {
  lead_id: string;
  actor_type: 'user' | 'system';
  actor_label: string;
  event_type: ActivityEventType;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<ActivityRecord | null> {
  const saved = await mutateStore((store) => {
    const idx = store.leads.findIndex((l) => l.id === params.lead_id);
    if (idx === -1) return null;

    const activity = buildActivity(params);
    store.leads[idx].last_activity_at = activity.created_at;
    store.leads[idx].updated_at = activity.created_at;
    store.activities.unshift(activity);
    return activity;
  });
  return saved;
}

export async function deleteLeadRecord(leadId: string): Promise<boolean> {
  const saved = await mutateStore((store) => {
    const initialCount = store.leads.length;
    store.leads = store.leads.filter((l) => l.id !== leadId);
    if (store.leads.length === initialCount) return null;

    store.activities = store.activities.filter((a) => a.lead_id !== leadId);
    store.tasks = store.tasks.filter((t) => t.lead_id !== leadId);
    return true;
  });
  return saved === true;
}

// ============================================================================
// Tasks Operations
// ============================================================================

export async function listTasksWithLeads(filter?: {
  view?: 'all' | 'overdue' | 'today' | 'upcoming' | 'completed';
  owner?: string;
}): Promise<
  Array<
    TaskRecord & {
      lead_name: string;
      lead_organization: string | null;
      lead_stage: PipelineStage;
      lead_priority: PriorityLabel;
    }
  >
> {
  const store = await readStore();
  const leadMap = new Map(store.leads.map((l) => [l.id, l]));

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const endOfToday = startOfToday + 86400000 - 1;

  let tasks = store.tasks.map((t) => {
    const lead = leadMap.get(t.lead_id);
    return {
      ...t,
      lead_name: lead?.name ?? 'Unknown Lead',
      lead_organization: lead?.organization ?? null,
      lead_stage: lead?.pipeline_stage ?? 'new_inquiry',
      lead_priority: lead?.priority_label ?? 'Low',
    };
  });

  if (filter?.owner && filter.owner !== 'all') {
    tasks = tasks.filter((t) => t.owner === filter.owner);
  }

  const view = filter?.view ?? 'all';
  if (view === 'completed') {
    tasks = tasks.filter((t) => t.status === 'completed');
  } else if (view === 'overdue') {
    tasks = tasks.filter(
      (t) =>
        t.status === 'open' && new Date(t.due_at).getTime() < now.getTime(),
    );
  } else if (view === 'today') {
    tasks = tasks.filter((t) => {
      const due = new Date(t.due_at).getTime();
      return t.status === 'open' && due >= startOfToday && due <= endOfToday;
    });
  } else if (view === 'upcoming') {
    tasks = tasks.filter(
      (t) => t.status === 'open' && new Date(t.due_at).getTime() > endOfToday,
    );
  }

  tasks.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });

  return tasks;
}

export async function createTask(
  input: CreateTaskInput,
  actorLabel = 'CRM Operator',
): Promise<TaskRecord | null> {
  const saved = await mutateStore((store) => {
    const leadIdx = store.leads.findIndex((l) => l.id === input.lead_id);
    if (leadIdx === -1) return null;

    const nowIso = new Date().toISOString();
    const task: TaskRecord = {
      id: crypto.randomUUID(),
      lead_id: input.lead_id,
      title: input.title.trim(),
      due_at: new Date(input.due_at).toISOString(),
      owner: input.owner.trim(),
      status: 'open',
      notes: input.notes?.trim() || '',
      completed_at: null,
      created_at: nowIso,
    };

    store.tasks.push(task);

    // Also update lead's follow_up_at and next_action if helpful
    store.leads[leadIdx].follow_up_at = task.due_at;
    store.leads[leadIdx].next_action = task.title;
    store.leads[leadIdx].last_activity_at = nowIso;
    store.leads[leadIdx].updated_at = nowIso;

    store.activities.unshift(
      buildActivity({
        lead_id: input.lead_id,
        actor_type: 'user',
        actor_label: actorLabel,
        event_type: 'task_created',
        summary: `Created follow-up task: "${task.title}" (due ${new Date(
          task.due_at,
        ).toLocaleDateString()}).`,
        metadata: { task_id: task.id, due_at: task.due_at, owner: task.owner },
      }),
    );

    return task;
  });
  return saved;
}

export async function toggleTaskCompletion(
  taskId: string,
  completed: boolean,
  actorLabel = 'CRM Operator',
): Promise<TaskRecord | null> {
  const saved = await mutateStore((store) => {
    const idx = store.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) return null;

    const nowIso = new Date().toISOString();
    const task = store.tasks[idx];
    const updated: TaskRecord = {
      ...task,
      status: completed ? 'completed' : 'open',
      completed_at: completed ? nowIso : null,
    };

    store.tasks[idx] = updated;

    const leadIdx = store.leads.findIndex((l) => l.id === task.lead_id);
    if (leadIdx !== -1) {
      store.leads[leadIdx].last_activity_at = nowIso;
      store.leads[leadIdx].updated_at = nowIso;
    }

    if (completed) {
      store.activities.unshift(
        buildActivity({
          lead_id: task.lead_id,
          actor_type: 'user',
          actor_label: actorLabel,
          event_type: 'task_completed',
          summary: `Completed task: "${task.title}".`,
          metadata: { task_id: task.id, completed_at: nowIso },
        }),
      );
    }

    return updated;
  });
  return saved;
}

// ============================================================================
// Dashboard Real Calculations
// ============================================================================

export async function computeDashboardMetrics(params?: {
  period_days?: number | 'all';
  source?: string;
}): Promise<DashboardMetrics> {
  const store = await readStore();
  const periodDays = params?.period_days ?? 'all';
  const sourceFilter = params?.source ?? 'all';

  const sourcesAvailable = Array.from(
    new Set(store.leads.map((l) => l.source).filter(Boolean)),
  ).sort();

  let filteredLeads = [...store.leads];

  if (sourceFilter && sourceFilter !== 'all') {
    filteredLeads = filteredLeads.filter((l) => l.source === sourceFilter);
  }

  const nowMs = Date.now();
  const cutoffMs =
    typeof periodDays === 'number' && periodDays > 0
      ? nowMs - periodDays * 86400000
      : 0;

  const periodLeads =
    cutoffMs > 0
      ? filteredLeads.filter(
          (l) => new Date(l.created_at).getTime() >= cutoffMs,
        )
      : filteredLeads;

  const newLeadsInPeriod = periodLeads.length;

  const qualifiedStages: Set<PipelineStage> = new Set([
    'qualified',
    'contacted',
    'call_booked',
    'offer_sent',
    'won',
  ]);
  const callBookedStages: Set<PipelineStage> = new Set([
    'call_booked',
    'offer_sent',
    'won',
  ]);

  const qualifiedCount = periodLeads.filter((l) =>
    qualifiedStages.has(l.pipeline_stage),
  ).length;
  const callsBookedCount = periodLeads.filter((l) =>
    callBookedStages.has(l.pipeline_stage),
  ).length;
  const wonLeads = periodLeads.filter((l) => l.pipeline_stage === 'won');
  const lostLeads = periodLeads.filter((l) => l.pipeline_stage === 'lost');

  // Won revenue ONLY when a won deal has a positive value recorded
  const wonWithRecordedValue = wonLeads.filter(
    (l) => typeof l.estimated_value === 'number' && l.estimated_value > 0,
  );
  const wonRevenue =
    wonWithRecordedValue.length > 0
      ? wonWithRecordedValue.reduce(
          (sum, l) => sum + (l.estimated_value ?? 0),
          0,
        )
      : null;

  // Conversion rates where denominator is nonzero
  const qualificationRatePct =
    newLeadsInPeriod > 0
      ? Math.round((qualifiedCount / newLeadsInPeriod) * 100)
      : null;

  const callBookingRatePct =
    qualifiedCount > 0
      ? Math.round((callsBookedCount / qualifiedCount) * 100)
      : null;

  const closedDenominator = wonLeads.length + lostLeads.length;
  const winRatePct =
    closedDenominator > 0
      ? Math.round((wonLeads.length / closedDenominator) * 100)
      : null;

  // Pipeline totals by stage
  const pipelineByStage = PIPELINE_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = periodLeads.filter((l) => l.pipeline_stage === stage).length;
      return acc;
    },
    {} as Record<PipelineStage, number>,
  );

  // Routes breakdown (human selected route if set, otherwise AI suggested route)
  const routesBreakdown = SERVICE_ROUTES.reduce(
    (acc, route) => {
      acc[route] = periodLeads.filter(
        (l) => (l.selected_route ?? l.suggested_route) === route,
      ).length;
      return acc;
    },
    {} as Record<ServiceRoute, number>,
  );

  // Leads requiring attention:
  // - in needs_review stage
  // - qualification failed or pending_retry
  // - overdue follow_up_at on active stage
  // - unreviewed new_inquiry
  const attentionLeads = filteredLeads
    .filter((l) => {
      if (['won', 'lost', 'not_a_fit'].includes(l.pipeline_stage)) return false;
      const isOverdueFollowup =
        Boolean(l.follow_up_at) && new Date(l.follow_up_at!).getTime() < nowMs;
      return (
        l.pipeline_stage === 'needs_review' ||
        l.suggested_route === 'review' ||
        l.qualification_status === 'failed' ||
        l.qualification_status === 'pending_retry' ||
        isOverdueFollowup ||
        !l.reviewed_by_human
      );
    })
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 8);

  const overdueTasksCount = store.tasks.filter(
    (t) => t.status === 'open' && new Date(t.due_at).getTime() < nowMs,
  ).length;

  const recentActivities = [...store.activities]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 12);

  const isDemoDataset = filteredLeads.some((l) => l.is_demo);

  return {
    period_days: periodDays,
    source_filter: sourceFilter,
    is_demo_dataset: isDemoDataset,
    total_leads_count: store.leads.length,
    new_leads_in_period: newLeadsInPeriod,
    qualified_leads_count: qualifiedCount,
    calls_booked_count: callsBookedCount,
    won_deals_count: wonLeads.length,
    lost_deals_count: lostLeads.length,
    won_revenue: wonRevenue,
    won_deals_with_value_count: wonWithRecordedValue.length,
    qualification_rate_pct: qualificationRatePct,
    call_booking_rate_pct: callBookingRatePct,
    win_rate_pct: winRatePct,
    attention_required_leads: attentionLeads,
    overdue_tasks_count: overdueTasksCount,
    pipeline_by_stage: pipelineByStage,
    routes_breakdown: routesBreakdown,
    recent_activities: recentActivities,
    sources_available: sourcesAvailable,
  };
}
