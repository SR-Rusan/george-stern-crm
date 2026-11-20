import { z } from 'zod';
import { client } from '@/config/client';
import { ROLE_KEYS, SERVICE_SLOTS } from '@/config/schema';

// ============================================================================
// 1. Domain Enums & Display Labels
// ============================================================================

// Internal ids are fixed; every label below comes from the active client file (/clients).
export const SERVICE_ROUTES = [...SERVICE_SLOTS, 'review'] as const;

export type ServiceRoute = (typeof SERVICE_ROUTES)[number];

export const SERVICE_ROUTE_LABELS: Record<ServiceRoute, string> = {
  one_to_one_coaching: client.services.one_to_one_coaching.label,
  group_program: client.services.group_program.label,
  corporate_training: client.services.corporate_training.label,
  speaking: client.services.speaking.label,
  review: 'Needs review',
};

export const REQUESTED_SERVICES = [...SERVICE_SLOTS, 'not_sure'] as const;

export type RequestedService = (typeof REQUESTED_SERVICES)[number];

export const REQUESTED_SERVICE_LABELS: Record<RequestedService, string> = {
  one_to_one_coaching: client.services.one_to_one_coaching.formLabel,
  group_program: client.services.group_program.formLabel,
  corporate_training: client.services.corporate_training.formLabel,
  speaking: client.services.speaking.formLabel,
  not_sure: 'Not sure yet',
};

/** Options shown on the public form: the client's enabled services + "Not sure yet". */
export const FORM_REQUESTED_SERVICES: RequestedService[] = [
  ...client.enabledServices,
  'not_sure',
];

export const PIPELINE_STAGES = [
  'new_inquiry',
  'needs_review',
  'qualified',
  'contacted',
  'call_booked',
  'offer_sent',
  'won',
  'lost',
  'not_a_fit',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  new_inquiry: 'New inquiry',
  needs_review: 'Needs review',
  qualified: 'Qualified',
  contacted: 'Contacted',
  call_booked: 'Call booked',
  offer_sent: 'Proposal sent',
  won: 'Won',
  lost: 'Lost',
  not_a_fit: 'Not a fit',
};

export const ROLE_TYPES = ROLE_KEYS;

export type RoleType = (typeof ROLE_TYPES)[number];

export const ROLE_TYPE_LABELS: Record<RoleType, string> = { ...client.roles };

export const TEAM_SIZE_RANGES = [
  '1-5',
  '6-15',
  '16-50',
  '51-200',
  '200+',
] as const;

export type TeamSizeRange = (typeof TEAM_SIZE_RANGES)[number];

export const TIMING_OPTIONS = [
  'now',
  'within_3_months',
  'later',
  'exploring',
] as const;

export type TimingOption = (typeof TIMING_OPTIONS)[number];

export const TIMING_LABELS: Record<TimingOption, string> = {
  now: 'Now',
  within_3_months: 'Within 3 months',
  later: 'Later',
  exploring: 'Exploring',
};

export const ALLOWED_NEXT_ACTIONS = [
  'Review the inquiry',
  'Offer a discovery call',
  'Send program information',
  'Ask one clarifying question',
  'Route to corporate inquiry review',
  'Route to speaking inquiry review',
] as const;

export type AllowedNextAction = (typeof ALLOWED_NEXT_ACTIONS)[number];

export const LOSS_REASONS = [
  'No response',
  'Timing',
  'Budget',
  'Not the right service',
  'Chose another provider',
  'Other',
] as const;

export type LossReason = (typeof LOSS_REASONS)[number];

export const PRIORITY_LABELS = ['Low', 'Medium', 'High'] as const;
export type PriorityLabel = (typeof PRIORITY_LABELS)[number];

export const QUALIFICATION_STATUSES = [
  'pending',
  'completed',
  'mock_completed',
  'failed',
  'pending_retry',
] as const;

export type QualificationStatus = (typeof QUALIFICATION_STATUSES)[number];

export const ACTIVITY_EVENT_TYPES = [
  'lead_created',
  'qualification_completed',
  'qualification_failed',
  'lead_reviewed',
  'route_changed',
  'stage_changed',
  'note_added',
  'followup_scheduled',
  'task_created',
  'task_completed',
  'email_drafted',
  'email_sent',
  'lead_updated',
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

// ============================================================================
// 2. Validation Schemas (Zod)
// ============================================================================

export const ScoreRuleItemSchema = z.object({
  rule_id: z.string(),
  label: z.string(),
  points: z.number(),
  awarded: z.boolean(),
  reason: z.string(),
});

export type ScoreBreakdownItem = z.infer<typeof ScoreRuleItemSchema>;

export const AIEvidenceItemSchema = z.object({
  field: z.string().min(1).max(60),
  value: z.string().min(1).max(280),
});

export type AIEvidenceItem = z.infer<typeof AIEvidenceItemSchema>;

/**
 * Strict schema for validating OpenRouter structured JSON output.
 * Any non-conforming response is safely caught and routed to 'review'.
 */
export const AIQualificationOutputSchema = z.object({
  suggested_route: z.enum(SERVICE_ROUTES),
  summary: z.string().min(10).max(550),
  evidence: z.array(AIEvidenceItemSchema).min(1).max(8),
  missing_information: z.array(z.string().min(2).max(200)).max(8),
  confidence: z.number().min(0).max(1),
  suggested_next_action: z.enum(ALLOWED_NEXT_ACTIONS),
});

export type AIQualificationOutput = z.infer<typeof AIQualificationOutputSchema>;

/**
 * Public Inquiry Form Validation Schema
 */
export const PublicInquirySubmissionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter your full name (at least 2 characters).')
    .max(120, 'Name must be 120 characters or fewer.'),
  email: z
    .string()
    .trim()
    .email('Please enter a valid work email address.')
    .max(254, 'Email must be 254 characters or fewer.'),
  organization: z
    .string()
    .trim()
    .max(140, 'Organization name must be 140 characters or fewer.')
    .optional()
    .or(z.literal('')),
  role_type: z.enum(ROLE_TYPES, {
    error: 'Please select your current role.',
  }),
  team_size_range: z
    .union([z.enum(TEAM_SIZE_RANGES), z.literal('')])
    .optional(),
  requested_service: z.enum(REQUESTED_SERVICES, {
    error: 'Please select the type of support you are looking for.',
  }),
  challenge: z
    .string()
    .trim()
    .min(15, `Please share a brief description of your ${client.terms.challenge.toLowerCase()} (at least 15 characters).`)
    .max(1000, 'Please keep your description under 1,000 characters.'),
  timing: z.enum(TIMING_OPTIONS, {
    error: 'Please select your desired timing.',
  }),
  source: z.string().trim().max(80).optional().default('public_inquiry_form'),
  referrer: z.string().trim().max(160).optional().or(z.literal('')),
  consent_response: z.literal(true, {
    error: 'You must acknowledge that submitting this form requests a response to your inquiry.',
  }),
  marketing_email_consent: z.boolean().optional().default(false),
  // Honeypot field — must remain empty for legitimate human submissions
  website_url_hp: z.string().max(200).optional().default(''),
});

export type PublicInquirySubmissionInput = z.infer<typeof PublicInquirySubmissionSchema>;

/**
 * Internal CRM Lead Creation / Update Schemas
 */
export const UpdateLeadSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(254).optional(),
  organization: z.string().trim().max(140).nullable().optional(),
  role_type: z.enum(ROLE_TYPES).optional(),
  team_size_range: z.union([z.enum(TEAM_SIZE_RANGES), z.literal(''), z.null()]).optional(),
  requested_service: z.enum(REQUESTED_SERVICES).optional(),
  challenge: z.string().trim().min(10).max(1000).optional(),
  timing: z.enum(TIMING_OPTIONS).optional(),
  selected_route: z.enum(SERVICE_ROUTES).nullable().optional(),
  owner_label: z.string().trim().min(2).max(100).optional(),
  next_action: z.string().trim().max(240).nullable().optional(),
  follow_up_at: z.string().nullable().optional(),
  estimated_value: z.number().min(0).max(10000000).nullable().optional(),
  notes: z.string().max(5000).optional(),
  reviewed_by_human: z.boolean().optional(),
  marketing_email_consent: z.boolean().optional(),
});

export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;

export const StageChangeSchema = z
  .object({
    pipeline_stage: z.enum(PIPELINE_STAGES),
    lost_reason: z.enum(LOSS_REASONS).optional().nullable(),
    estimated_value: z.number().min(0).max(10000000).optional().nullable(),
    confirmed: z.boolean().optional().default(false),
    actor_label: z.string().trim().min(1).max(100).optional().default('CRM Operator'),
  })
  .superRefine((val, ctx) => {
    if (
      (val.pipeline_stage === 'won' ||
        val.pipeline_stage === 'lost' ||
        val.pipeline_stage === 'not_a_fit') &&
      !val.confirmed
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmed'],
        message: `Transitioning to ${PIPELINE_STAGE_LABELS[val.pipeline_stage]} requires explicit human confirmation.`,
      });
    }
    if (val.pipeline_stage === 'lost' && !val.lost_reason) {
      ctx.addIssue({
        code: 'custom',
        path: ['lost_reason'],
        message: 'Please select a loss reason when marking a lead as Lost.',
      });
    }
  });

export type StageChangeInput = z.infer<typeof StageChangeSchema>;

export const AddNoteSchema = z.object({
  note: z.string().trim().min(2, 'Note cannot be empty.').max(2000),
  actor_label: z.string().trim().min(1).max(100).optional().default('CRM Operator'),
});

export const CreateTaskSchema = z.object({
  lead_id: z.string().min(1),
  title: z.string().trim().min(2, 'Task title is required.').max(200),
  due_at: z.string().min(1, 'Due date and time are required.'),
  owner: z.string().trim().min(2).max(100).default(client.business.ownerLabel),
  notes: z.string().trim().max(1000).optional().default(''),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const CompleteTaskSchema = z.object({
  completed: z.boolean(),
  actor_label: z.string().trim().min(1).max(100).optional().default('CRM Operator'),
});

export const EmailDraftRequestSchema = z.object({
  template_id: z.string().optional(),
  custom_subject: z.string().trim().max(200).optional(),
  custom_body: z.string().trim().max(4000).optional(),
});

export const EmailSendRequestSchema = z.object({
  subject: z.string().trim().min(3, 'Subject is required.').max(200),
  body: z.string().trim().min(10, 'Message body is required.').max(4000),
  human_confirmed: z.literal(true, {
    error: 'Explicit human confirmation is required before sending an email.',
  }),
  actor_label: z.string().trim().min(1).max(100).optional().default('CRM Operator'),
});

// ============================================================================
// 3. Settings & Configuration Schemas
// ============================================================================

export const OfferDefinitionSchema = z.object({
  route: z.enum(SERVICE_ROUTES),
  label: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(360),
  typical_audience: z.string().trim().max(200),
  active: z.boolean().default(true),
});

export type OfferDefinition = z.infer<typeof OfferDefinitionSchema>;

export const ScoreRulesConfigSchema = z.object({
  timing_now_points: z.number().int().min(0).max(5).default(2),
  timing_within_3_months_points: z.number().int().min(0).max(5).default(1),
  service_match_points: z.number().int().min(0).max(5).default(2),
  specific_challenge_points: z.number().int().min(0).max(5).default(1),
  corporate_org_or_team_points: z.number().int().min(0).max(5).default(2),
  min_confidence_threshold: z.number().min(0.1).max(0.95).default(0.65),
});

export type ScoreRulesConfig = z.infer<typeof ScoreRulesConfigSchema>;

export const EmailTemplateSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(2).max(100),
  route: z.union([z.enum(SERVICE_ROUTES), z.literal('general')]),
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(3000),
});

export type EmailTemplate = z.infer<typeof EmailTemplateSchema>;

export const CRMSettingsSchema = z.object({
  id: z.string().default('default'),
  updated_at: z.string(),
  business_name: z.string().trim().min(2).max(100),
  brand_accent: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Brand accent must be a valid 6-digit hex color.'),
  brand_tagline: z.string().trim().min(2).max(160),
  default_owner: z.string().trim().min(2).max(100),
  booking_url_placeholder: z.string().trim().url('Booking placeholder must be a valid URL.'),
  data_retention_days: z.number().int().min(30).max(3650),
  offers: z.array(OfferDefinitionSchema),
  score_rules: ScoreRulesConfigSchema,
  email_templates: z.array(EmailTemplateSchema),
  webhook_events: z.array(z.enum(['lead.created', 'lead.qualified', 'lead.stage_changed'])),
});

export type CRMSettings = z.infer<typeof CRMSettingsSchema>;

// ============================================================================
// 4. Full Entity Types
// ============================================================================

export interface LeadRecord {
  id: string;
  created_at: string;
  updated_at: string;
  is_demo: boolean;

  name: string;
  email: string;
  organization: string | null;
  role_type: RoleType;
  team_size_range: TeamSizeRange | '' | null;
  requested_service: RequestedService;
  challenge: string;
  timing: TimingOption;
  source: string;
  referrer: string | null;

  consent_response: boolean;
  consent_response_at: string;
  marketing_email_consent: boolean;
  marketing_email_consent_at: string | null;

  pipeline_stage: PipelineStage;
  suggested_route: ServiceRoute;
  selected_route: ServiceRoute | null;

  priority_score: number;
  priority_label: PriorityLabel;
  score_breakdown: ScoreBreakdownItem[];

  ai_summary: string | null;
  ai_evidence: AIEvidenceItem[];
  ai_missing_information: string[];
  ai_confidence: number | null;
  ai_suggested_next_action: AllowedNextAction | null;
  ai_model: string | null;
  qualification_status: QualificationStatus;
  qualification_updated_at: string | null;
  qualification_error: string | null;
  reviewed_by_human: boolean;
  reviewed_at: string | null;

  owner_label: string;
  next_action: string | null;
  follow_up_at: string | null;
  estimated_value: number | null;
  won_at: string | null;
  lost_reason: LossReason | null;
  notes: string;
  last_activity_at: string;
}

export interface ActivityRecord {
  id: string;
  lead_id: string;
  created_at: string;
  actor_type: 'user' | 'system';
  actor_label: string;
  event_type: ActivityEventType;
  summary: string;
  metadata: Record<string, unknown>;
}

export interface TaskRecord {
  id: string;
  lead_id: string;
  title: string;
  due_at: string;
  owner: string;
  status: 'open' | 'completed';
  notes: string;
  completed_at: string | null;
  created_at: string;
}

export interface IntegrationRuntimeStatus {
  storage_mode: 'postgres' | 'local_file' | 'not_configured';
  database_configured: boolean;
  auth_mode: 'enforced' | 'open_dev' | 'misconfigured';
  demo_tools_enabled: boolean;
  openrouter_configured: boolean;
  openrouter_model: string;
  openrouter_mode: 'live_openrouter' | 'mock_fallback';
  email_provider: string;
  email_configured: boolean;
  email_mode: 'authorized_provider' | 'draft_only_disabled';
  make_webhook_enabled: boolean;
  make_webhook_configured: boolean;
  make_secret_configured: boolean;
}
