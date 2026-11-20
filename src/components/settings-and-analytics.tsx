'use client';

import React, { useState } from 'react';
import {
  CRMSettings,
  IntegrationRuntimeStatus,
  LeadRecord,
  OfferDefinition,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGES,
  SERVICE_ROUTE_LABELS,
  SERVICE_ROUTES,
} from '@/lib/schemas';
import { DashboardMetrics } from '@/lib/repository';
import { SAMPLE_MAKE_WEBHOOK_PAYLOAD } from '@/lib/make-webhook';
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  CheckCircle2,
  Copy,
  Database,
  Download,
  KeyRound,
  Lock,
  Palette,
  RefreshCw,
  Save,
  Server,
  Sliders,
  Webhook,
} from 'lucide-react';
import { client } from '@/config/client';
import { applyBrandAccent } from '@/lib/brand';

interface AnalyticsViewProps {
  metrics: DashboardMetrics;
  leads: LeadRecord[];
}

export function AnalyticsView({ metrics, leads }: AnalyticsViewProps) {
  const total = Math.max(1, leads.length);
  const highCount = leads.filter((l) => l.priority_label === 'High').length;
  const mediumCount = leads.filter((l) => l.priority_label === 'Medium').length;
  const lowCount = leads.filter((l) => l.priority_label === 'Low').length;
  const emailConsentCount = leads.filter((l) => l.marketing_email_consent).length;
  const pct = (n: number) => Math.round((n / total) * 100);
  const routes = SERVICE_ROUTES.filter(
    (r) => r === 'review' || client.enabledServices.includes(r as never)
  );

  const kpis = [
    {
      label: 'Qualification rate',
      value: metrics.qualification_rate_pct !== null ? `${metrics.qualification_rate_pct}%` : '—',
      meta: `${metrics.qualified_leads_count} of ${metrics.new_leads_in_period} inquiries`,
    },
    {
      label: 'Qualified → call booked',
      value: metrics.call_booking_rate_pct !== null ? `${metrics.call_booking_rate_pct}%` : '—',
      meta: `${metrics.calls_booked_count} of ${metrics.qualified_leads_count} qualified`,
    },
    {
      label: 'Win rate',
      value: metrics.win_rate_pct !== null ? `${metrics.win_rate_pct}%` : '—',
      meta: `${metrics.won_deals_count} won · ${metrics.lost_deals_count} lost`,
    },
    {
      label: 'Email opt-in',
      value: leads.length > 0 ? `${pct(emailConsentCount)}%` : '—',
      meta: `${emailConsentCount} of ${leads.length} leads`,
    },
  ];

  const tiers = [
    { label: 'High', range: '6–8', count: highCount, bar: 'bg-brand', hint: 'Ready now, offer matches, clear scope' },
    { label: 'Medium', range: '3–5', count: mediumCount, bar: 'bg-brand/45', hint: 'Good fit, longer timeline' },
    { label: 'Low', range: '0–2', count: lowCount, bar: 'bg-stone-300', hint: 'Exploring, vague or conflicting' },
  ];

  return (
    <div className="space-y-6">
      {metrics.is_demo_dataset && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50/70 border border-amber-200/70 px-4 py-2.5 text-sm text-amber-950">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
          Includes fictional demo leads — not real performance.
        </div>
      )}

      <section
        aria-label="Conversion"
        className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-stone-200 rounded-xl border border-stone-200 overflow-hidden"
      >
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white px-5 py-4">
            <p className="text-sm text-stone-500">{kpi.label}</p>
            <p className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums text-stone-900">
              {kpi.value}
            </p>
            <p className="mt-1 text-xs text-stone-500 tabular-nums">{kpi.meta}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="text-sm font-semibold text-stone-900">Inquiries by service</h2>
          <p className="mt-0.5 text-sm text-stone-500">Confirmed route, or the AI suggestion until confirmed.</p>
          <dl className="mt-5 space-y-3.5">
            {routes.map((route) => {
              const count = metrics.routes_breakdown[route] || 0;
              return (
                <div key={route}>
                  <div className="flex items-baseline justify-between text-sm">
                    <dt className="text-stone-700">{SERVICE_ROUTE_LABELS[route]}</dt>
                    <dd className="tabular-nums text-stone-900 font-medium">
                      {count}
                      <span className="ml-1.5 font-normal text-stone-400">{pct(count)}%</span>
                    </dd>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${route === 'review' ? 'bg-amber-400' : 'bg-brand'}`}
                      style={{ width: `${count > 0 ? Math.max(3, pct(count)) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </dl>
        </section>

        <section className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="text-sm font-semibold text-stone-900">Leads by stage</h2>
          <p className="mt-0.5 text-sm text-stone-500">Where every stored inquiry sits right now.</p>
          <dl className="mt-5 space-y-2">
            {PIPELINE_STAGES.map((stage) => {
              const count = metrics.pipeline_by_stage[stage] || 0;
              return (
                <div key={stage} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-sm">
                  <dt className="text-stone-700 truncate">{PIPELINE_STAGE_LABELS[stage]}</dt>
                  <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        stage === 'lost' ? 'bg-rose-400' : stage === 'needs_review' ? 'bg-amber-400' : 'bg-brand'
                      }`}
                      style={{ width: `${count > 0 ? Math.max(3, pct(count)) : 0}%` }}
                    />
                  </div>
                  <dd className={`text-right tabular-nums ${count ? 'text-stone-900' : 'text-stone-300'}`}>
                    {count}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      </div>

      <section className="bg-white rounded-xl border border-stone-200 p-5">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="text-sm font-semibold text-stone-900">Priority mix</h2>
          <p className="text-sm text-stone-500">Score out of 8 · weights are editable in Settings</p>
        </div>
        <div className="mt-4 flex h-2.5 rounded-full overflow-hidden bg-stone-100" aria-hidden="true">
          {tiers.map((t) =>
            t.count ? (
              <div
                key={t.label}
                className={`${t.bar} border-r-2 border-white last:border-r-0`}
                style={{ width: `${pct(t.count)}%` }}
              />
            ) : null
          )}
        </div>
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {tiers.map((t) => (
            <div key={t.label} className="flex items-start gap-2.5">
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${t.bar}`} aria-hidden="true" />
              <div>
                <dt className="text-sm text-stone-700">
                  {t.label} <span className="text-stone-400">({t.range})</span>
                </dt>
                <dd className="text-xl font-semibold tabular-nums text-stone-900">{t.count}</dd>
                <dd className="text-xs text-stone-500">{t.hint}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

interface SettingsViewProps {
  settings: CRMSettings;
  runtime: IntegrationRuntimeStatus;
  onSaved: (newSettings: CRMSettings) => void;
  onResetDemo: () => Promise<void>;
}

export function SettingsView({
  settings,
  runtime,
  onSaved,
  onResetDemo,
}: SettingsViewProps) {
  const [businessName, setBusinessName] = useState(settings.business_name);
  const [brandAccent, setBrandAccent] = useState(settings.brand_accent);
  const [brandTagline, setBrandTagline] = useState(settings.brand_tagline);
  const [defaultOwner, setDefaultOwner] = useState(settings.default_owner);
  const [bookingUrl, setBookingUrl] = useState(
    settings.booking_url_placeholder
  );
  const [retentionDays, setRetentionDays] = useState(
    settings.data_retention_days
  );
  const [offers, setOffers] = useState<OfferDefinition[]>(settings.offers);
  const [scoreRules, setScoreRules] = useState(settings.score_rules);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const handleOfferChange = (
    idx: number,
    field: keyof OfferDefinition,
    value: string | boolean
  ) => {
    setOffers((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName,
          brand_accent: brandAccent,
          brand_tagline: brandTagline,
          default_owner: defaultOwner,
          booking_url_placeholder: bookingUrl,
          data_retention_days: Number(retentionDays),
          offers,
          score_rules: {
            timing_now_points: Number(scoreRules.timing_now_points),
            timing_within_3_months_points: Number(
              scoreRules.timing_within_3_months_points
            ),
            service_match_points: Number(scoreRules.service_match_points),
            specific_challenge_points: Number(
              scoreRules.specific_challenge_points
            ),
            corporate_org_or_team_points: Number(
              scoreRules.corporate_org_or_team_points
            ),
            min_confidence_threshold: Number(
              scoreRules.min_confidence_threshold
            ),
          },
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        applyBrandAccent(json.data.settings.brand_accent);
        onSaved(json.data.settings);
        setFeedback({
          type: 'success',
          text: 'Saved branding, service route offers, and priority scoring rules. All leads have been re-evaluated against the updated rules.',
        });
      } else {
        setFeedback({
          type: 'error',
          text: json?.error?.message || 'Failed to save settings.',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleExportJson = async () => {
    const res = await fetch('/api/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'export' }),
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      const blob = new Blob([JSON.stringify(json.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-white text-stone-800 border-stone-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="ml-4 text-sm text-stone-500 hover:text-stone-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Rebranding, Offers & Deterministic Score Rules Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Business Branding & Booking URL */}
        <section className="bg-white rounded-xl border border-stone-200 p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Business</h2>
            <p className="text-sm text-stone-500 mt-0.5">
              Defaults come from this client&rsquo;s profile file
              (clients/{client.id}.ts). Changes here are saved to the database
              and override those defaults.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Business name
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full h-9 rounded-lg border border-stone-200 px-3 text-sm text-stone-900 hover:border-stone-300 focus:border-brand focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Brand colour
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandAccent}
                  onChange={(e) => setBrandAccent(e.target.value)}
                  className="h-9 w-10 rounded-lg border border-stone-200 p-1 cursor-pointer bg-white"
                />
                <input
                  type="text"
                  value={brandAccent}
                  onChange={(e) => setBrandAccent(e.target.value)}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="flex-1 h-9 rounded-lg border border-stone-200 px-3 text-sm tabular-nums uppercase text-stone-900 hover:border-stone-300 focus:border-brand focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Default lead owner
              </label>
              <input
                type="text"
                required
                value={defaultOwner}
                onChange={(e) => setDefaultOwner(e.target.value)}
                className="w-full h-9 rounded-lg border border-stone-200 px-3 text-sm text-stone-900 hover:border-stone-300 focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Tagline
              </label>
              <input
                type="text"
                required
                value={brandTagline}
                onChange={(e) => setBrandTagline(e.target.value)}
                className="w-full h-9 rounded-lg border border-stone-200 px-3 text-sm text-stone-900 hover:border-stone-300 focus:border-brand focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Booking link
              </label>
              <input
                type="url"
                required
                value={bookingUrl}
                onChange={(e) => setBookingUrl(e.target.value)}
                className="w-full h-9 rounded-lg border border-stone-200 px-3 text-sm text-stone-900 hover:border-stone-300 focus:border-brand focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Service Routes & Offer Definitions */}
        <section className="bg-white rounded-xl border border-stone-200 p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Services</h2>
            <p className="text-sm text-stone-500 mt-0.5">
              What leads can be routed to. The AI qualifier reads these descriptions.
            </p>
          </div>

          <div className="divide-y divide-stone-100 border-y border-stone-100 -mx-6">
            {offers.map((offer, idx) => (
              <div
                key={offer.route}
                className={`px-6 py-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end ${offer.active ? '' : 'opacity-60'}`}
              >
                <div className="md:col-span-3">
                  <span className="text-xs text-stone-500 block">
                    {offer.route === 'review' ? 'Fallback route' : 'Name'}
                  </span>
                  <input
                    type="text"
                    value={offer.label}
                    onChange={(e) =>
                      handleOfferChange(idx, 'label', e.target.value)
                    }
                    className="mt-1 w-full h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-stone-900 hover:border-stone-300 focus:border-brand focus:outline-none"
                  />
                </div>
                <div className="md:col-span-5">
                  <span className="text-xs text-stone-500 block">
                    Description
                  </span>
                  <input
                    type="text"
                    value={offer.description}
                    onChange={(e) =>
                      handleOfferChange(idx, 'description', e.target.value)
                    }
                    className="mt-1 w-full h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 hover:border-stone-300 focus:border-brand focus:outline-none"
                  />
                </div>
                <div className="md:col-span-3">
                  <span className="text-xs text-stone-500 block">
                    Who it&rsquo;s for
                  </span>
                  <input
                    type="text"
                    value={offer.typical_audience}
                    onChange={(e) =>
                      handleOfferChange(idx, 'typical_audience', e.target.value)
                    }
                    className="mt-1 w-full h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 hover:border-stone-300 focus:border-brand focus:outline-none"
                  />
                </div>
                <div className="md:col-span-1 flex items-center h-9">
                  <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={offer.active}
                      disabled={offer.route === 'review'}
                      onChange={(e) =>
                        handleOfferChange(idx, 'active', e.target.checked)
                      }
                    />
                    <span>On</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Deterministic Priority Score Rules */}
        <section className="bg-white rounded-xl border border-stone-200 p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Priority scoring</h2>
            <p className="text-sm text-stone-500 mt-0.5">
              Points add up to a score out of 8 (0–2 low, 3–5 medium, 6–8 high). Calculated
              from the form answers, never by the AI.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-5">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Wants to start now
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={scoreRules.timing_now_points}
                onChange={(e) =>
                  setScoreRules({
                    ...scoreRules,
                    timing_now_points: Number(e.target.value),
                  })
                }
                className="w-full h-9 rounded-lg border border-stone-200 px-3 text-sm tabular-nums hover:border-stone-300 focus:border-brand focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Starting within 3 months
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={scoreRules.timing_within_3_months_points}
                onChange={(e) =>
                  setScoreRules({
                    ...scoreRules,
                    timing_within_3_months_points: Number(e.target.value),
                  })
                }
                className="w-full h-9 rounded-lg border border-stone-200 px-3 text-sm tabular-nums hover:border-stone-300 focus:border-brand focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Asked for an active service
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={scoreRules.service_match_points}
                onChange={(e) =>
                  setScoreRules({
                    ...scoreRules,
                    service_match_points: Number(e.target.value),
                  })
                }
                className="w-full h-9 rounded-lg border border-stone-200 px-3 text-sm tabular-nums hover:border-stone-300 focus:border-brand focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Wrote a specific request
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={scoreRules.specific_challenge_points}
                onChange={(e) =>
                  setScoreRules({
                    ...scoreRules,
                    specific_challenge_points: Number(e.target.value),
                  })
                }
                className="w-full h-9 rounded-lg border border-stone-200 px-3 text-sm tabular-nums hover:border-stone-300 focus:border-brand focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Team request with org or team size
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={scoreRules.corporate_org_or_team_points}
                onChange={(e) =>
                  setScoreRules({
                    ...scoreRules,
                    corporate_org_or_team_points: Number(e.target.value),
                  })
                }
                className="w-full h-9 rounded-lg border border-stone-200 px-3 text-sm tabular-nums hover:border-stone-300 focus:border-brand focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Send to review below AI confidence
              </label>
              <input
                type="number"
                step="0.05"
                min={0.1}
                max={0.95}
                value={scoreRules.min_confidence_threshold}
                onChange={(e) =>
                  setScoreRules({
                    ...scoreRules,
                    min_confidence_threshold: Number(e.target.value),
                  })
                }
                className="w-full h-9 rounded-lg border border-stone-200 px-3 text-sm tabular-nums hover:border-stone-300 focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap pt-5 border-t border-stone-100">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-stone-700">
                Keep data for (days)
              </label>
              <input
                type="number"
                min={30}
                max={3650}
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-24 h-9 rounded-lg border border-stone-200 px-3 text-sm tabular-nums hover:border-stone-300 focus:border-brand focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover disabled:opacity-50"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </section>
      </form>

      {/* Integrations status (read-only; secrets never reach the browser) */}
      <section className="bg-white rounded-xl border border-stone-200">
        <div className="px-6 pt-5 pb-4">
          <h2 className="text-sm font-semibold text-stone-900">Connections</h2>
          <p className="mt-0.5 text-sm text-stone-500">
            Set on the server. Keys stay there and are never shown here.
          </p>
        </div>
        <ul className="divide-y divide-stone-100 border-t border-stone-100">
          {[
            {
              name: 'Database',
              on: runtime.storage_mode === 'postgres',
              status:
                runtime.storage_mode === 'postgres'
                  ? 'Postgres connected'
                  : runtime.storage_mode === 'local_file'
                    ? 'Local file — demo only'
                    : 'Not configured',
              hint: 'DATABASE_URL',
            },
            {
              name: 'AI qualifier',
              on: runtime.openrouter_configured,
              status: runtime.openrouter_configured
                ? `OpenRouter · ${runtime.openrouter_model}`
                : 'Rule-based (no API key)',
              hint: 'OPENROUTER_API_KEY',
            },
            {
              name: 'Email sending',
              on: runtime.email_configured,
              status: runtime.email_configured
                ? `Sending via ${runtime.email_provider}`
                : 'Drafts only',
              hint: 'EMAIL_PROVIDER, EMAIL_API_KEY',
            },
            {
              name: 'Make.com webhooks',
              on: runtime.make_webhook_enabled,
              status: runtime.make_webhook_enabled ? 'Enabled' : 'Off',
              hint: 'MAKE_WEBHOOK_ENABLED, MAKE_WEBHOOK_SECRET',
            },
          ].map((row) => (
            <li key={row.name} className="px-6 py-3 flex items-center gap-4 text-sm">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${row.on ? 'bg-brand' : 'bg-stone-300'}`}
                aria-hidden="true"
              />
              <span className="w-40 shrink-0 font-medium text-stone-800">{row.name}</span>
              <span className="flex-1 text-stone-600">{row.status}</span>
              <code className="hidden md:block text-xs text-stone-400 font-mono">{row.hint}</code>
            </li>
          ))}
        </ul>
      </section>

      {/* Developer reference */}
      <details className="group bg-white rounded-xl border border-stone-200">
        <summary className="px-6 py-4 flex items-center justify-between gap-3 cursor-pointer list-none">
          <span>
            <span className="block text-sm font-semibold text-stone-900">Make.com webhook payload</span>
            <span className="block mt-0.5 text-sm text-stone-500">
              For whoever builds the automation. Events are signed with HMAC-SHA256.
            </span>
          </span>
          <ChevronDown className="w-4 h-4 text-stone-400 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="px-6 pb-6 space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(SAMPLE_MAKE_WEBHOOK_PAYLOAD, null, 2));
                setCopiedWebhook(true);
                setTimeout(() => setCopiedWebhook(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              {copiedWebhook ? (
                <>
                  <Check className="w-4 h-4 text-brand" aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" aria-hidden="true" />
                  Copy JSON
                </>
              )}
            </button>
          </div>
          <pre className="rounded-lg bg-stone-900 text-stone-100 p-4 text-xs font-mono overflow-x-auto leading-relaxed">
            {JSON.stringify(SAMPLE_MAKE_WEBHOOK_PAYLOAD, null, 2)}
          </pre>
        </div>
      </details>

      {/* 4. Data Export & Demo Reset Controls */}
      <section className="bg-white rounded-xl border border-stone-200 p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Your data</h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Download every lead, note, task and activity as a JSON file.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-stone-200 bg-white text-sm font-medium text-stone-800 hover:border-stone-300"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Export
          </button>
          {runtime.demo_tools_enabled && (
            <button
              type="button"
              onClick={onResetDemo}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Reset demo data
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
