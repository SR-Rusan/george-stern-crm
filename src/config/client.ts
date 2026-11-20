import activeClient from './active-client';
import {
  ClientConfig,
  ClientConfigSchema,
  ClientEmailTemplate,
  SERVICE_SLOTS,
  ServiceSlot,
} from './schema';

export interface ResolvedClientConfig extends ClientConfig {
  emailTemplates: ClientEmailTemplate[];
  brandTokens: {
    accent: string;
    hover: string;
    /** "r g b" channels for Tailwind's rgb(var(--brand-rgb) / <alpha>) colours */
    accentRgb: string;
    hoverRgb: string;
  };
  enabledServices: ServiceSlot[];
}

function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function darken(hex: string, amount = 0.18): string {
  const [r, g, b] = hexToRgb(hex).map((c) => Math.round(c * (1 - amount)));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function brandTokensFor(accent: string) {
  const hover = darken(accent);
  return {
    accent,
    hover,
    accentRgb: hexToRgb(accent).join(' '),
    hoverRgb: hexToRgb(hover).join(' '),
  };
}

function genericEmailTemplates(config: ClientConfig): ClientEmailTemplate[] {
  const signOff = `Best regards,\n{{owner_label}}\n{{business_name}}`;
  const perService = SERVICE_SLOTS.filter((slot) => config.services[slot].enabled).map(
    (slot): ClientEmailTemplate => ({
      id: `tpl_${slot}`,
      name: `${config.services[slot].label} — Follow-Up`,
      route: slot,
      subject: `Following up on your ${config.services[slot].label} inquiry — {{business_name}}`,
      body: `Hi {{lead_name}},\n\nThank you for reaching out to {{business_name}} about ${config.services[
        slot
      ].label.toLowerCase()}.\n\nIf you would like to talk through whether it's the right fit, you can pick a time for an introductory call here:\n{{booking_url}}\n\nIf you'd rather share more context by email first, just reply to this note.\n\n${signOff}`,
    })
  );
  return [
    ...perService,
    {
      id: 'tpl_clarifying_question',
      name: 'Needs Review — Clarifying Question',
      route: 'review',
      subject: 'Quick question about your inquiry — {{business_name}}',
      body: `Hi {{lead_name}},\n\nThank you for reaching out to {{business_name}}. We want to make sure we point you to the most relevant option.\n\nCould you share a little more about what you're looking for and your preferred timeline?\n\n${signOff}`,
    },
  ];
}

export function resolveClientConfig(raw: unknown): ResolvedClientConfig {
  const result = ClientConfigSchema.safeParse(raw);
  if (!result.success) {
    const id = (raw as { id?: string })?.id ?? 'unknown';
    const problems = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Client config "${id}" is invalid:\n${problems}`);
  }
  const config = result.data;
  return {
    ...config,
    emailTemplates: config.emailTemplates ?? genericEmailTemplates(config),
    brandTokens: brandTokensFor(config.brand.accent),
    enabledServices: SERVICE_SLOTS.filter((slot) => config.services[slot].enabled),
  };
}

/** The active client for this build. Switch with `npm run use-client -- <id>`. */
export const client: ResolvedClientConfig = resolveClientConfig(activeClient);
