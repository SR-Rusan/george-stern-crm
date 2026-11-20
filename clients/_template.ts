import { defineClient } from '../src/config/schema';

/**
 * NEW CLIENT TEMPLATE
 * 1. Copy to clients/<client-id>.ts (lowercase, dashes), e.g. clients/maya-patel-coaching.ts
 * 2. Replace every REPLACE value. Delete optional fields you don't need.
 * 3. npm run use-client -- <client-id>      (validates + activates)
 * 4. npm test && npm run build
 *
 * The fields below are listed in CLIENT_INTAKE.md in plain language for the client.
 */
export default defineClient({
  id: 'REPLACE-client-id', // must match the file name

  business: {
    name: 'REPLACE Business Name',
    tagline: 'REPLACE one-line description shown under the business name',
    // 1–4 sentences for the AI qualifier: what they do, who they serve, what a good lead looks like.
    description:
      'REPLACE Business Name is a ... It helps ... through ... Its best clients are ...',
    // website: 'https://clientsite.com', // optional
    ownerLabel: 'REPLACE person or role who owns new leads and signs emails',
  },

  brand: {
    // Dark enough for white text on buttons; validation rejects colours that are too light.
    accent: '#1B4332',
  },

  links: {
    bookingUrl: 'https://example.com/REPLACE-booking-link',
    // privacyPolicyUrl: 'https://clientsite.com/privacy', // optional but recommended
  },

  // Four service slots. Rename them to the client's offers; disable the ones they don't sell.
  // Slot ids are internal only — the client never sees them.
  //   one_to_one_coaching → their main 1:1 / individual offer
  //   group_program       → cohort, course, group or membership offer
  //   corporate_training  → B2B / team / company offer (scored higher when org or team size is given)
  //   speaking            → events, talks, workshops
  services: {
    one_to_one_coaching: {
      enabled: true,
      label: 'REPLACE short name',
      formLabel: 'REPLACE option text on the form',
      description: 'REPLACE what this service is',
      audience: 'REPLACE who it is for',
    },
    group_program: {
      enabled: false,
      label: 'Group program',
      formLabel: 'Group program',
      description: 'Structured group program',
      audience: 'Individuals who prefer a cohort format',
    },
    corporate_training: {
      enabled: false,
      label: 'Team training',
      formLabel: 'Training for my team / company',
      description: 'Training delivered to a team or organisation',
      audience: 'HR and team leaders',
    },
    speaking: {
      enabled: false,
      label: 'Speaking',
      formLabel: 'Speaking / event',
      description: 'Keynote or event speaking inquiry',
      audience: 'Event organisers',
    },
  },

  // "Your role" dropdown on the form.
  roles: {
    manager: 'Manager',
    founder_executive: 'Founder / Executive',
    hr_ld: 'HR / L&D',
    other: 'Other',
  },

  form: {
    title: 'REPLACE form heading, e.g. "Work with us"',
    intro: 'REPLACE 1–2 sentences under the heading telling visitors what to share.',
    challengeLabel: 'REPLACE main question, e.g. "What would you like help with?"',
    challengePlaceholder: 'REPLACE example answer shown faintly in the box...',
    // Optional — defaults shown:
    // organizationLabel: 'Organization',
    // organizationPlaceholder: 'Company or institution',
    // teamSizeLabel: 'Team size',
    // teamSizeUnit: 'team members',
    // serviceQuestion: 'What help are you looking for?',
    // referralPlaceholder: 'e.g., Referral, LinkedIn, newsletter, event',
    // confirmationMessage: 'Your inquiry has been received. A member of our team will review your note and respond shortly.',
  },

  terms: {
    challenge: 'REPLACE sentence-case noun, e.g. "Main goal"',
    // pipelineTitle: 'Pipeline',
    // notesTitle: 'Internal notes',
  },

  // Optional: omit to auto-generate one follow-up template per enabled service.
  // Tokens: {{lead_name}} {{organization}} {{business_name}} {{owner_label}} {{booking_url}} {{route_label}}
  // emailTemplates: [
  //   { id: 'tpl_main', name: 'Main — discovery call', route: 'one_to_one_coaching',
  //     subject: 'Following up — {{business_name}}', body: 'Hi {{lead_name}}, ...' },
  // ],

  // Optional score weight overrides (defaults: now 2, within 3 months 1, service match 2,
  // specific challenge 1, company/team request 2, AI confidence threshold 0.65).
  // scoring: { timing_now_points: 3 },
});
