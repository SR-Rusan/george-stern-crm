import { defineClient } from '../src/config/schema';

/**
 * Client: George Stern Leadership
 * Leadership coaching & organisational training practice.
 */
export default defineClient({
  id: 'george-stern',

  business: {
    name: 'George Stern Leadership',
    tagline: 'Leadership Coaching, Manager Development & Organizational Training',
    description:
      'George Stern Leadership is a leadership coaching and training practice. It offers 1:1 coaching for managers and executives, structured group programs for new and mid-level managers, leadership training for corporate teams, and keynote speaking.',
    ownerLabel: 'Coaching Practice Lead',
  },

  brand: {
    accent: '#1B4332',
  },

  links: {
    // TODO: replace with George's real scheduling link before go-live
    bookingUrl: 'https://cal.example.com/leadership-discovery-placeholder',
  },

  services: {
    one_to_one_coaching: {
      enabled: true,
      label: '1:1 coaching',
      formLabel: '1:1 coaching',
      description: 'Individualized leadership support for managers and executives',
      audience: 'Senior managers, directors, founders, and executives',
    },
    group_program: {
      enabled: true,
      label: 'Group program',
      formLabel: 'Group program',
      description: 'Structured development program for managers',
      audience: 'New and mid-level people managers building core habits',
    },
    corporate_training: {
      enabled: true,
      label: 'Corporate training',
      formLabel: 'Team or company training',
      description: 'Leadership development for teams or organizations',
      audience: 'HR/L&D leaders and department heads training intact cohorts',
    },
    speaking: {
      enabled: true,
      label: 'Speaking',
      formLabel: 'Speaking or keynote',
      description: 'Keynote or event speaking inquiry',
      audience: 'Conference organizers, executive offsites, and leadership summits',
    },
  },

  roles: {
    manager: 'Manager',
    founder_executive: 'Founder / Executive',
    hr_ld: 'HR / L&D',
    other: 'Other',
  },

  form: {
    title: 'Work with George Stern Leadership',
    intro:
      'Coaching, manager development and team training. Share a few details about your role, goals and timeline, and we will review your request and follow up with next steps.',
    challengeLabel: 'Main leadership challenge or goal',
    challengePlaceholder:
      'Share context on what you or your team are navigating (e.g., stepping into a broader leadership scope, developing first-time managers, or planning an upcoming leadership event)...',
    referralPlaceholder: 'e.g., Colleague referral, LinkedIn, newsletter, event',
    confirmationMessage:
      'Your inquiry has been received. A member of our leadership team will review your note and respond shortly.',
  },

  terms: {
    challenge: 'Leadership challenge',
    pipelineTitle: 'Pipeline',
    notesTitle: 'Internal notes',
  },

  emailTemplates: [
    {
      id: 'tpl_1on1_discovery',
      name: '1:1 coaching — discovery call',
      route: 'one_to_one_coaching',
      subject: 'Following up on your 1:1 leadership coaching inquiry — {{business_name}}',
      body: `Hi {{lead_name}},

Thank you for reaching out to {{business_name}} and sharing context about your role and current focus areas.

I reviewed your inquiry regarding 1:1 coaching. If you would like to explore whether our approach matches what you are looking for, you can view options for an introductory conversation here:
{{booking_url}}

If you prefer to share any additional context by email first, feel free to reply directly to this note.

Best regards,
{{owner_label}}
{{business_name}}`,
    },
    {
      id: 'tpl_group_program_info',
      name: 'Group program — overview and next cohort',
      route: 'group_program',
      subject: 'Manager group program details — {{business_name}}',
      body: `Hi {{lead_name}},

Thank you for contacting {{business_name}} about our structured group program for managers.

Based on your note, I would be glad to share the curriculum outline and upcoming cohort schedule so you can review whether the format fits your timeline.

Would you like me to send the program syllabus, or would a brief introductory call be helpful?
{{booking_url}}

Warm regards,
{{owner_label}}
{{business_name}}`,
    },
    {
      id: 'tpl_corporate_scope',
      name: 'Corporate training — scoping questions',
      route: 'corporate_training',
      subject: 'Team leadership training inquiry for {{organization}} — {{business_name}}',
      body: `Hi {{lead_name}},

Thank you for reaching out to {{business_name}} regarding leadership training for your team at {{organization}}.

To help us prepare relevant options for a scoping conversation, could you share:
1. Approximate number of participants and their management levels?
2. Preferred format (virtual workshops, in-person sessions, or multi-week cohort)?

You can also propose a time for an initial scoping call at your convenience:
{{booking_url}}

Best regards,
{{owner_label}}
{{business_name}}`,
    },
    {
      id: 'tpl_speaking_inquiry',
      name: 'Speaking — event details',
      route: 'speaking',
      subject: 'Speaking inquiry follow-up — {{business_name}}',
      body: `Hi {{lead_name}},

Thank you for contacting {{business_name}} regarding your upcoming event.

To help our team review schedule alignment and session format, could you confirm the proposed event date(s), location or virtual platform, and expected audience profile?

Once we have those details, we will follow up promptly.

Best regards,
{{owner_label}}
{{business_name}}`,
    },
    {
      id: 'tpl_clarifying_question',
      name: 'Needs review — clarifying question',
      route: 'review',
      subject: 'Quick question regarding your inquiry — {{business_name}}',
      body: `Hi {{lead_name}},

Thank you for reaching out to {{business_name}}. We reviewed your note and want to make sure we point you to the most relevant option.

Could you share a bit more about whether you are looking for individualized 1:1 support, a structured manager program, or training for an intact team, along with your preferred timeline?

Best regards,
{{owner_label}}
{{business_name}}`,
    },
  ],
});
