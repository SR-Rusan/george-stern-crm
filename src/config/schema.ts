import { z } from 'zod';

/**
 * Client profile schema — everything that changes from one client to the next.
 * One file per client lives in /clients; `npm run use-client -- <id>` selects it.
 *
 * This file must only import zod (lib/schemas.ts imports from here).
 */

/** Fixed internal service slots. Labels/descriptions are per client; IDs never change. */
export const SERVICE_SLOTS = [
  'one_to_one_coaching',
  'group_program',
  'corporate_training',
  'speaking',
] as const;
export type ServiceSlot = (typeof SERVICE_SLOTS)[number];

export const ROLE_KEYS = ['manager', 'founder_executive', 'hr_ld', 'other'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

const HEX = /^#[0-9A-Fa-f]{6}$/;

function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Contrast of white text on the accent colour (WCAG). */
export function contrastWithWhite(hex: string): number {
  return 1.05 / (relativeLuminance(hex) + 0.05);
}

const ServiceSchema = z.object({
  /** Show this service on the form and let the AI route to it. */
  enabled: z.boolean(),
  /** Short name used in the CRM, badges and emails, e.g. "1:1 Coaching". */
  label: z.string().trim().min(2).max(40),
  /** Option text on the public form, e.g. "Private 1:1 coaching". */
  formLabel: z.string().trim().min(2).max(60),
  /** What the service is — also given to the AI qualifier. */
  description: z.string().trim().min(5).max(360),
  /** Who it's for — also given to the AI qualifier. */
  audience: z.string().trim().min(2).max(200),
});

/** Placeholders the email composer knows how to fill. */
export const EMAIL_TOKENS = [
  'lead_name',
  'organization',
  'business_name',
  'owner_label',
  'booking_url',
  'route_label',
] as const;

function unknownTokens(text: string): string[] {
  return [...text.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)]
    .map((m) => m[1])
    .filter((t) => !(EMAIL_TOKENS as readonly string[]).includes(t));
}

const EmailTemplateSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/, 'Template id: lowercase letters, numbers, underscores.'),
    name: z.string().trim().min(2).max(100),
    route: z.enum([...SERVICE_SLOTS, 'review', 'general']),
    subject: z.string().trim().min(3).max(200),
    body: z.string().trim().min(10).max(3000),
  })
  .superRefine((tpl, ctx) => {
    const bad = [...unknownTokens(tpl.subject), ...unknownTokens(tpl.body)];
    if (bad.length) {
      ctx.addIssue({
        code: 'custom',
        message: `Unknown placeholder(s) {{${bad.join('}}, {{')}}}. Allowed: ${EMAIL_TOKENS.map((t) => `{{${t}}}`).join(' ')}`,
      });
    }
  });

export const ClientConfigSchema = z.object({
  /** Folder-safe id, matches the file name in /clients. */
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'id: lowercase letters, numbers and dashes.'),

  business: z.object({
    name: z.string().trim().min(2).max(100),
    tagline: z.string().trim().min(2).max(160),
    /** 1–4 sentences for the AI: what the business does and who it serves. */
    description: z.string().trim().min(20).max(800),
    website: z.string().url().optional(),
    /** Default lead owner and email signature, e.g. "Coaching Practice Lead" or a person's name. */
    ownerLabel: z.string().trim().min(2).max(100),
  }),

  brand: z.object({
    /** Main colour (buttons, links). Must be dark enough for white text. */
    accent: z
      .string()
      .regex(HEX, 'accent must be a 6-digit hex colour like #1B4332.')
      .refine((hex) => contrastWithWhite(hex) >= 4.5, {
        message: 'accent is too light: white button text would be unreadable (need contrast ≥ 4.5). Pick a darker shade.',
      }),
  }),

  links: z.object({
    /** Calendly/Cal.com link inserted into emails as {{booking_url}}. */
    bookingUrl: z.string().url(),
    /** The client's own privacy policy, linked under the inquiry form. */
    privacyPolicyUrl: z.string().url().optional(),
  }),

  services: z
    .object({
      one_to_one_coaching: ServiceSchema,
      group_program: ServiceSchema,
      corporate_training: ServiceSchema,
      speaking: ServiceSchema,
    })
    .refine((s) => Object.values(s).some((svc) => svc.enabled), {
      message: 'At least one service must be enabled.',
    }),

  /** Labels for the "Your role" dropdown. */
  roles: z.object({
    manager: z.string().trim().min(2).max(40),
    founder_executive: z.string().trim().min(2).max(40),
    hr_ld: z.string().trim().min(2).max(40),
    other: z.string().trim().min(2).max(40).default('Other'),
  }),

  form: z.object({
    title: z.string().trim().min(3).max(90),
    intro: z.string().trim().min(10).max(400),
    organizationLabel: z.string().trim().min(2).max(40).default('Organization'),
    organizationPlaceholder: z.string().trim().max(80).default('Company or institution'),
    teamSizeLabel: z.string().trim().min(2).max(40).default('Team size'),
    /** Unit shown after team-size options, e.g. "team members" or "employees". */
    teamSizeUnit: z.string().trim().min(2).max(30).default('team members'),
    serviceQuestion: z.string().trim().min(3).max(80).default('What help are you looking for?'),
    challengeLabel: z.string().trim().min(3).max(80),
    challengePlaceholder: z.string().trim().min(10).max(300),
    referralPlaceholder: z
      .string()
      .trim()
      .max(120)
      .default('e.g., Referral, LinkedIn, newsletter, event'),
    confirmationMessage: z
      .string()
      .trim()
      .min(10)
      .max(300)
      .default('Your inquiry has been received. A member of our team will review your note and respond shortly.'),
  }),

  /** Words used inside the CRM. */
  terms: z.object({
    /** Sentence-case noun for what the lead wrote, e.g. "Leadership challenge" or "Project goal". */
    challenge: z.string().trim().min(3).max(40),
    pipelineTitle: z.string().trim().min(3).max(80).default('Pipeline'),
    notesTitle: z.string().trim().min(3).max(80).default('Internal notes'),
  }),

  /** Optional. Omit to use generic templates built from the service labels. */
  emailTemplates: z.array(EmailTemplateSchema).min(1).optional(),

  /** Optional overrides for the priority score weights. */
  scoring: z
    .object({
      timing_now_points: z.number().int().min(0).max(5),
      timing_within_3_months_points: z.number().int().min(0).max(5),
      service_match_points: z.number().int().min(0).max(5),
      specific_challenge_points: z.number().int().min(0).max(5),
      corporate_org_or_team_points: z.number().int().min(0).max(5),
      min_confidence_threshold: z.number().min(0.1).max(0.95),
    })
    .partial()
    .optional(),
});

/** What you write in a /clients file (defaults may be omitted). */
export type ClientConfigInput = z.input<typeof ClientConfigSchema>;
/** Parsed config with defaults applied. */
export type ClientConfig = z.output<typeof ClientConfigSchema>;
export type ClientEmailTemplate = z.output<typeof EmailTemplateSchema>;

/** Typed helper for /clients files. */
export function defineClient(config: ClientConfigInput): ClientConfigInput {
  return config;
}
