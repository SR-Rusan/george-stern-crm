'use client';

import React, { useState } from 'react';
import {
  LOSS_REASONS,
  LossReason,
  PIPELINE_STAGE_LABELS,
  PipelineStage,
} from '@/lib/schemas';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface StageTransitionModalProps {
  leadName: string;
  currentStage: PipelineStage;
  targetStage: PipelineStage;
  currentEstimatedValue: number | null;
  onCancel: () => void;
  onConfirm: (params: {
    targetStage: PipelineStage;
    lostReason?: LossReason | null;
    estimatedValue?: number | null;
    confirmed: true;
  }) => Promise<void>;
}

export function StageTransitionModal({
  leadName,
  currentStage,
  targetStage,
  currentEstimatedValue,
  onCancel,
  onConfirm,
}: StageTransitionModalProps) {
  const [lostReason, setLostReason] = useState<LossReason>('Timing');
  const [estimatedValueStr, setEstimatedValueStr] = useState<string>(
    currentEstimatedValue !== null && currentEstimatedValue !== undefined
      ? String(currentEstimatedValue)
      : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (targetStage === 'lost' && !lostReason) {
      setError('Please select a loss reason.');
      return;
    }

    let parsedValue: number | null | undefined = undefined;
    if (targetStage === 'won') {
      if (estimatedValueStr.trim() === '') {
        parsedValue = null;
      } else {
        const num = Number(estimatedValueStr);
        if (Number.isNaN(num) || num < 0) {
          setError('Deal value must be a valid positive number or left blank.');
          return;
        }
        parsedValue = num;
      }
    }

    setSubmitting(true);
    try {
      await onConfirm({
        targetStage,
        lostReason: targetStage === 'lost' ? lostReason : null,
        estimatedValue: parsedValue,
        confirmed: true,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update pipeline stage.'
      );
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stage-confirm-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white border border-stone-200 shadow-2xl shadow-stone-900/15 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-canvas">
          <div className="flex items-center gap-2.5">
            {targetStage === 'won' ? (
              <CheckCircle2 className="w-5 h-5 text-brand" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            )}
            <h3
              id="stage-confirm-title"
              className="text-base font-semibold text-stone-900"
            >
              Move to {PIPELINE_STAGE_LABELS[targetStage]}?
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-md text-stone-500 hover:text-stone-800 hover:bg-stone-200/60"
            aria-label="Close confirmation dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-stone-700 leading-relaxed">
            You are moving{' '}
            <span className="font-semibold text-stone-900">{leadName}</span> from{' '}
            <span className="font-medium">
              {PIPELINE_STAGE_LABELS[currentStage]}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-stone-900">
              {PIPELINE_STAGE_LABELS[targetStage]}
            </span>
            . Outcome stages require explicit human confirmation and are logged
            in the audit timeline.
          </p>

          {targetStage === 'lost' && (
            <div>
              <label
                htmlFor="lost-reason-select"
                className="block text-sm font-medium text-stone-700 mb-1.5"
              >
                Why was it lost?
              </label>
              <select
                id="lost-reason-select"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value as LossReason)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                required
              >
                {LOSS_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetStage === 'won' && (
            <div>
              <label
                htmlFor="won-deal-value"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                Recorded Deal Value in USD (Optional — Never Assumed)
              </label>
              <input
                id="won-deal-value"
                type="number"
                min="0"
                step="100"
                placeholder="Leave blank if no contract value is recorded"
                value={estimatedValueStr}
                onChange={(e) => setEstimatedValueStr(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
              />
              <p className="mt-1 text-xs text-stone-500">
                Dashboard Won Revenue only counts deals where a value is
                explicitly entered by a human operator.
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-800"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-3.5 py-2 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-hover disabled:opacity-50"
            >
              {submitting
                ? 'Saving...'
                : `Confirm ${PIPELINE_STAGE_LABELS[targetStage]}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
