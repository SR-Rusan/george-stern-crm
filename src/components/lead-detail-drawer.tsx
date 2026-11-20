'use client';

import React, { useEffect, useState } from 'react';
import {
  ActivityRecord,
  CRMSettings,
  LeadRecord,
  LossReason,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGES,
  PipelineStage,
  REQUESTED_SERVICE_LABELS,
  ROLE_TYPE_LABELS,
  SERVICE_ROUTE_LABELS,
  SERVICE_ROUTES,
  ServiceRoute,
  TaskRecord,
  TIMING_LABELS,
} from '@/lib/schemas';
import {
  formatDateTime,
  formatShortDate,
  PriorityBadge,
  QualificationStatusBadge,
  RouteBadge,
  StageBadge,
  humanize,
} from './badges';
import { StageTransitionModal } from './stage-transition-modal';
import {
  AlertCircle,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  ListTodo,
  Lock,
  Mail,
  MessageSquarePlus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { client } from '@/config/client';
import { EmailDraftResult } from '@/lib/email-adapter';

interface LeadDetailDrawerProps {
  leadId: string;
  settings: CRMSettings;
  onClose: () => void;
  onUpdated: () => void;
}

export function LeadDetailDrawer({
  leadId,
  settings,
  onClose,
  onUpdated,
}: LeadDetailDrawerProps) {
  const [lead, setLead] = useState<LeadRecord | null>(null);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBanner, setActionBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editOrg, setEditOrg] = useState('');
  const [editOwner, setEditOwner] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editChallenge, setEditChallenge] = useState('');

  // Follow-up scheduling state
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [nextActionInput, setNextActionInput] = useState('');
  const [followUpDateInput, setFollowUpDateInput] = useState('');

  // Note state
  const [noteInput, setNoteInput] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Task creation state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  // Qualification re-run state
  const [rerunningQual, setRerunningQual] = useState(false);

  // Stage transition modal state
  const [pendingOutcomeStage, setPendingOutcomeStage] =
    useState<PipelineStage | null>(null);

  // Email draft & send state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [emailDraft, setEmailDraft] = useState<EmailDraftResult | null>(null);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [humanSendConfirmed, setHumanSendConfirmed] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [copiedBooking, setCopiedBooking] = useState(false);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      const json = await res.json();
      if (res.ok && json.ok) {
        const l: LeadRecord = json.data.lead;
        setLead(l);
        setActivities(json.data.activities || []);
        setTasks(json.data.tasks || []);

        setEditName(l.name);
        setEditEmail(l.email);
        setEditOrg(l.organization || '');
        setEditOwner(l.owner_label);
        setEditValue(
          l.estimated_value !== null && l.estimated_value !== undefined
            ? String(l.estimated_value)
            : ''
        );
        setEditChallenge(l.challenge);
        setNextActionInput(l.next_action || '');
        setFollowUpDateInput(
          l.follow_up_at ? l.follow_up_at.slice(0, 16) : ''
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDetails();
  }, [leadId]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setActionBanner({ type, message });
    setTimeout(() => {
      setActionBanner((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const handleStageSelect = async (newStage: PipelineStage) => {
    if (!lead || newStage === lead.pipeline_stage) return;

    if (
      newStage === 'won' ||
      newStage === 'lost' ||
      newStage === 'not_a_fit'
    ) {
      setPendingOutcomeStage(newStage);
      return;
    }

    const res = await fetch(`/api/leads/${lead.id}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pipeline_stage: newStage,
        confirmed: true,
        actor_label: lead.owner_label || settings.default_owner,
      }),
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      setLead(json.data.lead);
      setActivities(json.data.activities);
      onUpdated();
      showFeedback(
        'success',
        `Moved stage to ${PIPELINE_STAGE_LABELS[newStage]}.`
      );
    } else {
      showFeedback('error', json?.error?.message || 'Failed to update stage.');
    }
  };

  const handleConfirmOutcomeStage = async (params: {
    targetStage: PipelineStage;
    lostReason?: LossReason | null;
    estimatedValue?: number | null;
    confirmed: true;
  }) => {
    if (!lead) return;
    const res = await fetch(`/api/leads/${lead.id}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pipeline_stage: params.targetStage,
        lost_reason: params.lostReason,
        estimated_value: params.estimatedValue,
        confirmed: true,
        actor_label: lead.owner_label || settings.default_owner,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error(json?.error?.message || 'Could not update stage.');
    }
    setPendingOutcomeStage(null);
    setLead(json.data.lead);
    setActivities(json.data.activities);
    onUpdated();
    showFeedback(
      'success',
      `Confirmed stage change to ${PIPELINE_STAGE_LABELS[params.targetStage]}.`
    );
  };

  const handleRouteSelect = async (val: string) => {
    if (!lead) return;
    const selectedRoute = val === '' ? null : (val as ServiceRoute);
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selected_route: selectedRoute,
        reviewed_by_human: true,
        actor_label: lead.owner_label || settings.default_owner,
      }),
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      setLead(json.data.lead);
      setActivities(json.data.activities);
      onUpdated();
      showFeedback(
        'success',
        selectedRoute
          ? `Confirmed human service route: ${SERVICE_ROUTE_LABELS[selectedRoute]}.`
          : 'Reverted route to AI suggestion.'
      );
    }
  };

  const handleMarkReviewed = async () => {
    if (!lead) return;
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewed_by_human: true,
        selected_route: lead.selected_route ?? lead.suggested_route,
        actor_label: lead.owner_label || settings.default_owner,
      }),
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      setLead(json.data.lead);
      setActivities(json.data.activities);
      onUpdated();
      showFeedback('success', 'Lead marked as human-reviewed.');
    }
  };

  const handleRerunQualification = async () => {
    if (!lead) return;
    setRerunningQual(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/qualify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor_label: lead.owner_label || settings.default_owner,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setLead(json.data.lead);
        setActivities(json.data.activities);
        onUpdated();
        showFeedback(
          'success',
          'Re-ran qualification and updated priority score breakdown.'
        );
      } else {
        showFeedback(
          'error',
          json?.error?.message || 'Failed to re-run qualification.'
        );
      }
    } finally {
      setRerunningQual(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    const parsedVal =
      editValue.trim() === '' ? null : Number(editValue.trim());

    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName,
        email: editEmail,
        organization: editOrg || null,
        owner_label: editOwner,
        estimated_value:
          parsedVal !== null && !Number.isNaN(parsedVal) ? parsedVal : null,
        challenge: editChallenge,
        actor_label: editOwner || settings.default_owner,
      }),
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      setLead(json.data.lead);
      setActivities(json.data.activities);
      setIsEditing(false);
      onUpdated();
      showFeedback('success', 'Saved lead record changes.');
    } else {
      showFeedback('error', json?.error?.message || 'Could not update lead.');
    }
  };

  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    const isoDate = followUpDateInput
      ? new Date(followUpDateInput).toISOString()
      : null;

    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        next_action: nextActionInput || null,
        follow_up_at: isoDate,
        actor_label: lead.owner_label || settings.default_owner,
      }),
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      setLead(json.data.lead);
      setActivities(json.data.activities);
      setShowFollowUpForm(false);
      onUpdated();
      showFeedback('success', 'Updated next action and follow-up schedule.');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !noteInput.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: noteInput,
          actor_label: lead.owner_label || settings.default_owner,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setLead(json.data.lead);
        setActivities(json.data.activities);
        setNoteInput('');
        onUpdated();
        showFeedback('success', 'Note added to lead record and timeline.');
      }
    } finally {
      setAddingNote(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !taskTitle.trim() || !taskDue) return;
    setAddingTask(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          title: taskTitle,
          due_at: new Date(taskDue).toISOString(),
          owner: lead.owner_label || settings.default_owner,
          actor_label: lead.owner_label || settings.default_owner,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setTaskTitle('');
        setTaskDue('');
        await loadDetails();
        onUpdated();
        showFeedback('success', 'Follow-up task created.');
      }
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completed,
        actor_label: lead?.owner_label || settings.default_owner,
      }),
    });
    if (res.ok) {
      await loadDetails();
      onUpdated();
    }
  };

  const handleGenerateDraft = async (templateIdOverride?: string) => {
    if (!lead) return;
    setEmailBusy(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'draft',
          template_id: templateIdOverride || selectedTemplateId || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        const d: EmailDraftResult = json.data.draft;
        setEmailDraft(d);
        setDraftSubject(d.subject);
        setDraftBody(d.body);
        setSelectedTemplateId(d.template_id);
        setHumanSendConfirmed(false);
        if (json.data.lead_details) {
          setActivities(json.data.lead_details.activities);
        }
        onUpdated();
        showFeedback(
          'success',
          'Email draft composed and logged for human review.'
        );
      }
    } finally {
      setEmailBusy(false);
    }
  };

  const handleSendEmail = async () => {
    if (!lead || !emailDraft) return;
    setEmailBusy(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          subject: draftSubject,
          body: draftBody,
          human_confirmed: humanSendConfirmed,
          actor_label: lead.owner_label || settings.default_owner,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setHumanSendConfirmed(false);
        if (json.data.lead_details) {
          setLead(json.data.lead_details.lead);
          setActivities(json.data.lead_details.activities);
        }
        onUpdated();
        showFeedback('success', 'Human-approved email sent and logged.');
      } else {
        showFeedback(
          'error',
          json?.error?.message || 'Email sending is blocked.'
        );
      }
    } finally {
      setEmailBusy(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!lead) return;
    const confirmed = window.confirm(
      `Delete inquiry record for ${lead.name}? This will remove the lead, tasks, and activity log from current storage.`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' });
    if (res.ok) {
      onUpdated();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-stone-950/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-drawer-title"
    >
      <div className="w-full max-w-4xl bg-canvas h-full shadow-2xl shadow-stone-900/15 border-l border-stone-200 flex flex-col overflow-hidden">
        {/* Top Drawer Bar */}
        <div className="px-6 py-4 bg-white border-b border-stone-200 flex items-center justify-between gap-4 shrink-0">
          {loading || !lead ? (
            <div className="h-6 w-48 bg-stone-200 animate-pulse rounded" />
          ) : (
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2
                  id="lead-drawer-title"
                  className="text-lg font-semibold text-stone-900 truncate"
                >
                  {lead.name}
                </h2>
                {lead.is_demo && (
                  <span className="text-xs text-stone-400">Demo</span>
                )}
                <StageBadge stage={lead.pipeline_stage} />
                <PriorityBadge
                  score={lead.priority_score}
                  label={lead.priority_label}
                />
              </div>
              <p className="text-xs text-stone-600 mt-0.5 truncate">
                {lead.email}
                {lead.organization ? ` · ${lead.organization}` : ''} ·{' '}
                {ROLE_TYPE_LABELS[lead.role_type]}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {lead && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {isEditing ? 'Cancel Edit' : 'Edit'}
                </button>
                <button
                  type="button"
                  onClick={handleRerunQualification}
                  disabled={rerunningQual}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      rerunningQual ? 'animate-spin' : ''
                    }`}
                  />
                  {rerunningQual ? 'Qualifying…' : 'Re-run AI'}
                </button>
                {!lead.reviewed_by_human && (
                  <button
                    type="button"
                    onClick={handleMarkReviewed}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-hover"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Mark reviewed
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:text-stone-900 hover:bg-stone-100"
              aria-label="Close lead details drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Feedback Banner */}
        {actionBanner && (
          <div
            role="status"
            className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
              actionBanner.type === 'success'
                ? 'bg-stone-50 text-stone-800 border-stone-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <span>{actionBanner.message}</span>
            <button
              type="button"
              onClick={() => setActionBanner(null)}
              className="text-xs underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Drawer Body */}
        {loading || !lead ? (
          <div className="p-6 space-y-4">
            <div className="h-28 bg-white rounded-xl border border-stone-200 animate-pulse" />
            <div className="h-48 bg-white rounded-xl border border-stone-200 animate-pulse" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Optional Edit Form */}
            {isEditing && (
              <form
                onSubmit={handleSaveEdit}
                className="bg-white rounded-xl border border-stone-300 p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
                  <h3 className="text-sm font-semibold text-stone-900">
                    Edit lead
                  </h3>
                  <button
                    type="button"
                    onClick={handleDeleteLead}
                    className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-900 font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete lead
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Work Email
                    </label>
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Organization
                    </label>
                    <input
                      type="text"
                      value={editOrg}
                      onChange={(e) => setEditOrg(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Owner
                    </label>
                    <input
                      type="text"
                      value={editOwner}
                      onChange={(e) => setEditOwner(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Estimated / Recorded Deal Value (USD, optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      placeholder="No value assumed"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {client.terms.challenge}
                  </label>
                  <textarea
                    rows={3}
                    value={editChallenge}
                    onChange={(e) => setEditChallenge(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-medium text-stone-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-hover"
                  >
                    Save changes
                  </button>
                </div>
              </form>
            )}

            {/* 1. Human Decision vs. AI Suggestion Bar (Visually Distinguished) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Human Pipeline & Route Control Card */}
              <div className="bg-white rounded-xl border border-stone-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                    <UserCheck className="w-4 h-4" />
                    Your decision
                  </span>
                  <span className="text-xs text-stone-500">
                    {lead.reviewed_by_human
                      ? `Reviewed ${formatShortDate(lead.reviewed_at)}`
                      : 'Awaiting human review'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="drawer-stage-select"
                      className="block text-xs font-medium text-stone-700 mb-1"
                    >
                      Stage
                    </label>
                    <select
                      id="drawer-stage-select"
                      value={lead.pipeline_stage}
                      onChange={(e) =>
                        handleStageSelect(e.target.value as PipelineStage)
                      }
                      className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs font-medium text-stone-900"
                    >
                      {PIPELINE_STAGES.map((st) => (
                        <option key={st} value={st}>
                          {PIPELINE_STAGE_LABELS[st]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="drawer-route-select"
                      className="block text-xs font-medium text-stone-700 mb-1"
                    >
                      Service
                    </label>
                    <select
                      id="drawer-route-select"
                      value={lead.selected_route ?? ''}
                      onChange={(e) => handleRouteSelect(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs font-medium text-stone-900"
                    >
                      <option value="">
                        — Use AI Suggestion (
                        {SERVICE_ROUTE_LABELS[lead.suggested_route]}) —
                      </option>
                      {SERVICE_ROUTES.map((rt) => (
                        <option key={rt} value={rt}>
                          {SERVICE_ROUTE_LABELS[rt]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {lead.lost_reason && lead.pipeline_stage === 'lost' && (
                  <p className="mt-2.5 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded px-2.5 py-1.5">
                    <strong>Recorded Loss Reason:</strong> {lead.lost_reason}
                  </p>
                )}

                <div className="mt-3 pt-3 border-t border-stone-200 flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-xs text-stone-700">
                    <span className="text-stone-500">Next step:</span>{' '}
                    <span className="font-medium">
                      {lead.next_action || 'None scheduled'}
                    </span>
                    {lead.follow_up_at && (
                      <span className="ml-1.5 text-stone-500">
                        (Due {formatShortDate(lead.follow_up_at)})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFollowUpForm(!showFollowUpForm)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Set follow-up
                  </button>
                </div>

                {showFollowUpForm && (
                  <form
                    onSubmit={handleSaveFollowUp}
                    className="mt-3 pt-3 border-t border-stone-200 space-y-2.5"
                  >
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-1">
                        Next step
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Follow up after sending syllabus"
                        value={nextActionInput}
                        onChange={(e) => setNextActionInput(e.target.value)}
                        className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-1">
                        Follow-Up Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={followUpDateInput}
                        onChange={(e) => setFollowUpDateInput(e.target.value)}
                        className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowFollowUpForm(false)}
                        className="px-2.5 py-1 text-xs text-stone-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 rounded bg-brand text-white text-xs font-semibold"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* AI Qualification Suggestion Card (Read-only advisory) */}
              <div className="bg-white rounded-xl border border-stone-200 p-4">
                <div className="flex items-center justify-between mb-2.5 flex-wrap gap-1">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-900">
                    <Sparkles className="w-4 h-4 text-stone-400" />
                    AI suggestion
                  </span>
                  <QualificationStatusBadge
                    status={lead.qualification_status}
                    model={lead.ai_model}
                  />
                </div>

                <div className="flex items-center gap-3 flex-wrap mb-2.5">
                  <div>
                    <span className="text-xs text-stone-500 block">
                      Suggested service
                    </span>
                    <RouteBadge
                      suggestedRoute={lead.suggested_route}
                      selectedRoute={null}
                      showSourceLabel={false}
                    />
                  </div>
                  <div>
                    <span className="text-xs text-stone-500 block">
                      Confidence
                    </span>
                    <span className="text-xs font-semibold text-stone-900">
                      {lead.ai_confidence !== null
                        ? `${Math.round(lead.ai_confidence * 100)}%`
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-stone-500 block">
                      Suggested next step
                    </span>
                    <span className="text-xs font-medium text-stone-800">
                      {lead.ai_suggested_next_action || 'Review the inquiry'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-stone-700 leading-relaxed bg-canvas rounded-lg p-2.5 border border-stone-200">
                  {lead.ai_summary || 'No summary generated yet.'}
                </p>

                {lead.qualification_error && (
                  <div className="mt-2 rounded bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-900 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{lead.qualification_error}</span>
                  </div>
                )}

                <p className="mt-2 text-xs text-stone-500">
                  AI suggestions never automatically move pipeline stages or
                  send messages.
                </p>
              </div>
            </div>

            {/* 2. Original Inquiry Answers & Consent Audit */}
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-4 flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-stone-600" />
                  What they submitted
                </h3>
                <span className="text-xs text-stone-500">
                  Submitted {formatDateTime(lead.created_at)} · Source:{' '}
                  <strong className="font-medium text-stone-700">{humanize(lead.source)}</strong>
                  {lead.referrer ? ` (${lead.referrer})` : ''}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 text-xs">
                <div>
                  <span className="text-stone-500 block">Role</span>
                  <span className="font-semibold text-stone-900">
                    {ROLE_TYPE_LABELS[lead.role_type]}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">Team size</span>
                  <span className="font-semibold text-stone-900">
                    {lead.team_size_range
                      ? `${lead.team_size_range} people`
                      : 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">
                    Asked for
                  </span>
                  <span className="font-semibold text-stone-900">
                    {REQUESTED_SERVICE_LABELS[lead.requested_service]}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">Timing</span>
                  <span className="font-semibold text-stone-900">
                    {TIMING_LABELS[lead.timing]}
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-xs font-semibold text-stone-700 block mb-1">
                  {client.terms.challenge}
                </span>
                <div className="rounded-lg bg-canvas border border-stone-200 p-3 text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">
                  {lead.challenge}
                </div>
              </div>

              {/* Consent Audit Bar */}
              <div className="rounded-lg bg-stone-50 border border-stone-200 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand shrink-0" />
                  <span>
                    <strong className="font-medium">Asked for a reply:</strong> Yes (
                    {formatDateTime(lead.consent_response_at)})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded font-medium border ${
                      lead.marketing_email_consent
                        ? 'bg-stone-50 text-stone-800 border-stone-200'
                        : 'bg-amber-50 text-amber-900 border-amber-300'
                    }`}
                  >
                    {lead.marketing_email_consent
                      ? `Agreed to follow-up emails (${formatShortDate(
                          lead.marketing_email_consent_at
                        )})`
                      : 'Did not agree to follow-up emails'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Grounded Evidence, Missing Information & Priority score */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Evidence & Missing Info */}
              <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-stone-900 mb-2 flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-stone-600" />
                    Evidence from the submission
                  </h3>
                  {lead.ai_evidence.length === 0 ? (
                    <p className="text-xs text-stone-500">
                      No evidence items recorded.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {lead.ai_evidence.map((ev, i) => (
                        <div
                          key={i}
                          className="flex items-start justify-between gap-2 text-xs bg-canvas px-3 py-2 rounded border border-stone-200"
                        >
                          <span className="tabular-nums text-xs text-stone-600 shrink-0">
                            {humanize(ev.field)}
                          </span>
                          <span className="text-stone-900 font-medium text-right">
                            {/* The AI sometimes quotes internal ids (hr_ld, one_to_one_coaching); show their labels instead. */}
                            {(REQUESTED_SERVICE_LABELS as Record<string, string>)[ev.value] ??
                              (ROLE_TYPE_LABELS as Record<string, string>)[ev.value] ??
                              (TIMING_LABELS as Record<string, string>)[ev.value] ??
                              ev.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-stone-200">
                  <h4 className="text-sm font-medium text-stone-700 mb-2">
                    Missing or unclear
                  </h4>
                  {lead.ai_missing_information.length === 0 ? (
                    <p className="text-xs text-brand bg-stone-50 border border-stone-200 rounded px-3 py-2">
                      All standard intake context present for initial routing.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {lead.ai_missing_information.map((info, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-amber-950 bg-amber-50/80 border border-amber-200 rounded px-3 py-1.5 flex items-start gap-2"
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <span>{info}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Deterministic Score Breakdown */}
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-stone-900">
                    Priority score
                  </h3>
                  <PriorityBadge
                    score={lead.priority_score}
                    label={lead.priority_label}
                  />
                </div>
                <p className="text-xs text-stone-500 mb-3">
                  Calculated from the form answers, not by the AI. Weights are editable in
                  Settings.
                </p>

                <div className="space-y-2">
                  {lead.score_breakdown.map((item) => (
                    <div
                      key={item.rule_id}
                      className={`p-2.5 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                        item.awarded
                          ? 'bg-brand/[0.04] border-stone-200 text-stone-900'
                          : 'bg-stone-50 border-stone-200 text-stone-600'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{item.label}</div>
                        <div className="text-xs text-stone-600 mt-0.5">
                          {item.reason}
                        </div>
                      </div>
                      <span
                        className={`tabular-nums font-bold px-2 py-0.5 rounded text-xs shrink-0 ${
                          item.awarded
                            ? 'bg-brand text-white'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        +{item.awarded ? item.points : 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Booking Link Placeholder & Consent-Gated Email Draft Adapter */}
            <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-stone-200 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-stone-700" />
                    Follow-up email
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Nothing is sent until you review it and confirm.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleGenerateDraft()}
                  disabled={emailBusy}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-hover disabled:opacity-50"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {emailDraft ? 'Redraft from template' : 'Draft email'}
                </button>
              </div>

              {/* Calendar Booking Link Placeholder */}
              <div className="rounded-lg bg-canvas border border-stone-200 p-3 flex items-center justify-between gap-3 flex-wrap text-xs">
                <div>
                  <span className="font-semibold text-stone-800 block">
                    Booking link
                  </span>
                  <span className="tabular-nums text-stone-600 text-xs">
                    {settings.booking_url_placeholder}
                  </span>
                  <span className="block text-xs text-stone-500 mt-0.5">
                    Sent in the email. Booking a call doesn’t move the lead automatically.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      settings.booking_url_placeholder
                    );
                    setCopiedBooking(true);
                    setTimeout(() => setCopiedBooking(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50"
                >
                  {copiedBooking ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-brand" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy booking link
                    </>
                  )}
                </button>
              </div>

              {/* Template Selector & Draft Editor */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <label
                    htmlFor="email-template-select"
                    className="text-xs font-semibold text-stone-700"
                  >
                    Template:
                  </label>
                  <select
                    id="email-template-select"
                    value={selectedTemplateId}
                    onChange={(e) => {
                      setSelectedTemplateId(e.target.value);
                      void handleGenerateDraft(e.target.value);
                    }}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900"
                  >
                    <option value="">
                      Auto-select by route (
                      {
                        SERVICE_ROUTE_LABELS[
                          lead.selected_route ?? lead.suggested_route
                        ]
                      }
                      )
                    </option>
                    {settings.email_templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                </div>

                {emailDraft && (
                  <div className="space-y-3 pt-2 border-t border-stone-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-stone-50 px-3 py-2 rounded border border-stone-200">
                        <span className="text-stone-500">Recipient:</span>{' '}
                        <strong className="text-stone-900">
                          {emailDraft.recipient_name} &lt;
                          {emailDraft.recipient_email}&gt;
                        </strong>
                      </div>
                      <div className="bg-stone-50 px-3 py-2 rounded border border-stone-200">
                        <span className="text-stone-500">Sending:</span>{' '}
                        <strong className="text-stone-900">
                          {emailDraft.provider_configured
                            ? `On (${emailDraft.provider_name})`
                            : 'Off, drafts only'}
                        </strong>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={draftSubject}
                        onChange={(e) => setDraftSubject(e.target.value)}
                        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Message
                      </label>
                      <textarea
                        rows={7}
                        value={draftBody}
                        onChange={(e) => setDraftBody(e.target.value)}
                        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 font-sans leading-relaxed"
                      />
                    </div>

                    {emailDraft.send_blocked_reasons.length > 0 && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1">
                        <div className="text-xs font-semibold text-amber-950 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-amber-800" />
                          This email can’t be sent yet:
                        </div>
                        <ul className="list-disc list-inside text-xs text-amber-900 space-y-0.5">
                          {emailDraft.send_blocked_reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
                      <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={humanSendConfirmed}
                          disabled={!emailDraft.can_send}
                          onChange={(e) =>
                            setHumanSendConfirmed(e.target.checked)
                          }
                          className="rounded border-stone-300"
                        />
                        <span>
                          I have reviewed this message and explicitly confirm
                          sending to {lead.email}
                        </span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `Subject: ${draftSubject}\n\n${draftBody}`
                            );
                            showFeedback(
                              'success',
                              'Copied email draft to clipboard.'
                            );
                          }}
                          className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50"
                        >
                          Copy text
                        </button>
                        <button
                          type="button"
                          disabled={
                            !emailDraft.can_send ||
                            !humanSendConfirmed ||
                            emailBusy
                          }
                          onClick={handleSendEmail}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Send email
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Tasks & Notes Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Tasks Panel */}
              <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-stone-700" />
                  Follow-ups
                </h3>

                <form
                  onSubmit={handleCreateTask}
                  className="flex flex-wrap gap-2"
                >
                  <input
                    type="text"
                    required
                    placeholder="New follow-up task title..."
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-xs"
                  />
                  <input
                    type="datetime-local"
                    required
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    className="flex-1 min-w-0 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={addingTask}
                    className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-hover shrink-0"
                  >
                    Add follow-up
                  </button>
                </form>

                {tasks.length === 0 ? (
                  <p className="text-xs text-stone-500 py-2">
                    No tasks associated with this lead yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((t) => {
                      const isOverdue =
                        t.status === 'open' &&
                        new Date(t.due_at).getTime() < Date.now();
                      return (
                        <div
                          key={t.id}
                          className={`p-2.5 rounded-lg border text-xs flex items-start justify-between gap-2.5 ${
                            t.status === 'completed'
                              ? 'bg-stone-50 border-stone-200 text-stone-500 line-through'
                              : isOverdue
                              ? 'bg-white border-stone-200 text-stone-900'
                              : 'bg-canvas border-stone-200 text-stone-900'
                          }`}
                        >
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={t.status === 'completed'}
                              onChange={(e) =>
                                handleToggleTask(t.id, e.target.checked)
                              }
                              className="mt-0.5 rounded border-stone-300"
                            />
                            <div>
                              <div className="font-medium">{t.title}</div>
                              <div className="text-xs text-stone-500 mt-0.5">
                                Due {formatDateTime(t.due_at)} · {t.owner}
                              </div>
                            </div>
                          </label>
                          {isOverdue && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-xs font-medium shrink-0">
                              Overdue
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notes Panel */}
              <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                  <MessageSquarePlus className="w-4 h-4 text-stone-700" />
                  {client.terms.notesTitle}
                </h3>

                <form onSubmit={handleAddNote} className="space-y-2">
                  <textarea
                    rows={2}
                    required
                    placeholder="Add a human review note or call summary..."
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={addingNote}
                      className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-hover disabled:opacity-50"
                    >
                      {addingNote ? 'Saving…' : 'Add note'}
                    </button>
                  </div>
                </form>

                <div className="rounded-lg bg-canvas border border-stone-200 p-3 text-xs text-stone-800 whitespace-pre-wrap max-h-44 overflow-y-auto leading-relaxed">
                  {lead.notes || 'No internal notes recorded yet.'}
                </div>
              </div>
            </div>

            {/* 6. Activity Timeline */}
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h3 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-stone-700" />
                Activity
              </h3>

              <div className="space-y-3">
                {activities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start justify-between gap-4 text-xs pb-3 border-b border-stone-100 last:border-b-0 last:pb-0"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                            act.actor_type === 'user'
                              ? 'bg-stone-50 text-stone-800 border border-stone-200'
                              : 'bg-stone-100 text-stone-700 border border-stone-200'
                          }`}
                        >
                          {act.actor_label}
                        </span>
                        <span className="tabular-nums text-xs text-stone-500">
                          {act.event_type}
                        </span>
                      </div>
                      <p className="text-stone-800 mt-1">{act.summary}</p>
                    </div>
                    <span className="text-xs text-stone-500 whitespace-nowrap shrink-0">
                      {formatDateTime(act.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {pendingOutcomeStage && lead && (
          <StageTransitionModal
            leadName={lead.name}
            currentStage={lead.pipeline_stage}
            targetStage={pendingOutcomeStage}
            currentEstimatedValue={lead.estimated_value}
            onCancel={() => setPendingOutcomeStage(null)}
            onConfirm={handleConfirmOutcomeStage}
          />
        )}
      </div>
    </div>
  );
}
