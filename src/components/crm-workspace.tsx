'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CRMSettings,
  IntegrationRuntimeStatus,
  LeadRecord,
  LossReason,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGES,
  PipelineStage,
  PRIORITY_LABELS,
  PriorityLabel,
  SERVICE_ROUTE_LABELS,
  SERVICE_ROUTES,
  ServiceRoute,
  TaskRecord,
} from '@/lib/schemas';
import { DashboardMetrics } from '@/lib/repository';
import {
  formatDateTime,
  formatShortDate,
  humanize,
  PriorityBadge,
  QualificationStatusBadge,
  RouteBadge,
  StageBadge,
} from './badges';
import { LeadDetailDrawer } from './lead-detail-drawer';
import { StageTransitionModal } from './stage-transition-modal';
import { AddLeadModal } from './add-lead-modal';
import { AnalyticsView, SettingsView } from './settings-and-analytics';
import {
  AlertCircle,
  ArrowUpDown,
  BarChart3,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  ExternalLink,
  Filter,
  Kanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { client } from '@/config/client';
import { applyBrandAccent } from '@/lib/brand';

type NavTab =
  | 'overview'
  | 'leads'
  | 'pipeline'
  | 'tasks'
  | 'analytics'
  | 'settings';

type TaskWithLeadInfo = TaskRecord & {
  lead_name: string;
  lead_organization: string | null;
  lead_stage: PipelineStage;
  lead_priority: PriorityLabel;
};

export function CRMWorkspace() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');

  // Core data state
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [settings, setSettings] = useState<CRMSettings | null>(null);
  const [runtime, setRuntime] = useState<IntegrationRuntimeStatus | null>(null);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [tasks, setTasks] = useState<TaskWithLeadInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Dashboard filters
  const [periodDays, setPeriodDays] = useState<string>('all');
  const [dashboardSource, setDashboardSource] = useState<string>('all');

  // Leads filters & sort
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<PipelineStage | 'all'>('all');
  const [routeFilter, setRouteFilter] = useState<ServiceRoute | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityLabel | 'all'>(
    'all'
  );
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [followUpFilter, setFollowUpFilter] = useState<
    'all' | 'overdue' | 'upcoming' | 'none'
  >('all');
  const [sortBy, setSortBy] = useState<
    'created_at' | 'priority_score' | 'last_activity_at' | 'follow_up_at'
  >('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Tasks filter & new task state
  const [taskView, setTaskView] = useState<
    'all' | 'overdue' | 'today' | 'upcoming' | 'completed'
  >('all');
  const [newTaskLeadId, setNewTaskLeadId] = useState<string>('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');

  // Active drawer / modals
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);

  // Kanban drag & stage confirmation state
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(
    null
  );
  const [pendingStageTransition, setPendingStageTransition] = useState<{
    lead: LeadRecord;
    targetStage: PipelineStage;
  } | null>(null);

  // Guided demo replay state
  const [replayScenario, setReplayScenario] =
    useState<string>('executive_1on1');
  const [demoBusy, setDemoBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const fetchAllData = useCallback(async () => {
    try {
      const dashParams = new URLSearchParams({
        period_days: periodDays,
        source: dashboardSource,
      });

      const leadParams = new URLSearchParams({
        search: searchQuery,
        stage: stageFilter,
        route: routeFilter,
        priority: priorityFilter,
        source: sourceFilter,
        owner: ownerFilter,
        follow_up_status: followUpFilter,
        sort_by: sortBy,
        sort_dir: sortDir,
        page: String(page),
        page_size: String(pageSize),
      });

      const taskParams = new URLSearchParams({
        view: taskView,
      });

      const [dashRes, leadsRes, tasksRes] = await Promise.all([
        fetch(`/api/dashboard?${dashParams.toString()}`),
        fetch(`/api/leads?${leadParams.toString()}`),
        fetch(`/api/tasks?${taskParams.toString()}`),
      ]);

      if ([dashRes, leadsRes, tasksRes].some((r) => r.status === 401)) {
        window.location.href = '/login';
        return;
      }

      const [dashJson, leadsJson, tasksJson] = await Promise.all([
        dashRes.json(),
        leadsRes.json(),
        tasksRes.json(),
      ]);

      if (dashJson?.ok) {
        setMetrics(dashJson.data.metrics);
        setSettings(dashJson.data.settings);
        setRuntime(dashJson.data.runtime);
        applyBrandAccent(dashJson.data.settings?.brand_accent);
      }

      if (leadsJson?.ok) {
        setLeads(leadsJson.data.leads);
        setLeadsTotal(leadsJson.data.total);
        if (!newTaskLeadId && leadsJson.data.leads.length > 0) {
          setNewTaskLeadId(leadsJson.data.leads[0].id);
        }
      }

      if (tasksJson?.ok) {
        setTasks(tasksJson.data.tasks);
      }
    } finally {
      setLoading(false);
    }
  }, [
    periodDays,
    dashboardSource,
    searchQuery,
    stageFilter,
    routeFilter,
    priorityFilter,
    sourceFilter,
    ownerFilter,
    followUpFilter,
    sortBy,
    sortDir,
    page,
    taskView,
    newTaskLeadId,
  ]);

  useEffect(() => {
    void fetchAllData();
  }, [fetchAllData]);

  // Also fetch all leads without stage/pagination filter for the Kanban board when in pipeline or analytics view
  const [allPipelineLeads, setAllPipelineLeads] = useState<LeadRecord[]>([]);
  const fetchPipelineLeads = useCallback(async () => {
    const res = await fetch('/api/leads?page_size=100&sort_by=priority_score&sort_dir=desc');
    const json = await res.json();
    if (json?.ok) {
      setAllPipelineLeads(json.data.leads);
    }
  }, []);

  useEffect(() => {
    void fetchPipelineLeads();
  }, [fetchPipelineLeads, leads]);

  const availableOwners = useMemo(() => {
    const set = new Set<string>();
    allPipelineLeads.forEach((l) => {
      if (l.owner_label) set.add(l.owner_label);
    });
    return Array.from(set).sort();
  }, [allPipelineLeads]);

  const availableSources = useMemo(() => {
    const set = new Set<string>();
    allPipelineLeads.forEach((l) => {
      if (l.source) set.add(l.source);
    });
    return Array.from(set).sort();
  }, [allPipelineLeads]);

  // Stage transition handler (used by Kanban drag-and-drop AND keyboard stage select)
  const initiateStageChange = async (
    lead: LeadRecord,
    targetStage: PipelineStage
  ) => {
    if (lead.pipeline_stage === targetStage) return;

    if (
      targetStage === 'won' ||
      targetStage === 'lost' ||
      targetStage === 'not_a_fit'
    ) {
      setPendingStageTransition({ lead, targetStage });
      return;
    }

    const res = await fetch(`/api/leads/${lead.id}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pipeline_stage: targetStage,
        confirmed: true,
        actor_label: lead.owner_label || settings?.default_owner || 'CRM Operator',
      }),
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      await fetchAllData();
      await fetchPipelineLeads();
      showToast(
        `Moved ${lead.name} to ${PIPELINE_STAGE_LABELS[targetStage]}.`
      );
    }
  };

  const handleConfirmOutcomeStage = async (params: {
    targetStage: PipelineStage;
    lostReason?: LossReason | null;
    estimatedValue?: number | null;
    confirmed: true;
  }) => {
    if (!pendingStageTransition) return;
    const { lead } = pendingStageTransition;

    const res = await fetch(`/api/leads/${lead.id}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pipeline_stage: params.targetStage,
        lost_reason: params.lostReason,
        estimated_value: params.estimatedValue,
        confirmed: true,
        actor_label: lead.owner_label || settings?.default_owner || 'CRM Operator',
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error(json?.error?.message || 'Could not update stage.');
    }

    setPendingStageTransition(null);
    await fetchAllData();
    await fetchPipelineLeads();
    showToast(
      `Confirmed ${lead.name} → ${PIPELINE_STAGE_LABELS[params.targetStage]}.`
    );
  };

  const handleReplayInquiry = async () => {
    setDemoBusy(true);
    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replay',
          scenario: replayScenario,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        const createdLead: LeadRecord = json.data.lead;
        await fetchAllData();
        await fetchPipelineLeads();
        setSelectedLeadId(createdLead.id);
        showToast(
          `Simulated sample inquiry from ${createdLead.name} → Suggested ${
            SERVICE_ROUTE_LABELS[createdLead.suggested_route]
          } (Score ${createdLead.priority_score}/8).`
        );
      }
    } finally {
      setDemoBusy(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  };

  const handleRemoveDemoLeads = async () => {
    if (
      !window.confirm(
        'Remove all demo leads (and their notes, tasks and activity)? Real inquiries are not affected.'
      )
    ) {
      return;
    }
    setDemoBusy(true);
    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'purge_demo' }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setSelectedLeadId(null);
        await fetchAllData();
        await fetchPipelineLeads();
        showToast(json.data.message);
      }
    } finally {
      setDemoBusy(false);
    }
  };

  const handleResetDemoData = async () => {
    setDemoBusy(true);
    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      if (res.ok) {
        setSelectedLeadId(null);
        await fetchAllData();
        await fetchPipelineLeads();
        showToast('Reset synthetic demo store to initial 8 fictional leads.');
      }
    } finally {
      setDemoBusy(false);
    }
  };

  const handleCreateTaskInTasksView = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskLeadId || !newTaskTitle.trim() || !newTaskDue) return;
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: newTaskLeadId,
        title: newTaskTitle,
        due_at: new Date(newTaskDue).toISOString(),
        owner: settings?.default_owner || client.business.ownerLabel,
        notes: newTaskNotes,
      }),
    });
    if (res.ok) {
      setNewTaskTitle('');
      setNewTaskDue('');
      setNewTaskNotes('');
      await fetchAllData();
      showToast('Created follow-up task and logged activity.');
    }
  };

  const handleToggleTaskStatus = async (taskId: string, completed: boolean) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completed,
        actor_label: settings?.default_owner || client.business.ownerLabel,
      }),
    });
    if (res.ok) {
      await fetchAllData();
      showToast(completed ? 'Task marked completed.' : 'Task reopened.');
    }
  };

  const businessName = settings?.business_name || client.business.name;
  const brandTagline = settings?.brand_tagline || client.business.tagline;
  const businessInitials =
    businessName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'CR';

  const PAGE_META: Record<NavTab, { title: string; subtitle: string }> = {
    overview: { title: 'Overview', subtitle: 'What needs your attention today.' },
    leads: { title: 'Leads', subtitle: 'Every inquiry, its route and where it stands.' },
    pipeline: {
      title: client.terms.pipelineTitle,
      subtitle: 'Drag a card to move it. Won, Lost and Not a fit ask for confirmation.',
    },
    tasks: { title: 'Follow-ups', subtitle: 'Reminders tied to a lead. Nothing is sent automatically.' },
    analytics: { title: 'Analytics', subtitle: 'Conversion and routing across stored inquiries.' },
    settings: { title: 'Settings', subtitle: 'Branding, services, scoring and integrations.' },
  };

  const NAV_ITEMS = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'leads', label: 'Leads', icon: Users, count: allPipelineLeads.length },
    { id: 'pipeline', label: 'Pipeline', icon: Kanban },
    { id: 'tasks', label: 'Follow-ups', icon: ListTodo, alert: metrics?.overdue_tasks_count || 0 },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  const attentionReason = (lead: LeadRecord) => {
    const overdue =
      Boolean(lead.follow_up_at) && new Date(lead.follow_up_at!).getTime() < Date.now();
    if (overdue) return { text: `Follow-up overdue · ${formatShortDate(lead.follow_up_at)}`, tone: 'text-rose-600' };
    if (lead.qualification_status === 'failed' || lead.qualification_status === 'pending_retry')
      return { text: 'Qualification failed', tone: 'text-amber-700' };
    if ((lead.selected_route ?? lead.suggested_route) === 'review')
      return { text: 'Needs a routing decision', tone: 'text-amber-700' };
    if (!lead.reviewed_by_human) return { text: 'Not reviewed yet', tone: 'text-stone-500' };
    return { text: 'Check follow-up', tone: 'text-stone-500' };
  };

  const selectClass =
    'h-9 rounded-lg border border-stone-200 bg-white pl-3 pr-8 text-sm text-stone-800 hover:border-stone-300 focus:border-brand focus:outline-none';
  const fieldClass =
    'w-full h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 hover:border-stone-300 focus:border-brand focus:outline-none';
  const ghostButton =
    'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-canvas text-stone-900">
      {/* Sidebar */}
      <aside className="w-full lg:w-60 shrink-0 bg-canvas-subtle border-b lg:border-b-0 lg:border-r border-stone-200 flex flex-col lg:sticky lg:top-0 lg:h-screen">
        <div className="px-4 pt-4 pb-3 lg:pt-5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white font-semibold text-xs shrink-0">
            {businessInitials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-900 leading-tight line-clamp-2">
              {businessName}
            </p>
            <p className="text-xs text-stone-500 leading-tight mt-0.5">Lead CRM</p>
          </div>
        </div>

        <nav
          aria-label="Main"
          className="px-2 pb-2 lg:pt-2 flex lg:flex-col gap-0.5 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2.5 h-9 px-3 rounded-lg text-sm whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-stone-900 font-medium ring-1 ring-stone-200'
                    : 'text-stone-600 hover:bg-white/70 hover:text-stone-900'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand' : 'text-stone-400'}`}
                  aria-hidden="true"
                />
                <span className="flex-1 text-left">{item.label}</span>
                {'count' in item && item.count > 0 && (
                  <span className="text-xs tabular-nums text-stone-400">{item.count}</span>
                )}
                {'alert' in item && item.alert > 0 && (
                  <span
                    className="min-w-5 h-5 px-1.5 rounded-full bg-rose-100 text-rose-700 text-xs font-medium tabular-nums flex items-center justify-center"
                    title={`${item.alert} overdue`}
                  >
                    {item.alert}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:flex mt-auto flex-col gap-3 p-4 border-t border-stone-200 text-xs text-stone-500">
          <Link
            href="/inquire"
            className="inline-flex items-center gap-1.5 font-medium text-stone-700 hover:text-brand"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            Public inquiry form
          </Link>
          <div className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                runtime?.openrouter_configured ? 'bg-brand' : 'bg-stone-400'
              }`}
              aria-hidden="true"
            />
            {runtime?.openrouter_configured ? 'AI qualifier on' : 'Rule-based qualifier'}
          </div>
          {metrics?.is_demo_dataset && (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              Demo data loaded
            </div>
          )}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-14 border-b border-stone-200 bg-canvas/85 backdrop-blur px-4 sm:px-6 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search
              className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search leads"
              placeholder="Search leads…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
                if (activeTab !== 'leads') {
                  setActiveTab('leads');
                }
              }}
              className="w-full h-9 rounded-lg border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400 hover:border-stone-300 focus:border-brand focus:outline-none"
            />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {runtime?.demo_tools_enabled && (
              <div className="hidden md:flex items-center gap-1 pr-2 mr-1 border-r border-stone-200">
                <select
                  aria-label="Sample inquiry to simulate"
                  value={replayScenario}
                  onChange={(e) => setReplayScenario(e.target.value)}
                  className="h-9 rounded-lg bg-transparent pl-2 pr-7 text-sm text-stone-600 border-0 hover:bg-stone-100 focus:ring-0"
                >
                  <option value="executive_1on1">Sample: executive 1:1</option>
                  <option value="corporate_cohort">Sample: team cohort</option>
                  <option value="ambiguous_review">Sample: unclear request</option>
                </select>
                <button
                  type="button"
                  disabled={demoBusy}
                  onClick={handleReplayInquiry}
                  className={ghostButton}
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  Simulate
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowAddLeadModal(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add lead
            </button>

            {runtime?.auth_mode === 'enforced' && (
              <button
                type="button"
                onClick={handleLogout}
                className={ghostButton}
                title="Log out"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            )}
          </div>
        </header>

        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-stone-900 text-stone-100 pl-4 pr-2 py-2.5 text-sm flex items-center gap-3 shadow-xl shadow-stone-900/20"
          >
            <CheckCircle2 className="w-4 h-4 text-white/80 shrink-0" aria-hidden="true" />
            <span className="flex-1">{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="h-7 px-2 rounded-md text-xs text-stone-300 hover:bg-white/10 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-12 space-y-6">
          {/* Page header */}
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                {PAGE_META[activeTab].title}
              </h1>
              <p className="text-sm text-stone-500 mt-1">{PAGE_META[activeTab].subtitle}</p>
            </div>

            {activeTab === 'overview' && (
              <div className="flex items-center gap-2 w-full sm:w-auto [&>select]:flex-1 [&>select]:min-w-0 sm:[&>select]:flex-none">
                <select
                  aria-label="Date range"
                  value={periodDays}
                  onChange={(e) => setPeriodDays(e.target.value)}
                  className={selectClass}
                >
                  <option value="all">All time</option>
                  <option value="30">Last 30 days</option>
                  <option value="14">Last 14 days</option>
                  <option value="7">Last 7 days</option>
                </select>
                <select
                  aria-label="Lead source"
                  value={dashboardSource}
                  onChange={(e) => setDashboardSource(e.target.value)}
                  className={selectClass}
                >
                  <option value="all">All sources</option>
                  {(metrics?.sources_available || []).map((src) => (
                    <option key={src} value={src}>
                      {humanize(src)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ================================================================
              TAB 1: OVERVIEW
             ================================================================ */}
          {activeTab === 'overview' && metrics && (
            <div className="space-y-6">
              {metrics.is_demo_dataset && (
                <div className="flex items-center gap-3 flex-wrap rounded-xl bg-amber-50/70 border border-amber-200/70 px-4 py-2.5 text-sm text-amber-950">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-[min(240px,100%)]">
                    You&rsquo;re looking at fictional demo leads. Figures are calculated live but
                    aren&rsquo;t real performance.
                  </span>
                  <div className="flex items-center gap-1">
                    {runtime?.demo_tools_enabled && (
                      <button
                        type="button"
                        disabled={demoBusy}
                        onClick={handleResetDemoData}
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-sm text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                      >
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={demoBusy}
                      onClick={handleRemoveDemoLeads}
                      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Remove demo leads
                    </button>
                  </div>
                </div>
              )}

              {/* KPI strip */}
              <section
                aria-label="Key numbers"
                className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-stone-200 rounded-xl border border-stone-200 overflow-hidden"
              >
                {[
                  {
                    label: 'New leads',
                    value: metrics.new_leads_in_period,
                    meta: `${metrics.attention_required_leads.length} need attention`,
                  },
                  {
                    label: 'Qualified',
                    value: metrics.qualified_leads_count,
                    meta:
                      metrics.qualification_rate_pct !== null
                        ? `${metrics.qualification_rate_pct}% of inquiries`
                        : 'No inquiries yet',
                  },
                  {
                    label: 'Calls booked',
                    value: metrics.calls_booked_count,
                    meta:
                      metrics.call_booking_rate_pct !== null
                        ? `${metrics.call_booking_rate_pct}% of qualified`
                        : 'None qualified yet',
                  },
                  {
                    label: metrics.won_revenue !== null ? 'Won revenue' : 'Won',
                    value:
                      metrics.won_revenue !== null
                        ? `$${metrics.won_revenue.toLocaleString()}`
                        : metrics.won_deals_count,
                    meta:
                      metrics.win_rate_pct !== null
                        ? `${metrics.win_rate_pct}% win rate`
                        : 'No closed deals yet',
                  },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-white px-5 py-4">
                    <p className="text-sm text-stone-500">{kpi.label}</p>
                    <p className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums text-stone-900">
                      {kpi.value}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">{kpi.meta}</p>
                  </div>
                ))}
              </section>

              {/* Pipeline by stage */}
              <section className="bg-white rounded-xl border border-stone-200">
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <h2 className="text-sm font-semibold text-stone-900">Pipeline</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('pipeline')}
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-hover"
                  >
                    Open board
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="px-5 pb-1">
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-stone-100" aria-hidden="true">
                    {PIPELINE_STAGES.map((stage) => {
                      const count = metrics.pipeline_by_stage[stage] || 0;
                      const total = Math.max(1, metrics.new_leads_in_period);
                      if (!count) return null;
                      const tone =
                        stage === 'lost'
                          ? 'bg-rose-400'
                          : stage === 'not_a_fit'
                            ? 'bg-stone-300'
                            : stage === 'needs_review'
                              ? 'bg-amber-400'
                              : stage === 'new_inquiry'
                                ? 'bg-stone-400'
                                : 'bg-brand';
                      return (
                        <div
                          key={stage}
                          className={`${tone} border-r-2 border-white last:border-r-0`}
                          style={{ width: `${(count / total) * 100}%` }}
                        />
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 px-2 pb-2">
                  {PIPELINE_STAGES.map((stage) => {
                    const count = metrics.pipeline_by_stage[stage] || 0;
                    return (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => {
                          setStageFilter(stage);
                          setActiveTab('leads');
                        }}
                        className="flex flex-col items-start justify-start text-left rounded-lg px-3 py-2.5 hover:bg-stone-50"
                      >
                        <span
                          className={`block text-xl font-semibold tabular-nums ${
                            count ? 'text-stone-900' : 'text-stone-300'
                          }`}
                        >
                          {count}
                        </span>
                        <span className="block text-xs text-stone-500 leading-snug mt-0.5">
                          {PIPELINE_STAGE_LABELS[stage]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Needs attention */}
                <section className="lg:col-span-7 bg-white rounded-xl border border-stone-200">
                  <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-stone-100">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-stone-900">Needs attention</h2>
                      {metrics.attention_required_leads.length > 0 && (
                        <span className="h-5 min-w-5 px-1.5 rounded-full bg-stone-100 text-xs font-medium tabular-nums text-stone-600 flex items-center justify-center">
                          {metrics.attention_required_leads.length}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('leads')}
                      className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-hover"
                    >
                      All leads
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>

                  {metrics.attention_required_leads.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <CheckCircle2 className="w-6 h-6 text-brand mx-auto" aria-hidden="true" />
                      <p className="mt-2 text-sm font-medium text-stone-900">You&rsquo;re all caught up</p>
                      <p className="mt-1 text-sm text-stone-500">
                        Every active lead is reviewed and has a follow-up date.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-stone-100">
                      {metrics.attention_required_leads.map((lead) => {
                        const reason = attentionReason(lead);
                        return (
                          <li key={lead.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedLeadId(lead.id)}
                              className="group w-full text-left px-5 py-3.5 flex items-start gap-4 hover:bg-stone-50"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-medium text-stone-900 truncate group-hover:text-brand">
                                    {lead.name}
                                  </span>
                                  {lead.organization && (
                                    <span className="text-sm text-stone-400 truncate hidden sm:inline">
                                      {lead.organization}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-sm text-stone-500 line-clamp-1">
                                  {lead.ai_summary || lead.challenge}
                                </p>
                                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                  <RouteBadge
                                    suggestedRoute={lead.suggested_route}
                                    selectedRoute={lead.selected_route}
                                  />
                                  <StageBadge stage={lead.pipeline_stage} />
                                  <span className={`text-xs ml-1 ${reason.tone}`}>{reason.text}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <PriorityBadge score={lead.priority_score} label={lead.priority_label} />
                                <ChevronRight
                                  className="w-4 h-4 text-stone-300 group-hover:text-stone-500"
                                  aria-hidden="true"
                                />
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                {/* Recent activity */}
                <section className="lg:col-span-5 bg-white rounded-xl border border-stone-200">
                  <div className="px-5 pt-4 pb-3 border-b border-stone-100">
                    <h2 className="text-sm font-semibold text-stone-900">Recent activity</h2>
                  </div>
                  {metrics.recent_activities.length === 0 ? (
                    <p className="px-5 py-12 text-center text-sm text-stone-500">
                      Activity appears here as inquiries arrive and you work them.
                    </p>
                  ) : (
                    <ol className="px-5 py-3">
                      {metrics.recent_activities.slice(0, 8).map((act, i, list) => (
                        <li key={act.id} className="relative pl-5 pb-4 last:pb-1">
                          {i < list.length - 1 && (
                            <span
                              className="absolute left-[3px] top-2 bottom-0 w-px bg-stone-200"
                              aria-hidden="true"
                            />
                          )}
                          <span
                            className={`absolute left-0 top-1.5 w-[7px] h-[7px] rounded-full ring-2 ring-white ${
                              act.actor_type === 'user' ? 'bg-brand' : 'bg-stone-300'
                            }`}
                            aria-hidden="true"
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedLeadId(act.lead_id)}
                            className="block text-left w-full group"
                          >
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="text-sm font-medium text-stone-800 truncate">
                                {act.actor_label}
                              </span>
                              <span className="text-xs text-stone-400 tabular-nums shrink-0">
                                {formatDateTime(act.created_at)}
                              </span>
                            </span>
                            <span className="block mt-0.5 text-sm text-stone-500 line-clamp-2 group-hover:text-stone-700">
                              {act.summary}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB 2: LEADS LIST
             ================================================================ */}
          {activeTab === 'leads' && (
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex items-center gap-2 flex-wrap [&>select]:max-w-[10.5rem]">
                <select
                  aria-label="Stage"
                  value={stageFilter}
                  onChange={(e) => {
                    setStageFilter(e.target.value as PipelineStage | 'all');
                    setPage(1);
                  }}
                  className={selectClass}
                >
                  <option value="all">All stages</option>
                  {PIPELINE_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {PIPELINE_STAGE_LABELS[st]}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Service"
                  value={routeFilter}
                  onChange={(e) => {
                    setRouteFilter(e.target.value as ServiceRoute | 'all');
                    setPage(1);
                  }}
                  className={selectClass}
                >
                  <option value="all">All services</option>
                  {SERVICE_ROUTES.map((rt) => (
                    <option key={rt} value={rt}>
                      {SERVICE_ROUTE_LABELS[rt]}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Priority"
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value as PriorityLabel | 'all');
                    setPage(1);
                  }}
                  className={selectClass}
                >
                  <option value="all">Any priority</option>
                  {PRIORITY_LABELS.map((p) => (
                    <option key={p} value={p}>
                      {p} priority
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Source"
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value);
                    setPage(1);
                  }}
                  className={selectClass}
                >
                  <option value="all">All sources</option>
                  {availableSources.map((src) => (
                    <option key={src} value={src}>
                      {humanize(src)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Owner"
                  value={ownerFilter}
                  onChange={(e) => {
                    setOwnerFilter(e.target.value);
                    setPage(1);
                  }}
                  className={selectClass}
                >
                  <option value="all">All owners</option>
                  {availableOwners.map((own) => (
                    <option key={own} value={own}>
                      {own}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Follow-up"
                  value={followUpFilter}
                  onChange={(e) => {
                    setFollowUpFilter(e.target.value as 'all' | 'overdue' | 'upcoming' | 'none');
                    setPage(1);
                  }}
                  className={selectClass}
                >
                  <option value="all">Any follow-up</option>
                  <option value="overdue">Overdue</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="none">None scheduled</option>
                </select>

                {(searchQuery ||
                  stageFilter !== 'all' ||
                  routeFilter !== 'all' ||
                  priorityFilter !== 'all' ||
                  sourceFilter !== 'all' ||
                  ownerFilter !== 'all' ||
                  followUpFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setStageFilter('all');
                      setRouteFilter('all');
                      setPriorityFilter('all');
                      setSourceFilter('all');
                      setOwnerFilter('all');
                      setFollowUpFilter('all');
                      setPage(1);
                    }}
                    className="h-9 px-2 text-sm font-medium text-brand hover:text-brand-hover"
                  >
                    Clear filters
                  </button>
                )}

                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-sm text-stone-500 tabular-nums mr-1">
                    {leadsTotal} {leadsTotal === 1 ? 'lead' : 'leads'}
                  </span>
                  <select
                    aria-label="Sort by"
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(
                        e.target.value as
                          | 'created_at'
                          | 'priority_score'
                          | 'last_activity_at'
                          | 'follow_up_at'
                      )
                    }
                    className={selectClass}
                  >
                    <option value="created_at">Newest</option>
                    <option value="priority_score">Priority</option>
                    <option value="last_activity_at">Last activity</option>
                    <option value="follow_up_at">Next follow-up</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
                    aria-label={sortDir === 'desc' ? 'Sorted descending' : 'Sorted ascending'}
                    title={sortDir === 'desc' ? 'Descending' : 'Ascending'}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                  >
                    <ArrowUpDown
                      className={`w-4 h-4 ${sortDir === 'asc' ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>

              {leads.length === 0 ? (
                <div className="bg-white rounded-xl border border-stone-200 px-6 py-16 text-center">
                  <Search className="w-6 h-6 text-stone-300 mx-auto" aria-hidden="true" />
                  <h2 className="mt-3 text-sm font-medium text-stone-900">No leads match</h2>
                  <p className="mt-1 text-sm text-stone-500 max-w-sm mx-auto">
                    Clear the filters, add a lead by hand, or send a test inquiry through the
                    public form.
                  </p>
                  <div className="mt-5 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddLeadModal(true)}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      Add lead
                    </button>
                    <Link href="/inquire" className={ghostButton}>
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      Open inquiry form
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-stone-200 text-xs font-medium text-stone-500 whitespace-nowrap">
                          <th className="py-2.5 pl-5 pr-4 font-medium">Lead</th>
                          <th className="py-2.5 px-4 font-medium">Service</th>
                          <th className="py-2.5 px-4 font-medium">Stage</th>
                          <th className="py-2.5 px-4 font-medium">Priority</th>
                          <th className="py-2.5 px-4 font-medium">Owner</th>
                          <th className="py-2.5 px-4 font-medium">Next step</th>
                          <th className="py-2.5 pl-4 pr-5 font-medium text-right">Last activity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {leads.map((lead) => {
                          const isOverdue =
                            Boolean(lead.follow_up_at) &&
                            new Date(lead.follow_up_at!).getTime() < Date.now() &&
                            !['won', 'lost', 'not_a_fit'].includes(lead.pipeline_stage);
                          return (
                            <tr
                              key={lead.id}
                              onClick={() => setSelectedLeadId(lead.id)}
                              className="group hover:bg-stone-50 cursor-pointer"
                            >
                              <td className="py-3 pl-5 pr-4 max-w-[260px]">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-medium text-stone-900 truncate group-hover:text-brand">
                                    {lead.name}
                                  </span>
                                  {lead.is_demo && (
                                    <span className="text-xs text-stone-400 shrink-0">Demo</span>
                                  )}
                                </div>
                                <div className="text-stone-500 truncate">
                                  {lead.organization || lead.email}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <RouteBadge
                                  suggestedRoute={lead.suggested_route}
                                  selectedRoute={lead.selected_route}
                                  showSourceLabel={false}
                                />
                              </td>
                              <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                <select
                                  aria-label={`Stage for ${lead.name}`}
                                  value={lead.pipeline_stage}
                                  onChange={(e) =>
                                    initiateStageChange(lead, e.target.value as PipelineStage)
                                  }
                                  className="h-8 rounded-md border border-transparent bg-stone-100 pl-2.5 pr-7 text-sm text-stone-800 hover:border-stone-300 focus:border-brand focus:outline-none"
                                >
                                  {PIPELINE_STAGES.map((st) => (
                                    <option key={st} value={st}>
                                      {PIPELINE_STAGE_LABELS[st]}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-3 px-4">
                                <PriorityBadge score={lead.priority_score} label={lead.priority_label} />
                              </td>
                              <td className="py-3 px-4 text-stone-600 max-w-[160px] truncate">
                                {lead.owner_label}
                              </td>
                              <td className="py-3 px-4 max-w-[240px]">
                                <div className="text-stone-800 truncate">{lead.next_action || '—'}</div>
                                {lead.follow_up_at && (
                                  <div
                                    className={`text-xs tabular-nums ${
                                      isOverdue ? 'text-rose-600' : 'text-stone-500'
                                    }`}
                                  >
                                    {isOverdue ? 'Overdue · ' : 'Due '}
                                    {formatShortDate(lead.follow_up_at)}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 pl-4 pr-5 text-right text-stone-500 whitespace-nowrap tabular-nums">
                                {formatShortDate(lead.last_activity_at)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {leadsTotal > pageSize && (
                    <div className="px-5 py-3 border-t border-stone-100 flex items-center justify-between text-sm text-stone-500">
                      <span className="tabular-nums">
                        Page {page} of {Math.max(1, Math.ceil(leadsTotal / pageSize))}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className={ghostButton}
                        >
                          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={page * pageSize >= leadsTotal}
                          onClick={() => setPage((p) => p + 1)}
                          className={ghostButton}
                        >
                          Next
                          <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              TAB 3: PIPELINE / KANBAN
             ================================================================ */}
          {activeTab === 'pipeline' && (
            <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 flex gap-3 overflow-x-auto pb-6 items-start">
              {PIPELINE_STAGES.map((stage) => {
                const stageLeads = allPipelineLeads.filter((l) => l.pipeline_stage === stage);
                const isDropTarget = dragOverStage === stage;

                return (
                  <section
                    key={stage}
                    aria-label={PIPELINE_STAGE_LABELS[stage]}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverStage !== stage) setDragOverStage(stage);
                    }}
                    onDragLeave={() => {
                      if (dragOverStage === stage) setDragOverStage(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverStage(null);
                      if (!draggedLeadId) return;
                      const found = allPipelineLeads.find((l) => l.id === draggedLeadId);
                      setDraggedLeadId(null);
                      if (found) {
                        void initiateStageChange(found, stage);
                      }
                    }}
                    className={`w-[272px] shrink-0 rounded-xl p-2 ${
                      isDropTarget ? 'bg-brand/[0.06] ring-2 ring-inset ring-brand/30' : 'bg-stone-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 px-2 pt-1 pb-2.5">
                      <h2 className="text-sm font-medium text-stone-800">
                        {PIPELINE_STAGE_LABELS[stage]}
                      </h2>
                      <span className="text-sm tabular-nums text-stone-400">{stageLeads.length}</span>
                    </div>

                    <div className="space-y-2 min-h-[96px]">
                      {stageLeads.length === 0 ? (
                        <div className="h-[96px] rounded-lg border border-dashed border-stone-300/80 flex items-center justify-center text-sm text-stone-400">
                          Drop here
                        </div>
                      ) : (
                        stageLeads.map((lead) => (
                          <article
                            key={lead.id}
                            draggable
                            onDragStart={() => setDraggedLeadId(lead.id)}
                            onDragEnd={() => {
                              setDraggedLeadId(null);
                              setDragOverStage(null);
                            }}
                            className={`bg-white rounded-lg border border-stone-200 p-3 hover:border-stone-300 cursor-grab active:cursor-grabbing ${
                              draggedLeadId === lead.id ? 'opacity-50' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedLeadId(lead.id)}
                              className="block w-full text-left group"
                            >
                              <span className="block text-sm font-medium text-stone-900 leading-snug group-hover:text-brand">
                                {lead.name}
                              </span>
                              {lead.organization && (
                                <span className="block text-sm text-stone-500 truncate">
                                  {lead.organization}
                                </span>
                              )}
                              <span className="block mt-2 text-sm text-stone-500 line-clamp-2 leading-relaxed">
                                {lead.ai_summary || lead.challenge}
                              </span>
                            </button>

                            {lead.lost_reason && stage === 'lost' && (
                              <p className="mt-2 text-xs text-rose-700">Lost · {lead.lost_reason}</p>
                            )}

                            <div className="mt-3 flex items-center justify-between gap-2">
                              <RouteBadge
                                suggestedRoute={lead.suggested_route}
                                selectedRoute={lead.selected_route}
                                showSourceLabel={false}
                              />
                              <PriorityBadge score={lead.priority_score} label={lead.priority_label} />
                            </div>

                            <label className="sr-only" htmlFor={`kb-stage-${lead.id}`}>
                              Move {lead.name} to another stage
                            </label>
                            <select
                              id={`kb-stage-${lead.id}`}
                              value={lead.pipeline_stage}
                              onChange={(e) =>
                                initiateStageChange(lead, e.target.value as PipelineStage)
                              }
                              className="mt-2.5 w-full h-8 rounded-md border border-transparent bg-stone-50 pl-2 pr-7 text-xs text-stone-600 hover:border-stone-200 focus:border-brand focus:outline-none"
                            >
                              {PIPELINE_STAGES.map((st) => (
                                <option key={st} value={st}>
                                  {st === lead.pipeline_stage ? 'Move to…' : PIPELINE_STAGE_LABELS[st]}
                                </option>
                              ))}
                            </select>
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {/* ================================================================
              TAB 4: FOLLOW-UPS
             ================================================================ */}
          {activeTab === 'tasks' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div role="tablist" aria-label="Follow-up view" className="inline-flex p-1 rounded-lg bg-stone-100">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'overdue', label: 'Overdue' },
                        { id: 'today', label: 'Today' },
                        { id: 'upcoming', label: 'Upcoming' },
                        { id: 'completed', label: 'Done' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={taskView === tab.id}
                        onClick={() => setTaskView(tab.id)}
                        className={`h-8 px-3 rounded-md text-sm ${
                          taskView === tab.id
                            ? 'bg-white text-stone-900 font-medium ring-1 ring-stone-200'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-sm text-stone-500 tabular-nums">
                    {tasks.length} {tasks.length === 1 ? 'follow-up' : 'follow-ups'}
                  </span>
                </div>

                {tasks.length === 0 ? (
                  <div className="bg-white rounded-xl border border-stone-200 px-6 py-16 text-center">
                    <CheckCircle2 className="w-6 h-6 text-stone-300 mx-auto" aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium text-stone-900">Nothing here</p>
                    <p className="mt-1 text-sm text-stone-500">
                      {taskView === 'overdue'
                        ? 'No follow-ups are overdue.'
                        : 'Create a follow-up from the form or from any lead.'}
                    </p>
                  </div>
                ) : (
                  <ul className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
                    {tasks.map((task) => {
                      const done = task.status === 'completed';
                      const isOverdue = !done && new Date(task.due_at).getTime() < Date.now();
                      return (
                        <li key={task.id} className="px-5 py-3.5 flex items-start gap-3.5">
                          <input
                            type="checkbox"
                            aria-label={`Mark "${task.title}" as done`}
                            checked={done}
                            onChange={(e) => handleToggleTaskStatus(task.id, e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-stone-300 cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-medium ${
                                done ? 'line-through text-stone-400' : 'text-stone-900'
                              }`}
                            >
                              {task.title}
                            </p>
                            {task.notes && !done && (
                              <p className="mt-0.5 text-sm text-stone-500">{task.notes}</p>
                            )}
                            <div className="mt-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-stone-500">
                              <button
                                type="button"
                                onClick={() => setSelectedLeadId(task.lead_id)}
                                className="font-medium text-stone-700 hover:text-brand"
                              >
                                {task.lead_name}
                              </button>
                              <span>{task.owner}</span>
                              <span className={`tabular-nums ${isOverdue ? 'text-rose-600 font-medium' : ''}`}>
                                {isOverdue ? 'Overdue · ' : done ? 'Was due ' : 'Due '}
                                {formatDateTime(task.due_at)}
                              </span>
                            </div>
                          </div>
                          <StageBadge stage={task.lead_stage} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="lg:col-span-4 lg:sticky lg:top-20">
                <form
                  onSubmit={handleCreateTaskInTasksView}
                  className="bg-white rounded-xl border border-stone-200 p-5 space-y-4"
                >
                  <div>
                    <h2 className="text-sm font-semibold text-stone-900">New follow-up</h2>
                    <p className="mt-0.5 text-sm text-stone-500">Reminders only — nothing is sent.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="task-lead-select" className="block text-sm font-medium text-stone-700">
                      Lead
                    </label>
                    <select
                      id="task-lead-select"
                      required
                      value={newTaskLeadId}
                      onChange={(e) => setNewTaskLeadId(e.target.value)}
                      className={`${fieldClass} pr-8`}
                    >
                      {allPipelineLeads.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} — {PIPELINE_STAGE_LABELS[l.pipeline_stage]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="task-title-input" className="block text-sm font-medium text-stone-700">
                      What needs doing
                    </label>
                    <input
                      id="task-title-input"
                      type="text"
                      required
                      placeholder="Send the scoping call agenda"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className={fieldClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="task-due-input" className="block text-sm font-medium text-stone-700">
                      Due
                    </label>
                    <input
                      id="task-due-input"
                      type="datetime-local"
                      required
                      value={newTaskDue}
                      onChange={(e) => setNewTaskDue(e.target.value)}
                      className={fieldClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="task-notes-input" className="block text-sm font-medium text-stone-700">
                      Notes <span className="font-normal text-stone-400">(optional)</span>
                    </label>
                    <textarea
                      id="task-notes-input"
                      rows={2}
                      value={newTaskNotes}
                      onChange={(e) => setNewTaskNotes(e.target.value)}
                      className={`${fieldClass} h-auto py-2`}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full h-9 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover"
                  >
                    Create follow-up
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB 5: ANALYTICS
             ================================================================ */}
          {activeTab === 'analytics' && metrics && (
            <AnalyticsView metrics={metrics} leads={allPipelineLeads} />
          )}

          {/* ================================================================
              TAB 6: SETTINGS
             ================================================================ */}
          {activeTab === 'settings' && settings && runtime && (
            <SettingsView
              settings={settings}
              runtime={runtime}
              onSaved={(updated) => {
                setSettings(updated);
                void fetchAllData();
                void fetchPipelineLeads();
              }}
              onResetDemo={handleResetDemoData}
            />
          )}
        </main>
      </div>

      {/* Lead Detail Drawer */}
      {selectedLeadId && settings && (
        <LeadDetailDrawer
          leadId={selectedLeadId}
          settings={settings}
          onClose={() => setSelectedLeadId(null)}
          onUpdated={() => {
            void fetchAllData();
            void fetchPipelineLeads();
          }}
        />
      )}

      {/* Stage Transition Confirmation Modal (Kanban / Table) */}
      {pendingStageTransition && (
        <StageTransitionModal
          leadName={pendingStageTransition.lead.name}
          currentStage={pendingStageTransition.lead.pipeline_stage}
          targetStage={pendingStageTransition.targetStage}
          currentEstimatedValue={pendingStageTransition.lead.estimated_value}
          onCancel={() => setPendingStageTransition(null)}
          onConfirm={handleConfirmOutcomeStage}
        />
      )}

      {/* Manual Add Lead Modal */}
      {showAddLeadModal && (
        <AddLeadModal
          onClose={() => setShowAddLeadModal(false)}
          onCreated={(newId) => {
            setShowAddLeadModal(false);
            void fetchAllData();
            void fetchPipelineLeads();
            setSelectedLeadId(newId);
            showToast('Created and qualified new lead record.');
          }}
        />
      )}
    </div>
  );
}
