import {
  OfferDefinition,
  PriorityLabel,
  RequestedService,
  RoleType,
  ScoreBreakdownItem,
  ScoreRulesConfig,
  ServiceRoute,
  TeamSizeRange,
  TimingOption,
} from './schemas';
import { client } from '@/config/client';
import { SERVICE_SLOTS } from '@/config/schema';

export interface ScoringInput {
  name?: string | null;
  email?: string | null;
  organization?: string | null;
  role_type?: RoleType | null;
  team_size_range?: TeamSizeRange | '' | null;
  requested_service?: RequestedService | null;
  challenge?: string | null;
  timing?: TimingOption | null;
  ai_suggested_route?: ServiceRoute | null;
  ai_confidence?: number | null;
  ai_missing_information?: string[];
}

export interface ScoringResult {
  priority_score: number;
  priority_label: PriorityLabel;
  score_breakdown: ScoreBreakdownItem[];
  effective_suggested_route: ServiceRoute;
  forced_review: boolean;
  forced_review_reasons: string[];
  contradictions: string[];
  missing_required_fields: string[];
}

export const DEFAULT_SCORE_RULES: ScoreRulesConfig = {
  timing_now_points: 2,
  timing_within_3_months_points: 1,
  service_match_points: 2,
  specific_challenge_points: 1,
  corporate_org_or_team_points: 2,
  min_confidence_threshold: 0.65,
  ...client.scoring,
};

/** Offers come from the active client file; disabled services are inactive. */
export const DEFAULT_OFFERS: OfferDefinition[] = [
  ...SERVICE_SLOTS.map((slot) => ({
    route: slot,
    label: client.services[slot].label,
    description: client.services[slot].description,
    typical_audience: client.services[slot].audience,
    active: client.services[slot].enabled,
  })),
  {
    route: 'review',
    label: 'Needs review',
    description: 'Unclear, incomplete, low-confidence, or conflicting request',
    typical_audience: 'Inquiries requiring human triage before routing',
    active: true,
  },
];

/**
 * Detects contradictory answers in an inquiry using transparent, deterministic heuristics.
 */
export function detectContradictions(input: ScoringInput): string[] {
  const contradictions: string[] = [];
  const challengeLower = (input.challenge ?? '').toLowerCase();
  const requested = input.requested_service;
  const timing = input.timing;

  // Contradiction 1: Timing "Now" vs challenge stating next year / no rush / browsing only
  if (
    timing === 'now' &&
    (/\b(next year|in 202[789]|no rush|just browsing|not ready now|12 months|maybe later)\b/i.test(
      challengeLower
    ))
  ) {
    contradictions.push(
      'Selected timing "Now", but challenge text indicates a distant or exploratory timeline.'
    );
  }

  // Contradiction 2: Selected 1:1 coaching while asking for a keynote or conference talk
  if (
    requested === 'one_to_one_coaching' &&
    /\b(keynote|conference speaker|annual summit|panelists?|500 attendees|event speaker)\b/i.test(
      challengeLower
    ) &&
    !/\b(1:1|one-on-one|executive coach for me)\b/i.test(challengeLower)
  ) {
    contradictions.push(
      `Requested ${client.services.one_to_one_coaching.label}, but the description mentions an event keynote or speaking engagement.`
    );
  }

  // Contradiction 3: Selected Speaking while asking only for personal 1:1 coaching
  if (
    requested === 'speaking' &&
    /\b(coach me personally|my own transition|1:1 coaching only|individual coaching for myself)\b/i.test(
      challengeLower
    ) &&
    !/\b(keynote|event|conference|offsite|workshop|speak|talk|summit)\b/i.test(challengeLower)
  ) {
    contradictions.push(
      `Requested ${client.services.speaking.label}, but the description asks for personal 1:1 support with no event details.`
    );
  }

  // Contradiction 5: Selected 1:1 coaching but describes training for a group of people
  if (
    requested === 'one_to_one_coaching' &&
    (/\b(\d{2,}|[3-9])\s+(\w+\s+)?(managers|supervisors|leaders|employees|staff|people|team leads|directors|participants)\b/i.test(challengeLower) ||
      /\b(whole (group|team)|entire team|all (our|of our|my) (managers|supervisors|leaders|staff)|cohort|workshops?|training for (our|my|the) team|team training)\b/i.test(challengeLower)) &&
    !/\b(1:1|one-on-one|one on one|for me personally|just for me|myself)\b/i.test(challengeLower)
  ) {
    contradictions.push(
      `Requested ${client.services.one_to_one_coaching.label}, but the description asks for support for a group or team.`
    );
  }

  // Contradiction 4: Selected Corporate Training but explicitly states solo / no team
  if (
    requested === 'corporate_training' &&
    /\b(just for me|only myself|no team|solo contributor|individual only)\b/i.test(challengeLower)
  ) {
    contradictions.push(
      'Requested Corporate/Team Training, but challenge text states support is for an individual only.'
    );
  }

  return contradictions;
}

/**
 * Checks whether a challenge description is specific rather than vague filler.
 */
export function isSpecificChallenge(challenge: string | null | undefined): boolean {
  if (!challenge) return false;
  const trimmed = challenge.trim();
  if (trimmed.length < 35) return false;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 7) return false;

  // Check if it's purely generic filler
  const vaguePatterns = [
    /^need help with leadership\.?$/i,
    /^looking for coaching\.?$/i,
    /^not sure what we need yet\.?$/i,
    /^please contact me\.?$/i,
    /^want more info\.?$/i,
  ];
  if (vaguePatterns.some((re) => re.test(trimmed))) {
    return false;
  }

  return true;
}

/**
 * Maps numeric score (0-8) to Low (0-2), Medium (3-5), or High (6-8).
 */
export function getPriorityLabel(score: number): PriorityLabel {
  if (score >= 6) return 'High';
  if (score >= 3) return 'Medium';
  return 'Low';
}

/**
 * Deterministic Priority Scoring & Route Verification Engine.
 * Computes the 0-8 score and breakdown from explicit inquiry fields.
 */
export function computeDeterministicScoreAndRoute(
  input: ScoringInput,
  rules: ScoreRulesConfig = DEFAULT_SCORE_RULES,
  offers: OfferDefinition[] = DEFAULT_OFFERS
): ScoringResult {
  const breakdown: ScoreBreakdownItem[] = [];
  const missingRequired: string[] = [];
  const forcedReviewReasons: string[] = [];

  if (!input.name || input.name.trim().length < 2) {
    missingRequired.push('name');
  }
  if (!input.email || !input.email.includes('@')) {
    missingRequired.push('email');
  }
  if (!input.role_type) {
    missingRequired.push('role_type');
  }
  if (!input.requested_service) {
    missingRequired.push('requested_service');
  }
  if (!input.challenge || input.challenge.trim().length < 15) {
    missingRequired.push('challenge');
  }
  if (!input.timing) {
    missingRequired.push('timing');
  }

  const hasMissingRequired = missingRequired.length > 0;
  if (hasMissingRequired) {
    forcedReviewReasons.push(
      `Missing required inquiry fields: ${missingRequired.join(', ')}.`
    );
  }

  const contradictions = detectContradictions(input);
  if (contradictions.length > 0) {
    forcedReviewReasons.push(...contradictions);
  }

  // Rule 1: Timing ("Now" +2, "Within 3 months" +1)
  if (!input.timing) {
    breakdown.push({
      rule_id: 'timing',
      label: 'Timing',
      points: 0,
      awarded: false,
      reason: 'Missing required timing field (0 pts).',
    });
  } else if (input.timing === 'now') {
    breakdown.push({
      rule_id: 'timing',
      label: 'Timing: now',
      points: rules.timing_now_points,
      awarded: true,
      reason: `Prospective client indicated immediate timing ("Now", +${rules.timing_now_points} pts).`,
    });
  } else if (input.timing === 'within_3_months') {
    breakdown.push({
      rule_id: 'timing',
      label: 'Timing: within 3 months',
      points: rules.timing_within_3_months_points,
      awarded: true,
      reason: `Prospective client plans to start within 3 months (+${rules.timing_within_3_months_points} pt).`,
    });
  } else {
    breakdown.push({
      rule_id: 'timing',
      label: 'Timing',
      points: 0,
      awarded: false,
      reason: `Timing set to "${input.timing === 'later' ? 'Later' : 'Exploring'}" (0 pts).`,
    });
  }

  // Rule 2: Stated service matches one of the configured active offers (+2)
  const activeOfferRoutes = new Set(
    offers
      .filter((o) => o.active && o.route !== 'review')
      .map((o) => o.route)
  );
  const serviceMatchesOffer =
    Boolean(input.requested_service) &&
    input.requested_service !== 'not_sure' &&
    activeOfferRoutes.has(input.requested_service as ServiceRoute);

  if (serviceMatchesOffer) {
    const matchedOffer = offers.find((o) => o.route === input.requested_service);
    breakdown.push({
      rule_id: 'service_match',
      label: 'Matches an offer',
      points: rules.service_match_points,
      awarded: true,
      reason: `Stated service matches configured offer "${matchedOffer?.label ?? input.requested_service}" (+${rules.service_match_points} pts).`,
    });
  } else {
    breakdown.push({
      rule_id: 'service_match',
      label: 'Matches an offer',
      points: 0,
      awarded: false,
      reason:
        input.requested_service === 'not_sure'
          ? 'Applicant selected "Not sure" for requested service (0 pts).'
          : 'No matching configured service selected (0 pts).',
    });
  }

  // Rule 3: Specific challenge present (+1)
  const challengeSpecific = isSpecificChallenge(input.challenge);
  if (challengeSpecific) {
    breakdown.push({
      rule_id: 'specific_challenge',
      label: `Specific ${client.terms.challenge.toLowerCase()}`,
      points: rules.specific_challenge_points,
      awarded: true,
      reason: `Detailed ${client.terms.challenge.toLowerCase()} provided (+${rules.specific_challenge_points} pt).`,
    });
  } else {
    breakdown.push({
      rule_id: 'specific_challenge',
      label: `Specific ${client.terms.challenge.toLowerCase()}`,
      points: 0,
      awarded: false,
      reason: 'Challenge description is brief, missing, or non-specific (0 pts).',
    });
  }

  // Rule 4: Corporate/team training request with organization or team-size information (+2)
  const hasOrg = Boolean(input.organization && input.organization.trim().length >= 2);
  const hasTeamSize = Boolean(input.team_size_range && input.team_size_range.trim().length > 0);
  const isCorporateRequest = input.requested_service === 'corporate_training';

  if (isCorporateRequest && (hasOrg || hasTeamSize)) {
    const details = [
      hasOrg ? `Organization: ${input.organization?.trim()}` : null,
      hasTeamSize ? `Team size: ${input.team_size_range}` : null,
    ]
      .filter(Boolean)
      .join(', ');

    breakdown.push({
      rule_id: 'corporate_context',
      label: 'Team training details',
      points: rules.corporate_org_or_team_points,
      awarded: true,
      reason: `Corporate/team training inquiry includes organizational scope (${details}) (+${rules.corporate_org_or_team_points} pts).`,
    });
  } else if (isCorporateRequest && !hasOrg && !hasTeamSize) {
    forcedReviewReasons.push(
      'Corporate training requested without organization name or team size range.'
    );
    breakdown.push({
      rule_id: 'corporate_context',
      label: 'Team training details',
      points: 0,
      awarded: false,
      reason:
        'Corporate/team training requested, but both organization and team size are missing (0 pts; routed to review).',
    });
  } else {
    breakdown.push({
      rule_id: 'corporate_context',
      label: 'Team training details',
      points: 0,
      awarded: false,
      reason: 'Not a corporate/team training request (0 pts).',
    });
  }

  // Check AI confidence threshold
  if (
    typeof input.ai_confidence === 'number' &&
    input.ai_confidence < rules.min_confidence_threshold
  ) {
    forcedReviewReasons.push(
      `AI qualification confidence (${Math.round(input.ai_confidence * 100)}%) is below threshold (${Math.round(
        rules.min_confidence_threshold * 100
      )}%).`
    );
  }

  // Check if challenge is vague
  if (!challengeSpecific) {
    forcedReviewReasons.push('Challenge statement lacks enough detail for automated routing.');
  }

  // Sum and clamp score to 0-8
  const rawScore = breakdown.reduce((sum, item) => sum + (item.awarded ? item.points : 0), 0);
  const clampedScore = Math.max(0, Math.min(8, rawScore));
  const priorityLabel = getPriorityLabel(clampedScore);

  // Determine effective route
  let baseRoute: ServiceRoute =
    input.ai_suggested_route ??
    (serviceMatchesOffer ? (input.requested_service as ServiceRoute) : 'review');

  const forcedReview = forcedReviewReasons.length > 0 || baseRoute === 'review';
  if (forcedReview) {
    baseRoute = 'review';
  }

  return {
    priority_score: clampedScore,
    priority_label: priorityLabel,
    score_breakdown: breakdown,
    effective_suggested_route: baseRoute,
    forced_review: forcedReview,
    forced_review_reasons: forcedReviewReasons,
    contradictions,
    missing_required_fields: missingRequired,
  };
}
