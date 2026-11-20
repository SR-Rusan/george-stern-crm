import {
  ActivityRecord,
  CRMSettings,
  EmailTemplate,
  LeadRecord,
  TaskRecord,
} from './schemas';
import {
  computeDeterministicScoreAndRoute,
  DEFAULT_OFFERS,
  DEFAULT_SCORE_RULES,
} from './scoring';
import { client } from '@/config/client';

/** Email templates come from the active client file (or are generated from its services). */
export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = client.emailTemplates;

export function buildDefaultSettings(): CRMSettings {
  return {
    id: 'default',
    updated_at: new Date().toISOString(),
    business_name: client.business.name,
    brand_accent: client.brand.accent,
    brand_tagline: client.business.tagline,
    default_owner: client.business.ownerLabel,
    booking_url_placeholder: client.links.bookingUrl,
    data_retention_days: 365,
    offers: DEFAULT_OFFERS,
    score_rules: DEFAULT_SCORE_RULES,
    email_templates: DEFAULT_EMAIL_TEMPLATES,
    webhook_events: ['lead.created', 'lead.qualified'],
  };
}

function daysAgoIso(days: number, hourOffset = 0): string {
  const d = new Date(Date.now() - days * 86400000 + hourOffset * 3600000);
  return d.toISOString();
}

function daysFromNowIso(days: number, hourOffset = 0): string {
  const d = new Date(Date.now() + days * 86400000 + hourOffset * 3600000);
  return d.toISOString();
}

export function buildSeedDataset(): {
  leads: LeadRecord[];
  activities: ActivityRecord[];
  tasks: TaskRecord[];
  settings: CRMSettings;
} {
  const settings = buildDefaultSettings();

  // Helper to construct a lead with deterministic scoring
  const rawLeads: Array<
    Omit<
      LeadRecord,
      'priority_score' | 'priority_label' | 'score_breakdown' | 'suggested_route'
    > & {
      ai_route_candidate: LeadRecord['suggested_route'];
    }
  > = [
    // 1. Manager with specific current challenge, timing "Now" -> 1:1 Coaching
    {
      id: '11111111-1111-4111-8111-111111111101',
      created_at: daysAgoIso(2, -3),
      updated_at: daysAgoIso(1, -2),
      is_demo: true,
      name: 'Elena Rostova',
      email: 'elena.rostova@apex-fictional.example.com',
      organization: 'Apex Cloud Systems',
      role_type: 'manager',
      team_size_range: '6-15',
      requested_service: 'one_to_one_coaching',
      challenge:
        'Recently promoted to Senior Engineering Manager overseeing 12 engineers across two time zones. Struggling to shift from tactical code reviews to strategic delegation and navigating difficult performance conversations with a former peer.',
      timing: 'now',
      source: 'linkedin_profile',
      referrer: 'Newsletter post on delegation',
      consent_response: true,
      consent_response_at: daysAgoIso(2, -3),
      marketing_email_consent: true,
      marketing_email_consent_at: daysAgoIso(2, -3),
      pipeline_stage: 'qualified',
      ai_route_candidate: 'one_to_one_coaching',
      selected_route: 'one_to_one_coaching',
      ai_summary:
        'Elena Rostova is a newly promoted Senior Engineering Manager leading 6–15 people who seeks immediate 1:1 coaching on strategic delegation and peer-to-manager performance conversations.',
      ai_evidence: [
        { field: 'role_type', value: 'Manager (Senior Engineering Manager)' },
        { field: 'requested_service', value: '1:1 Coaching' },
        { field: 'timing', value: 'Now' },
        {
          field: 'challenge',
          value: 'Shifting from tactical reviews to strategic delegation and peer performance conversations',
        },
      ],
      ai_missing_information: [],
      ai_confidence: 0.94,
      ai_suggested_next_action: 'Offer a discovery call',
      ai_model: 'mock/deterministic-demo-adapter',
      qualification_status: 'mock_completed',
      qualification_updated_at: daysAgoIso(2, -3),
      qualification_error: null,
      reviewed_by_human: true,
      reviewed_at: daysAgoIso(1, -2),
      owner_label: client.business.ownerLabel,
      next_action: 'Send discovery call link and confirm availability',
      follow_up_at: daysFromNowIso(0, -2), // Overdue today for attention panel
      estimated_value: null,
      won_at: null,
      lost_reason: null,
      notes:
        'Strong alignment for 1:1 coaching. Clear transition challenge from IC/lead to senior manager.',
      last_activity_at: daysAgoIso(1, -2),
    },

    // 2. New manager looking for structured program, timing "Within 3 months" -> Group Program
    {
      id: '11111111-1111-4111-8111-111111111102',
      created_at: daysAgoIso(4, -1),
      updated_at: daysAgoIso(3, 0),
      is_demo: true,
      name: 'Marcus Vance',
      email: 'marcus.vance@harborbio-demo.example.com',
      organization: 'Harbor BioLabs',
      role_type: 'manager',
      team_size_range: '1-5',
      requested_service: 'group_program',
      challenge:
        'First-time people manager leading a team of 4 research analysts. Looking for a structured curriculum with peer practice on running effective 1:1s, setting quarterly goals, and giving constructive feedback.',
      timing: 'within_3_months',
      source: 'public_inquiry_form',
      referrer: 'Colleague referral (fictional)',
      consent_response: true,
      consent_response_at: daysAgoIso(4, -1),
      marketing_email_consent: true,
      marketing_email_consent_at: daysAgoIso(4, -1),
      pipeline_stage: 'contacted',
      ai_route_candidate: 'group_program',
      selected_route: 'group_program',
      ai_summary:
        'Marcus Vance is a first-time manager of 1–5 analysts seeking a structured group program within 3 months focused on core management habits (1:1s, goal setting, and feedback).',
      ai_evidence: [
        { field: 'role_type', value: 'Manager (first-time people manager)' },
        { field: 'requested_service', value: 'Group program' },
        { field: 'timing', value: 'Within 3 months' },
        { field: 'challenge', value: 'Structured curriculum for 1:1s, quarterly goals, and feedback' },
      ],
      ai_missing_information: ['Whether organization is sponsoring L&D tuition'],
      ai_confidence: 0.9,
      ai_suggested_next_action: 'Send program information',
      ai_model: 'mock/deterministic-demo-adapter',
      qualification_status: 'mock_completed',
      qualification_updated_at: daysAgoIso(4, -1),
      qualification_error: null,
      reviewed_by_human: true,
      reviewed_at: daysAgoIso(3, 0),
      owner_label: 'Program Coordinator',
      next_action: 'Follow up on syllabus email next week',
      follow_up_at: daysFromNowIso(2, 3),
      estimated_value: null,
      won_at: null,
      lost_reason: null,
      notes: 'Sent overview of upcoming cohort format. Waiting on L&D stipend confirmation.',
      last_activity_at: daysAgoIso(3, 0),
    },

    // 3. HR leader asking for leadership training for a team -> Corporate Training
    {
      id: '11111111-1111-4111-8111-111111111103',
      created_at: daysAgoIso(6, 0),
      updated_at: daysAgoIso(1, 0),
      is_demo: true,
      name: 'Priya Nair',
      email: 'priya.nair@meridian-logistics-demo.example.com',
      organization: 'Meridian Global Logistics',
      role_type: 'hr_ld',
      team_size_range: '16-50',
      requested_service: 'corporate_training',
      challenge:
        'We have 28 mid-level operations managers across three regional hubs who need practical training on cross-functional accountability, feedback culture, and leading through organizational change this quarter.',
      timing: 'now',
      source: 'website_corporate_page',
      referrer: 'Direct search',
      consent_response: true,
      consent_response_at: daysAgoIso(6, 0),
      marketing_email_consent: true,
      marketing_email_consent_at: daysAgoIso(6, 0),
      pipeline_stage: 'call_booked',
      ai_route_candidate: 'corporate_training',
      selected_route: 'corporate_training',
      ai_summary:
        'Priya Nair (HR / L&D at Meridian Global Logistics) requests immediate corporate training for a cohort of 28 mid-level operations managers on accountability, feedback, and change leadership.',
      ai_evidence: [
        { field: 'role_type', value: 'HR / L&D' },
        { field: 'organization', value: 'Meridian Global Logistics' },
        { field: 'team_size_range', value: '16-50 (28 mid-level operations managers)' },
        { field: 'requested_service', value: 'Corporate training' },
        { field: 'timing', value: 'Now' },
      ],
      ai_missing_information: ['Preferred delivery format (in-person vs. virtual workshops)'],
      ai_confidence: 0.96,
      ai_suggested_next_action: 'Route to corporate inquiry review',
      ai_model: 'mock/deterministic-demo-adapter',
      qualification_status: 'mock_completed',
      qualification_updated_at: daysAgoIso(6, 0),
      qualification_error: null,
      reviewed_by_human: true,
      reviewed_at: daysAgoIso(5, 0),
      owner_label: client.business.ownerLabel,
      next_action: 'Prepare scoping agenda for Thursday discovery call',
      follow_up_at: daysFromNowIso(1, 2),
      estimated_value: null,
      won_at: null,
      lost_reason: null,
      notes: 'Scoping call scheduled with VP of People and L&D Director.',
      last_activity_at: daysAgoIso(1, 0),
    },

    // 4. Event organizer asking about a keynote -> Speaking
    {
      id: '11111111-1111-4111-8111-111111111104',
      created_at: daysAgoIso(5, 0),
      updated_at: daysAgoIso(2, 0),
      is_demo: true,
      name: 'David Lindqvist',
      email: 'd.lindqvist@nordic-tech-summit.example.com',
      organization: 'Nordic Product Leaders Forum',
      role_type: 'other',
      team_size_range: '200+',
      requested_service: 'speaking',
      challenge:
        'Organizing our annual autumn leadership forum for 250 product and engineering directors. Looking for a 45-minute opening keynote on high-trust leadership and decision clarity in distributed organizations.',
      timing: 'within_3_months',
      source: 'speaking_page',
      referrer: 'Past conference attendee mention (fictional)',
      consent_response: true,
      consent_response_at: daysAgoIso(5, 0),
      marketing_email_consent: false,
      marketing_email_consent_at: null,
      pipeline_stage: 'new_inquiry',
      ai_route_candidate: 'speaking',
      selected_route: null,
      ai_summary:
        'David Lindqvist from Nordic Product Leaders Forum is inquiring about a 45-minute opening keynote for 250 product and engineering directors within 3 months.',
      ai_evidence: [
        { field: 'organization', value: 'Nordic Product Leaders Forum' },
        { field: 'requested_service', value: 'Speaking / Keynote' },
        { field: 'timing', value: 'Within 3 months' },
        { field: 'challenge', value: '45-minute opening keynote for 250 directors on high-trust leadership' },
      ],
      ai_missing_information: [
        'Exact event date and city/venue format',
        'Speaker honorarium and travel budget parameters',
      ],
      ai_confidence: 0.92,
      ai_suggested_next_action: 'Route to speaking inquiry review',
      ai_model: 'mock/deterministic-demo-adapter',
      qualification_status: 'mock_completed',
      qualification_updated_at: daysAgoIso(5, 0),
      qualification_error: null,
      reviewed_by_human: false,
      reviewed_at: null,
      owner_label: 'Speaking & Events Desk',
      next_action: 'Review event date requirements (Note: no marketing email consent checked)',
      follow_up_at: daysFromNowIso(0, 4),
      estimated_value: null,
      won_at: null,
      lost_reason: null,
      notes: 'Note: Submitter acknowledged inquiry response but did not opt in to follow-up email checkbox.',
      last_activity_at: daysAgoIso(5, 0),
    },

    // 5. Vague inquiry with conflicting answers -> Needs Review
    {
      id: '11111111-1111-4111-8111-111111111105',
      created_at: daysAgoIso(1, -5),
      updated_at: daysAgoIso(1, -5),
      is_demo: true,
      name: 'Jordan Mercer',
      email: 'j.mercer@unspecified-org.example.com',
      organization: '',
      role_type: 'other',
      team_size_range: '1-5',
      requested_service: 'one_to_one_coaching',
      challenge:
        'We might want a keynote speaker for our 500 attendees conference next year, or maybe just browsing for general leadership tips. No rush at all, not ready now.',
      timing: 'now',
      source: 'public_inquiry_form',
      referrer: '',
      consent_response: true,
      consent_response_at: daysAgoIso(1, -5),
      marketing_email_consent: true,
      marketing_email_consent_at: daysAgoIso(1, -5),
      pipeline_stage: 'needs_review',
      ai_route_candidate: 'review',
      selected_route: null,
      ai_summary:
        'Inquiry from Jordan Mercer contains conflicting answers: selected 1:1 Coaching and "Now" timing, while the text mentions a 500-person conference keynote next year and "no rush at all".',
      ai_evidence: [
        { field: 'requested_service', value: 'Selected 1:1 Coaching' },
        { field: 'timing', value: 'Selected Now' },
        {
          field: 'challenge',
          value: 'Mentions keynote speaker for 500 attendees next year and "not ready now"',
        },
      ],
      ai_missing_information: [
        'Clarification on whether inquiry is for an event keynote or personal coaching',
        'Organization name',
        'Actual target timeline',
      ],
      ai_confidence: 0.36,
      ai_suggested_next_action: 'Ask one clarifying question',
      ai_model: 'mock/deterministic-demo-adapter',
      qualification_status: 'mock_completed',
      qualification_updated_at: daysAgoIso(1, -5),
      qualification_error: null,
      reviewed_by_human: false,
      reviewed_at: null,
      owner_label: 'Advisory Intake Team',
      next_action: 'Triage contradictory fields before outreach',
      follow_up_at: daysAgoIso(0, 6), // Overdue
      estimated_value: null,
      won_at: null,
      lost_reason: null,
      notes: 'Flagged automatically by rules engine due to contradictory service/timing statements.',
      last_activity_at: daysAgoIso(1, -5),
    },

    // 6. Lead in Proposal / Offer Sent stage (no value assumed)
    {
      id: '11111111-1111-4111-8111-111111111106',
      created_at: daysAgoIso(12, 0),
      updated_at: daysAgoIso(2, 0),
      is_demo: true,
      name: 'Claire Beaumont',
      email: 'c.beaumont@solstice-fin-demo.example.com',
      organization: 'Solstice Financial Partners',
      role_type: 'founder_executive',
      team_size_range: '51-200',
      requested_service: 'one_to_one_coaching',
      challenge:
        'COO scaling an organization from 75 to 140 employees. Looking for executive coaching on executive team alignment, board communication, and restructuring senior leadership rituals.',
      timing: 'now',
      source: 'executive_referral',
      referrer: 'Board member introduction (fictional)',
      consent_response: true,
      consent_response_at: daysAgoIso(12, 0),
      marketing_email_consent: true,
      marketing_email_consent_at: daysAgoIso(12, 0),
      pipeline_stage: 'offer_sent',
      ai_route_candidate: 'one_to_one_coaching',
      selected_route: 'one_to_one_coaching',
      ai_summary:
        'Claire Beaumont (COO at Solstice Financial Partners) seeks immediate 1:1 executive coaching focused on executive team alignment and scaling leadership cadences.',
      ai_evidence: [
        { field: 'role_type', value: 'Founder / Executive (COO)' },
        { field: 'organization', value: 'Solstice Financial Partners' },
        { field: 'requested_service', value: '1:1 Coaching' },
        { field: 'timing', value: 'Now' },
      ],
      ai_missing_information: [],
      ai_confidence: 0.95,
      ai_suggested_next_action: 'Offer a discovery call',
      ai_model: 'mock/deterministic-demo-adapter',
      qualification_status: 'mock_completed',
      qualification_updated_at: daysAgoIso(12, 0),
      qualification_error: null,
      reviewed_by_human: true,
      reviewed_at: daysAgoIso(11, 0),
      owner_label: client.business.ownerLabel,
      next_action: 'Review proposal feedback with Claire on Friday',
      follow_up_at: daysFromNowIso(2, 0),
      estimated_value: null, // Explicitly null per requirement: never prepopulate from assumptions
      won_at: null,
      lost_reason: null,
      notes: 'Discovery call completed. Sent 6-month executive coaching scope document (fictional demo).',
      last_activity_at: daysAgoIso(2, 0),
    },

    // 7. Lead in Won stage (demonstrating completed pipeline progression, no invented price)
    {
      id: '11111111-1111-4111-8111-111111111107',
      created_at: daysAgoIso(18, 0),
      updated_at: daysAgoIso(4, 0),
      is_demo: true,
      name: 'Samuel Okafor',
      email: 's.okafor@veridian-health-demo.example.com',
      organization: 'Veridian Health Tech',
      role_type: 'hr_ld',
      team_size_range: '51-200',
      requested_service: 'corporate_training',
      challenge:
        'Seeking a two-part leadership workshop series for 22 engineering and product managers focused on psychological safety, clear decision ownership, and cross-team alignment.',
      timing: 'within_3_months',
      source: 'public_inquiry_form',
      referrer: 'LinkedIn article',
      consent_response: true,
      consent_response_at: daysAgoIso(18, 0),
      marketing_email_consent: true,
      marketing_email_consent_at: daysAgoIso(18, 0),
      pipeline_stage: 'won',
      ai_route_candidate: 'corporate_training',
      selected_route: 'corporate_training',
      ai_summary:
        'Samuel Okafor (HR / L&D at Veridian Health Tech) requested a corporate workshop series for 22 product and engineering managers.',
      ai_evidence: [
        { field: 'role_type', value: 'HR / L&D' },
        { field: 'organization', value: 'Veridian Health Tech' },
        { field: 'team_size_range', value: '51-200' },
        { field: 'requested_service', value: 'Corporate training' },
      ],
      ai_missing_information: [],
      ai_confidence: 0.93,
      ai_suggested_next_action: 'Route to corporate inquiry review',
      ai_model: 'mock/deterministic-demo-adapter',
      qualification_status: 'mock_completed',
      qualification_updated_at: daysAgoIso(18, 0),
      qualification_error: null,
      reviewed_by_human: true,
      reviewed_at: daysAgoIso(17, 0),
      owner_label: client.business.ownerLabel,
      next_action: 'Kickoff workshop scheduling complete',
      follow_up_at: null,
      estimated_value: null, // Left null until human enters an explicit deal value
      won_at: daysAgoIso(4, 0),
      lost_reason: null,
      notes: 'Signed workshop agreement (fictional demo record; enter deal value manually if testing revenue metrics).',
      last_activity_at: daysAgoIso(4, 0),
    },

    // 8. Lead in Lost stage with recorded loss reason
    {
      id: '11111111-1111-4111-8111-111111111108',
      created_at: daysAgoIso(21, 0),
      updated_at: daysAgoIso(9, 0),
      is_demo: true,
      name: 'Hannah Alvarez',
      email: 'hannah.alvarez@kestrel-studio-demo.example.com',
      organization: 'Kestrel Design Studio',
      role_type: 'founder_executive',
      team_size_range: '6-15',
      requested_service: 'group_program',
      challenge:
        'Exploring development options for two newly promoted design leads later in the fiscal year once our Q4 client engagements wrap up.',
      timing: 'later',
      source: 'public_inquiry_form',
      referrer: '',
      consent_response: true,
      consent_response_at: daysAgoIso(21, 0),
      marketing_email_consent: true,
      marketing_email_consent_at: daysAgoIso(21, 0),
      pipeline_stage: 'lost',
      ai_route_candidate: 'group_program',
      selected_route: 'group_program',
      ai_summary:
        'Hannah Alvarez inquired about future group program seats for two design leads later in the year.',
      ai_evidence: [
        { field: 'role_type', value: 'Founder / Executive' },
        { field: 'requested_service', value: 'Group program' },
        { field: 'timing', value: 'Later' },
      ],
      ai_missing_information: [],
      ai_confidence: 0.85,
      ai_suggested_next_action: 'Send program information',
      ai_model: 'mock/deterministic-demo-adapter',
      qualification_status: 'mock_completed',
      qualification_updated_at: daysAgoIso(21, 0),
      qualification_error: null,
      reviewed_by_human: true,
      reviewed_at: daysAgoIso(20, 0),
      owner_label: 'Program Coordinator',
      next_action: null,
      follow_up_at: null,
      estimated_value: null,
      won_at: null,
      lost_reason: 'Timing',
      notes: 'Paused until next fiscal year due to client launch schedule.',
      last_activity_at: daysAgoIso(9, 0),
    },
  ];

  const leads: LeadRecord[] = rawLeads.map((item) => {
    const { ai_route_candidate, ...rest } = item;
    const scoring = computeDeterministicScoreAndRoute(
      {
        name: rest.name,
        email: rest.email,
        organization: rest.organization,
        role_type: rest.role_type,
        team_size_range: rest.team_size_range,
        requested_service: rest.requested_service,
        challenge: rest.challenge,
        timing: rest.timing,
        ai_suggested_route: ai_route_candidate,
        ai_confidence: rest.ai_confidence,
        ai_missing_information: rest.ai_missing_information,
      },
      settings.score_rules,
      settings.offers
    );

    return {
      ...rest,
      suggested_route: scoring.effective_suggested_route,
      priority_score: scoring.priority_score,
      priority_label: scoring.priority_label,
      score_breakdown: scoring.score_breakdown,
    };
  });

  const activities: ActivityRecord[] = [
    {
      id: '22222222-2222-4222-8222-222222222201',
      lead_id: '11111111-1111-4111-8111-111111111101',
      created_at: daysAgoIso(2, -3),
      actor_type: 'system',
      actor_label: 'Public Inquiry Intake',
      event_type: 'lead_created',
      summary: 'Inquiry submitted by Elena Rostova.',
      metadata: { source: 'linkedin_profile', is_demo: true },
    },
    {
      id: '22222222-2222-4222-8222-222222222202',
      lead_id: '11111111-1111-4111-8111-111111111101',
      created_at: daysAgoIso(2, -3),
      actor_type: 'system',
      actor_label: 'Qualification Service',
      event_type: 'qualification_completed',
      summary:
        'Mock qualification suggested 1:1 Coaching (94% confidence, Priority 5/8 Medium).',
      metadata: {
        model: 'mock/deterministic-demo-adapter',
        suggested_route: 'one_to_one_coaching',
        priority_score: 5,
      },
    },
    {
      id: '22222222-2222-4222-8222-222222222203',
      lead_id: '11111111-1111-4111-8111-111111111101',
      created_at: daysAgoIso(1, -2),
      actor_type: 'user',
      actor_label: client.business.ownerLabel,
      event_type: 'stage_changed',
      summary: 'Moved pipeline stage from New inquiry to Qualified after human review.',
      metadata: { from: 'new_inquiry', to: 'qualified' },
    },
    {
      id: '22222222-2222-4222-8222-222222222204',
      lead_id: '11111111-1111-4111-8111-111111111103',
      created_at: daysAgoIso(6, 0),
      actor_type: 'system',
      actor_label: 'Public Inquiry Intake',
      event_type: 'lead_created',
      summary: 'Corporate training inquiry submitted by Priya Nair.',
      metadata: { source: 'website_corporate_page', is_demo: true },
    },
    {
      id: '22222222-2222-4222-8222-222222222205',
      lead_id: '11111111-1111-4111-8111-111111111103',
      created_at: daysAgoIso(6, 0),
      actor_type: 'system',
      actor_label: 'Qualification Service',
      event_type: 'qualification_completed',
      summary:
        'AI suggested corporate training (96% confidence, priority 7/8, high).',
      metadata: {
        model: 'mock/deterministic-demo-adapter',
        suggested_route: 'corporate_training',
        priority_score: 7,
      },
    },
    {
      id: '22222222-2222-4222-8222-222222222206',
      lead_id: '11111111-1111-4111-8111-111111111103',
      created_at: daysAgoIso(1, 0),
      actor_type: 'user',
      actor_label: client.business.ownerLabel,
      event_type: 'stage_changed',
      summary: 'Moved pipeline stage from Contacted to Call booked.',
      metadata: { from: 'contacted', to: 'call_booked' },
    },
    {
      id: '22222222-2222-4222-8222-222222222207',
      lead_id: '11111111-1111-4111-8111-111111111105',
      created_at: daysAgoIso(1, -5),
      actor_type: 'system',
      actor_label: 'Qualification Service',
      event_type: 'qualification_completed',
      summary:
        'Routed to Needs Review due to contradictory service/timing statements (36% confidence).',
      metadata: {
        model: 'mock/deterministic-demo-adapter',
        suggested_route: 'review',
      },
    },
    {
      id: '22222222-2222-4222-8222-222222222208',
      lead_id: '11111111-1111-4111-8111-111111111106',
      created_at: daysAgoIso(2, 0),
      actor_type: 'user',
      actor_label: client.business.ownerLabel,
      event_type: 'stage_changed',
      summary: 'Moved pipeline stage from Call booked to Proposal sent.',
      metadata: { from: 'call_booked', to: 'offer_sent' },
    },
    {
      id: '22222222-2222-4222-8222-222222222209',
      lead_id: '11111111-1111-4111-8111-111111111107',
      created_at: daysAgoIso(4, 0),
      actor_type: 'user',
      actor_label: client.business.ownerLabel,
      event_type: 'stage_changed',
      summary: 'Confirmed stage transition to Won (fictional demo cohort).',
      metadata: { from: 'offer_sent', to: 'won', confirmed: true },
    },
    {
      id: '22222222-2222-4222-8222-222222222210',
      lead_id: '11111111-1111-4111-8111-111111111108',
      created_at: daysAgoIso(9, 0),
      actor_type: 'user',
      actor_label: 'Program Coordinator',
      event_type: 'stage_changed',
      summary: 'Marked lead as Lost (Reason: Timing).',
      metadata: { from: 'contacted', to: 'lost', lost_reason: 'Timing', confirmed: true },
    },
  ];

  const tasks: TaskRecord[] = [
    {
      id: '33333333-3333-4333-8333-333333333301',
      lead_id: '11111111-1111-4111-8111-111111111101',
      title: 'Send 1:1 coaching discovery call link to Elena Rostova',
      due_at: daysAgoIso(0, 3), // Overdue
      owner: client.business.ownerLabel,
      status: 'open',
      notes: 'Include brief note addressing transition from IC to senior engineering manager.',
      completed_at: null,
      created_at: daysAgoIso(1, -2),
    },
    {
      id: '33333333-3333-4333-8333-333333333302',
      lead_id: '11111111-1111-4111-8111-111111111105',
      title: 'Review contradictory inquiry from Jordan Mercer and send 1 clarifying question',
      due_at: daysAgoIso(0, 5), // Overdue
      owner: 'Advisory Intake Team',
      status: 'open',
      notes: 'Confirm whether they are asking about an event keynote next year or 1:1 coaching.',
      completed_at: null,
      created_at: daysAgoIso(1, -5),
    },
    {
      id: '33333333-3333-4333-8333-333333333303',
      lead_id: '11111111-1111-4111-8111-111111111104',
      title: 'Check autumn calendar availability for Nordic Product Leaders Forum keynote',
      due_at: daysFromNowIso(0, 3), // Today
      owner: 'Speaking & Events Desk',
      status: 'open',
      notes: 'Request exact event dates and location details.',
      completed_at: null,
      created_at: daysAgoIso(2, 0),
    },
    {
      id: '33333333-3333-4333-8333-333333333304',
      lead_id: '11111111-1111-4111-8111-111111111103',
      title: 'Prepare scoping agenda for Meridian Global Logistics corporate training call',
      due_at: daysFromNowIso(1, 2), // Upcoming
      owner: client.business.ownerLabel,
      status: 'open',
      notes: '28 operations managers across 3 hubs — outline 3-module workshop option.',
      completed_at: null,
      created_at: daysAgoIso(1, 0),
    },
    {
      id: '33333333-3333-4333-8333-333333333305',
      lead_id: '11111111-1111-4111-8111-111111111106',
      title: 'Follow up with Claire Beaumont on executive coaching proposal',
      due_at: daysFromNowIso(2, 0), // Upcoming
      owner: client.business.ownerLabel,
      status: 'open',
      notes: 'Confirm start date and cadence preferences.',
      completed_at: null,
      created_at: daysAgoIso(2, 0),
    },
    {
      id: '33333333-3333-4333-8333-333333333306',
      lead_id: '11111111-1111-4111-8111-111111111102',
      title: 'Send group program syllabus to Marcus Vance',
      due_at: daysAgoIso(3, 0),
      owner: 'Program Coordinator',
      status: 'completed',
      notes: 'Sent PDF syllabus overview.',
      completed_at: daysAgoIso(3, 0),
      created_at: daysAgoIso(4, 0),
    },
  ];

  return { leads, activities, tasks, settings };
}
