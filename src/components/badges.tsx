import React from 'react';
import {
  PIPELINE_STAGE_LABELS,
  PipelineStage,
  PriorityLabel,
  QualificationStatus,
  SERVICE_ROUTE_LABELS,
  ServiceRoute,
} from '@/lib/schemas';
import { Bot, CheckCircle2, Sparkles, UserCheck, AlertTriangle } from 'lucide-react';

/**
 * Tags are deliberately quiet: neutral surface, one coloured signal (a dot or
 * icon) only where the colour carries meaning. Brand colour = progress,
 * amber = needs attention, rose = lost/failed. Nothing else is coloured.
 */
const TAG =
  'inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-xs font-medium whitespace-nowrap';

const STAGE_DOT: Record<PipelineStage, string> = {
  new_inquiry: 'bg-stone-400',
  needs_review: 'bg-amber-500',
  qualified: 'bg-brand/40',
  contacted: 'bg-brand/60',
  call_booked: 'bg-brand/80',
  offer_sent: 'bg-brand',
  won: 'bg-brand',
  lost: 'bg-rose-500',
  not_a_fit: 'bg-stone-300',
};

export function StageBadge({ stage }: { stage: PipelineStage }) {
  if (stage === 'won') {
    return (
      <span className={`${TAG} bg-brand text-white`}>
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        {PIPELINE_STAGE_LABELS[stage]}
      </span>
    );
  }
  return (
    <span className={`${TAG} bg-stone-100 text-stone-700`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STAGE_DOT[stage]}`} aria-hidden="true" />
      {PIPELINE_STAGE_LABELS[stage]}
    </span>
  );
}

export function RouteBadge({
  suggestedRoute,
  selectedRoute,
  showSourceLabel = true,
}: {
  suggestedRoute: ServiceRoute;
  selectedRoute: ServiceRoute | null;
  showSourceLabel?: boolean;
}) {
  const isHumanConfirmed = Boolean(selectedRoute);
  const route = selectedRoute ?? suggestedRoute;
  const needsReview = route === 'review';

  return (
    <span
      className={`${TAG} ${
        needsReview ? 'bg-amber-50 text-amber-900' : 'bg-stone-100 text-stone-700'
      }`}
      title={
        isHumanConfirmed
          ? `Confirmed by a person: ${SERVICE_ROUTE_LABELS[route]} (AI suggested ${SERVICE_ROUTE_LABELS[suggestedRoute]})`
          : `AI suggestion: ${SERVICE_ROUTE_LABELS[route]} — not yet confirmed`
      }
    >
      {isHumanConfirmed ? (
        <UserCheck className="w-3.5 h-3.5 text-brand shrink-0" aria-hidden="true" />
      ) : (
        <Sparkles
          className={`w-3.5 h-3.5 shrink-0 ${needsReview ? 'text-amber-600' : 'text-stone-400'}`}
          aria-hidden="true"
        />
      )}
      <span>{SERVICE_ROUTE_LABELS[route]}</span>
      {showSourceLabel && !isHumanConfirmed && (
        <span className="text-stone-400 font-normal">· suggested</span>
      )}
    </span>
  );
}

export function PriorityBadge({
  score,
  label,
}: {
  score: number;
  label: PriorityLabel;
}) {
  const styles: Record<PriorityLabel, string> = {
    High: 'bg-brand text-white',
    Medium: 'bg-stone-100 text-stone-800',
    Low: 'bg-transparent text-stone-500 ring-1 ring-inset ring-stone-200',
  };

  return (
    <span
      className={`${TAG} ${styles[label]}`}
      title={`Priority score ${score} of 8 (${label})`}
    >
      <span>{label}</span>
      <span className="tabular-nums opacity-70">{score}/8</span>
    </span>
  );
}

export function QualificationStatusBadge({
  status,
  model,
}: {
  status: QualificationStatus;
  model?: string | null;
}) {
  if (status === 'completed') {
    return (
      <span className={`${TAG} bg-stone-100 text-stone-700`} title={model ?? undefined}>
        <CheckCircle2 className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
        AI qualified
      </span>
    );
  }
  if (status === 'mock_completed') {
    return (
      <span className={`${TAG} bg-stone-100 text-stone-700`}>
        <Bot className="w-3.5 h-3.5 text-stone-500" aria-hidden="true" />
        Rule-based qualifier
      </span>
    );
  }
  if (status === 'failed' || status === 'pending_retry') {
    return (
      <span className={`${TAG} bg-amber-50 text-amber-900`}>
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
        {status === 'pending_retry' ? 'AI unavailable — retry' : 'Sent to review'}
      </span>
    );
  }
  return <span className={`${TAG} bg-stone-100 text-stone-500`}>Qualifying…</span>;
}

/** Turns stored slugs like `public_inquiry_form` into "Public inquiry form". */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const text = value.replace(/[_-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}
