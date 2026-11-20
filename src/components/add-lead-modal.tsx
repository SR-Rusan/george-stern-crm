'use client';

import React, { useState } from 'react';
import {
  FORM_REQUESTED_SERVICES,
  REQUESTED_SERVICE_LABELS,
  RequestedService,
  ROLE_TYPE_LABELS,
  ROLE_TYPES,
  RoleType,
  TEAM_SIZE_RANGES,
  TeamSizeRange,
  TIMING_LABELS,
  TIMING_OPTIONS,
  TimingOption,
} from '@/lib/schemas';
import { X, UserPlus } from 'lucide-react';
import { client } from '@/config/client';

interface AddLeadModalProps {
  onClose: () => void;
  onCreated: (leadId: string) => void;
}

export function AddLeadModal({ onClose, onCreated }: AddLeadModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [roleType, setRoleType] = useState<RoleType>('manager');
  const [teamSizeRange, setTeamSizeRange] = useState<TeamSizeRange | ''>('6-15');
  const [requestedService, setRequestedService] = useState<RequestedService>(
    FORM_REQUESTED_SERVICES[0]
  );
  const [timing, setTiming] = useState<TimingOption>('now');
  const [challenge, setChallenge] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [isDemo, setIsDemo] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          organization,
          role_type: roleType,
          team_size_range: teamSizeRange,
          requested_service: requestedService,
          timing,
          challenge,
          marketing_email_consent: marketingConsent,
          consent_response: true,
          source: 'crm_manual_entry',
          is_demo: isDemo,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message || 'Could not create lead.');
        setSubmitting(false);
        return;
      }

      onCreated(json.data.lead.id);
    } catch {
      setError('Network error while creating lead.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-lead-modal-title"
    >
      <div className="w-full max-w-xl rounded-xl bg-white border border-stone-200 shadow-2xl shadow-stone-900/15 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-canvas">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-brand" />
            <h3
              id="add-lead-modal-title"
              className="text-base font-semibold text-stone-900"
            >
              Add a lead
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-stone-500 hover:text-stone-800 hover:bg-stone-200/60"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-5 space-y-4 overflow-y-auto"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="manual-lead-name"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Full name *
              </label>
              <input
                id="manual-lead-name"
                type="text"
                required
                minLength={2}
                maxLength={120}
                placeholder="Jordan Vance"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
              />
            </div>

            <div>
              <label
                htmlFor="manual-lead-email"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Work email *
              </label>
              <input
                id="manual-lead-email"
                type="email"
                required
                placeholder="jordan.vance@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label
                htmlFor="manual-lead-org"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Organization
              </label>
              <input
                id="manual-lead-org"
                type="text"
                maxLength={140}
                placeholder="Optional company"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
              />
            </div>

            <div>
              <label
                htmlFor="manual-lead-role"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Role *
              </label>
              <select
                id="manual-lead-role"
                value={roleType}
                onChange={(e) => setRoleType(e.target.value as RoleType)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
              >
                {ROLE_TYPES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_TYPE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="manual-lead-team"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Team size
              </label>
              <select
                id="manual-lead-team"
                value={teamSizeRange}
                onChange={(e) =>
                  setTeamSizeRange(e.target.value as TeamSizeRange | '')
                }
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
              >
                <option value="">Not specified</option>
                {TEAM_SIZE_RANGES.map((t) => (
                  <option key={t} value={t}>
                    {t} people
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="manual-lead-service"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Service *
              </label>
              <select
                id="manual-lead-service"
                value={requestedService}
                onChange={(e) =>
                  setRequestedService(e.target.value as RequestedService)
                }
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
              >
                {FORM_REQUESTED_SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {REQUESTED_SERVICE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="manual-lead-timing"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Timing *
              </label>
              <select
                id="manual-lead-timing"
                value={timing}
                onChange={(e) => setTiming(e.target.value as TimingOption)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
              >
                {TIMING_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {TIMING_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="manual-lead-challenge"
                className="block text-xs font-semibold text-stone-700"
              >
                {client.terms.challenge} *
              </label>
              <span className="text-xs text-stone-500">
                {challenge.length} / 1000
              </span>
            </div>
            <textarea
              id="manual-lead-challenge"
              rows={3}
              required
              minLength={15}
              maxLength={1000}
              placeholder={client.form.challengePlaceholder}
              value={challenge}
              onChange={(e) => setChallenge(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
            />
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-start gap-2.5 text-xs text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-0.5 rounded border-stone-300"
              />
              <span>
                Contact granted explicit consent to receive follow-up emails
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-xs text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isDemo}
                onChange={(e) => setIsDemo(e.target.checked)}
                className="mt-0.5 rounded border-stone-300"
              />
              <span>
                Mark as demo (never emailed)
              </span>
            </label>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-800"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-hover disabled:opacity-50"
            >
              {submitting ? 'Adding…' : 'Add lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
