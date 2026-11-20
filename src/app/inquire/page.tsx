'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CRMSettings,
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
import {
  ArrowLeft,
  CheckCircle2,
  Compass,
  Info,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { client } from '@/config/client';
import { applyBrandAccent } from '@/lib/brand';

export default function PublicInquiryPage() {
  const [settings, setSettings] = useState<Pick<
    CRMSettings,
    'business_name' | 'brand_accent' | 'brand_tagline'
  > | null>(null);
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [roleType, setRoleType] = useState<RoleType>('manager');
  const [teamSizeRange, setTeamSizeRange] = useState<TeamSizeRange | ''>('');
  const [requestedService, setRequestedService] =
    useState<RequestedService>(FORM_REQUESTED_SERVICES[0]);
  const [challenge, setChallenge] = useState('');
  const [timing, setTiming] = useState<TimingOption>('within_3_months');
  const [referrer, setReferrer] = useState('');
  const [consentResponse, setConsentResponse] = useState(false);
  // Marketing/follow-up email consent MUST NOT be preselected
  const [marketingEmailConsent, setMarketingEmailConsent] = useState(false);
  // Honeypot field
  const [websiteUrlHp, setWebsiteUrlHp] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldIssues, setFieldIssues] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<{
    reference_code: string;
    submitted_at: string;
    message: string;
    duplicate_prevented?: boolean;
  } | null>(null);

  useEffect(() => {
    fetch('/api/public/branding')
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && json.data) {
          setSettings(json.data);
          setPrivacyPolicyUrl(json.data.privacy_policy_url || null);
          setDemoMode(Boolean(json.data.demo_tools_enabled));
          applyBrandAccent(json.data.brand_accent);
        }
      })
      .catch(() => {});
  }, []);

  const businessName = settings?.business_name || client.business.name;

  const fillSampleVisitor = (preset: '1on1' | 'team' | 'speaking') => {
    setErrorMessage(null);
    setFieldIssues({});
    if (preset === '1on1') {
      setName('Devon Sterling');
      setEmail('devon.sterling@vanguard-fictional.example.com');
      setOrganization('Vanguard Analytics');
      setRoleType('manager');
      setTeamSizeRange('6-15');
      setRequestedService('one_to_one_coaching');
      setTiming('now');
      setChallenge(
        'Stepping into a Director of Product role managing 11 product managers and team leads. Looking for individualized 1:1 coaching on executive presence, cross-org prioritization, and coaching managers of managers.'
      );
      setReferrer('LinkedIn leadership post');
      setConsentResponse(true);
      setMarketingEmailConsent(true);
    } else if (preset === 'team') {
      setName('Sonia Patel');
      setEmail('sonia.patel@crestline-bio-demo.example.com');
      setOrganization('Crestline Biopharma');
      setRoleType('hr_ld');
      setTeamSizeRange('16-50');
      setRequestedService('corporate_training');
      setTiming('within_3_months');
      setChallenge(
        'Seeking a practical leadership training program for 24 newly promoted lab and clinical operations managers focused on feedback, delegation, and leading cross-functional teams.'
      );
      setReferrer('Referral from HR peer');
      setConsentResponse(true);
      setMarketingEmailConsent(true);
    } else {
      setName('Lucas Meyer');
      setEmail('lucas.meyer@global-eng-forum.example.com');
      setOrganization('Global Engineering Leadership Summit');
      setRoleType('other');
      setTeamSizeRange('200+');
      setRequestedService('speaking');
      setTiming('within_3_months');
      setChallenge(
        'Organizing our annual engineering leadership conference in November for 300 VPs and Directors. Inquiring about keynote speaker availability on building high-accountability engineering cultures.'
      );
      setReferrer('Conference committee');
      setConsentResponse(true);
      setMarketingEmailConsent(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setErrorMessage(null);
    setFieldIssues({});

    // Client-side validation checks
    const issues: Record<string, string> = {};
    if (name.trim().length < 2) {
      issues.name = 'Please enter your name.';
    }
    if (!email.trim().includes('@')) {
      issues.email = 'Please enter a valid work email address.';
    }
    if (challenge.trim().length < 15) {
      issues.challenge =
        `Please share at least a brief sentence (15+ characters) describing your ${client.terms.challenge.toLowerCase()}.`;
    }
    if (challenge.length > 1000) {
      issues.challenge = 'Please keep your description under 1,000 characters.';
    }
    if (!consentResponse) {
      issues.consent_response =
        'Please acknowledge that submitting this form requests a response from our team.';
    }

    if (Object.keys(issues).length > 0) {
      setFieldIssues(issues);
      setErrorMessage('Please review the highlighted fields before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          organization,
          role_type: roleType,
          team_size_range: teamSizeRange,
          requested_service: requestedService,
          challenge,
          timing,
          source: 'public_inquiry_form',
          referrer,
          consent_response: consentResponse,
          marketing_email_consent: marketingEmailConsent,
          website_url_hp: websiteUrlHp,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        const serverIssues: Record<string, string> = {};
        if (Array.isArray(json?.error?.issues)) {
          for (const item of json.error.issues) {
            if (item.path) serverIssues[item.path] = item.message;
          }
        }
        setFieldIssues(serverIssues);
        setErrorMessage(
          json?.error?.message ||
            'We could not submit your inquiry. Please check the form and try again.'
        );
        setSubmitting(false);
        return;
      }

      setConfirmation(json.data);
      setSubmitting(false);
    } catch {
      setErrorMessage('Network error while submitting your inquiry. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-stone-900 flex flex-col">
      {/* Prototype Top Notice (demo installs only) */}
      {demoMode && (
      <div className="bg-amber-50/70 text-amber-950 text-sm px-4 py-2.5 border-b border-amber-200/70">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            <span>Demo mode — submissions go to the local demo CRM. No one is emailed.</span>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-950 hover:text-brand"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to the CRM
          </Link>
        </div>
      </div>
      )}

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10 sm:py-14">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-brand mb-2">
            <Compass className="w-4 h-4" />
            <span>{businessName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900">
            {client.form.title}
          </h1>
          <p className="text-sm text-stone-600 mt-2 max-w-2xl leading-relaxed">
            {client.form.intro}
          </p>

          {/* Quick Demo Prefill Bar for Evaluators (demo installs only) */}
          {demoMode && !confirmation && (
            <div className="mt-4 rounded-xl bg-white border border-stone-200 p-3 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-medium text-stone-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                Fill with a sample:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fillSampleVisitor('1on1')}
                  className="px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-xs font-medium text-stone-800"
                >
                  1:1 Coaching (Now)
                </button>
                <button
                  type="button"
                  onClick={() => fillSampleVisitor('team')}
                  className="px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-xs font-medium text-stone-800"
                >
                  Corporate training (24 managers)
                </button>
                <button
                  type="button"
                  onClick={() => fillSampleVisitor('speaking')}
                  className="px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-xs font-medium text-stone-800"
                >
                  Keynote Speaking
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Calm Confirmation View */}
        {confirmation ? (
          <div
            role="status"
            aria-live="polite"
            className="bg-white rounded-2xl border border-stone-200 p-8 space-y-5"
          >
            <div className="w-11 h-11 rounded-full bg-stone-50 border border-stone-200 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-brand" />
            </div>

            <div className="space-y-2">
              <span className="text-xs tabular-nums text-stone-500">
                Reference {confirmation.reference_code}
              </span>
              <h2 className="text-xl font-semibold text-stone-900">
                Thank you — your inquiry has been received
              </h2>
              <p className="text-sm text-stone-700 leading-relaxed">
                {confirmation.message}
              </p>
              <p className="text-xs text-stone-500">
                Please note: submitting this inquiry form does not automatically
                book a calendar slot or guarantee program placement. Our team
                reviews each inquiry personally before suggesting next steps.
              </p>
            </div>

            <div className="pt-4 border-t border-stone-200 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setConfirmation(null);
                  setName('');
                  setEmail('');
                  setOrganization('');
                  setChallenge('');
                  setReferrer('');
                  setConsentResponse(false);
                  setMarketingEmailConsent(false);
                }}
                className="px-4 py-2 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                Submit another inquiry
              </button>

              {demoMode && (
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-hover"
                >
                  See this lead in the CRM →
                </Link>
              )}
            </div>
          </div>
        ) : (
          /* Public Inquiry Form */
          <form
            onSubmit={handleSubmit}
            noValidate
            className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 space-y-6"
          >
            {/* Visually hidden honeypot field for spam defense */}
            <div className="visually-hidden" aria-hidden="true">
              <label htmlFor="website_url_hp">
                Company Website (Leave blank)
              </label>
              <input
                id="website_url_hp"
                name="website_url_hp"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={websiteUrlHp}
                onChange={(e) => setWebsiteUrlHp(e.target.value)}
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-900 font-medium"
              >
                {errorMessage}
              </div>
            )}

            {/* Contact Identity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="inq-name"
                  className="block text-sm font-medium text-stone-700 mb-1.5"
                >
                  Full name <span className="text-rose-600">*</span>
                </label>
                <input
                  id="inq-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={120}
                  aria-invalid={Boolean(fieldIssues.name)}
                  placeholder="Alex Rivera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400"
                />
                {fieldIssues.name && (
                  <p className="mt-1 text-xs text-rose-700">
                    {fieldIssues.name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="inq-email"
                  className="block text-sm font-medium text-stone-700 mb-1.5"
                >
                  Work email <span className="text-rose-600">*</span>
                </label>
                <input
                  id="inq-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  aria-invalid={Boolean(fieldIssues.email)}
                  placeholder="alex.rivera@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400"
                />
                {fieldIssues.email && (
                  <p className="mt-1 text-xs text-rose-700">
                    {fieldIssues.email}
                  </p>
                )}
              </div>
            </div>

            {/* Organization, Role, Team Size Range */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label
                  htmlFor="inq-organization"
                  className="block text-sm font-medium text-stone-700 mb-1.5"
                >
                  {client.form.organizationLabel}{' '}
                  <span className="text-stone-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="inq-organization"
                  name="organization"
                  type="text"
                  autoComplete="organization"
                  maxLength={140}
                  placeholder={client.form.organizationPlaceholder}
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400"
                />
              </div>

              <div>
                <label
                  htmlFor="inq-role"
                  className="block text-sm font-medium text-stone-700 mb-1.5"
                >
                  Your role <span className="text-rose-600">*</span>
                </label>
                <select
                  id="inq-role"
                  name="role_type"
                  value={roleType}
                  onChange={(e) => setRoleType(e.target.value as RoleType)}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900"
                >
                  {ROLE_TYPES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_TYPE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="inq-team-size"
                  className="block text-sm font-medium text-stone-700 mb-1.5"
                >
                  {client.form.teamSizeLabel}{' '}
                  <span className="text-stone-400 font-normal">(Optional)</span>
                </label>
                <select
                  id="inq-team-size"
                  name="team_size_range"
                  value={teamSizeRange}
                  onChange={(e) =>
                    setTeamSizeRange(e.target.value as TeamSizeRange | '')
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900"
                >
                  <option value="">Select range (optional)</option>
                  {TEAM_SIZE_RANGES.map((range) => (
                    <option key={range} value={range}>
                      {range} {client.form.teamSizeUnit}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Help Looking For & Desired Timing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="inq-service"
                  className="block text-sm font-medium text-stone-700 mb-1.5"
                >
                  {client.form.serviceQuestion}{' '}
                  <span className="text-rose-600">*</span>
                </label>
                <select
                  id="inq-service"
                  name="requested_service"
                  value={requestedService}
                  onChange={(e) =>
                    setRequestedService(e.target.value as RequestedService)
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900"
                >
                  {FORM_REQUESTED_SERVICES.map((svc) => (
                    <option key={svc} value={svc}>
                      {REQUESTED_SERVICE_LABELS[svc]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="inq-timing"
                  className="block text-sm font-medium text-stone-700 mb-1.5"
                >
                  Timing <span className="text-rose-600">*</span>
                </label>
                <select
                  id="inq-timing"
                  name="timing"
                  value={timing}
                  onChange={(e) => setTiming(e.target.value as TimingOption)}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900"
                >
                  {TIMING_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {TIMING_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Main challenge / goal */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="inq-challenge"
                  className="block text-sm font-medium text-stone-700"
                >
                  {client.form.challengeLabel}{' '}
                  <span className="text-rose-600">*</span>
                </label>
                <span
                  className={`text-xs tabular-nums ${
                    challenge.length > 950 ? 'text-amber-700' : 'text-stone-500'
                  }`}
                >
                  {challenge.length} / 1,000 characters
                </span>
              </div>
              <textarea
                id="inq-challenge"
                name="challenge"
                rows={4}
                required
                minLength={15}
                maxLength={1000}
                aria-invalid={Boolean(fieldIssues.challenge)}
                placeholder={client.form.challengePlaceholder}
                value={challenge}
                onChange={(e) => setChallenge(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 leading-relaxed"
              />
              {fieldIssues.challenge && (
                <p className="mt-1 text-xs text-rose-700">
                  {fieldIssues.challenge}
                </p>
              )}
            </div>

            {/* Optional Referrer */}
            <div>
              <label
                htmlFor="inq-referrer"
                className="block text-sm font-medium text-stone-700 mb-1.5"
              >
                How did you hear about {businessName}?{' '}
                <span className="text-stone-400 font-normal">(Optional)</span>
              </label>
              <input
                id="inq-referrer"
                name="referrer"
                type="text"
                maxLength={160}
                placeholder={client.form.referralPlaceholder}
                value={referrer}
                onChange={(e) => setReferrer(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3.5 py-2 text-sm text-stone-900 placeholder:text-stone-400"
              />
            </div>

            {/* Separated Consent Checkboxes */}
            <div className="rounded-xl bg-canvas border border-stone-200 p-4 space-y-3.5">
              <div className="flex items-start gap-3">
                <input
                  id="inq-consent-response"
                  name="consent_response"
                  type="checkbox"
                  required
                  checked={consentResponse}
                  onChange={(e) => setConsentResponse(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-stone-300"
                />
                <label
                  htmlFor="inq-consent-response"
                  className="text-xs text-stone-800 leading-relaxed cursor-pointer"
                >
                  <strong className="text-stone-900">
                    Inquiry Response Acknowledgement (Required):
                  </strong>{' '}
                  I understand that submitting this form requests a review of my
                  inquiry by {businessName}, and that submitting this form does
                  not automatically schedule a call.
                </label>
              </div>
              {fieldIssues.consent_response && (
                <p className="text-xs text-rose-700 pl-7">
                  {fieldIssues.consent_response}
                </p>
              )}

              <div className="flex items-start gap-3 pt-2 border-t border-stone-200/80">
                <input
                  id="inq-consent-email"
                  name="marketing_email_consent"
                  type="checkbox"
                  checked={marketingEmailConsent}
                  onChange={(e) => setMarketingEmailConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-stone-300"
                />
                <label
                  htmlFor="inq-consent-email"
                  className="text-xs text-stone-700 leading-relaxed cursor-pointer"
                >
                  <strong className="text-stone-900">
                    Follow-Up Email Consent (Optional):
                  </strong>{' '}
                  I consent to receive follow-up emails from {businessName}{' '}
                  regarding my inquiry and relevant program information. You can
                  withdraw this consent at any time.
                </label>
              </div>
            </div>

            {/* Privacy Notice — link the business's own policy via PRIVACY_POLICY_URL */}
            <div className="rounded-lg bg-stone-100/80 border border-stone-200 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-stone-600">
              <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
              <div>
                <strong>Privacy:</strong> Information submitted in this form is
                used to evaluate and respond to your inquiry. Please do not
                submit confidential personnel records or sensitive personal
                data.
                {privacyPolicyUrl && (
                  <>
                    {' '}
                    <a
                      href={privacyPolicyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 text-stone-800"
                    >
                      Read our privacy policy
                    </a>
                    .
                  </>
                )}
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <ShieldCheck className="w-4 h-4 text-brand" />
                <span>Human-reviewed intake</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-hover disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Send inquiry'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
