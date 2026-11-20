-- ============================================================================
-- George Stern Leadership CRM — Initial Postgres Schema & RLS Migration
-- ============================================================================
-- Note: This schema supports the full lead qualification CRM. When Supabase
-- credentials are not configured locally, the application uses an isolated
-- JSON persistence store (.data/db.json) with identical data structures.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Leads Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,

  -- Contact & Inquiry Details
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2 AND char_length(name) <= 120),
  email TEXT NOT NULL CHECK (char_length(trim(email)) >= 5 AND char_length(email) <= 254),
  organization TEXT,
  role_type TEXT NOT NULL CHECK (role_type IN ('manager', 'founder_executive', 'hr_ld', 'other')),
  team_size_range TEXT CHECK (team_size_range IS NULL OR team_size_range IN ('1-5', '6-15', '16-50', '51-200', '200+', '')),
  requested_service TEXT NOT NULL CHECK (requested_service IN ('one_to_one_coaching', 'group_program', 'corporate_training', 'speaking', 'not_sure')),
  challenge TEXT NOT NULL CHECK (char_length(trim(challenge)) >= 10 AND char_length(challenge) <= 1000),
  timing TEXT NOT NULL CHECK (timing IN ('now', 'within_3_months', 'later', 'exploring')),
  source TEXT NOT NULL DEFAULT 'direct_inquiry',
  referrer TEXT,

  -- Consent & Privacy Audit
  consent_response BOOLEAN NOT NULL DEFAULT TRUE CHECK (consent_response = TRUE),
  consent_response_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marketing_email_consent BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_email_consent_at TIMESTAMPTZ,

  -- Pipeline & Routing (AI suggestion separated from human selection)
  pipeline_stage TEXT NOT NULL DEFAULT 'new_inquiry' CHECK (
    pipeline_stage IN (
      'new_inquiry',
      'needs_review',
      'qualified',
      'contacted',
      'call_booked',
      'offer_sent',
      'won',
      'lost',
      'not_a_fit'
    )
  ),
  suggested_route TEXT NOT NULL DEFAULT 'review' CHECK (
    suggested_route IN (
      'one_to_one_coaching',
      'group_program',
      'corporate_training',
      'speaking',
      'review'
    )
  ),
  selected_route TEXT CHECK (
    selected_route IS NULL OR selected_route IN (
      'one_to_one_coaching',
      'group_program',
      'corporate_training',
      'speaking',
      'review'
    )
  ),

  -- Deterministic Priority Scoring (0 to 8)
  priority_score INTEGER NOT NULL DEFAULT 0 CHECK (priority_score >= 0 AND priority_score <= 8),
  priority_label TEXT NOT NULL DEFAULT 'Low' CHECK (priority_label IN ('Low', 'Medium', 'High')),
  score_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- AI Qualification Output
  ai_summary TEXT,
  ai_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_missing_information JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_confidence NUMERIC(4,3) CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)),
  ai_suggested_next_action TEXT,
  ai_model TEXT,
  qualification_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    qualification_status IN ('pending', 'completed', 'mock_completed', 'failed', 'pending_retry')
  ),
  qualification_updated_at TIMESTAMPTZ,
  qualification_error TEXT,
  reviewed_by_human BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,

  -- CRM Operations & Outcome
  owner_label TEXT NOT NULL DEFAULT 'Advisory Intake Team',
  next_action TEXT,
  follow_up_at TIMESTAMPTZ,
  estimated_value NUMERIC(12,2) CHECK (estimated_value IS NULL OR estimated_value >= 0),
  won_at TIMESTAMPTZ,
  lost_reason TEXT,
  notes TEXT NOT NULL DEFAULT '',
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON public.leads(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_suggested_route ON public.leads(suggested_route);
CREATE INDEX IF NOT EXISTS idx_leads_priority_score ON public.leads(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up_at ON public.leads(follow_up_at);

-- ----------------------------------------------------------------------------
-- 2. Activities Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system')),
  actor_label TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'lead_created',
      'qualification_completed',
      'qualification_failed',
      'lead_reviewed',
      'route_changed',
      'stage_changed',
      'note_added',
      'followup_scheduled',
      'task_created',
      'task_completed',
      'email_drafted',
      'email_sent',
      'lead_updated'
    )
  ),
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON public.activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities(created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Tasks Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 2 AND char_length(title) <= 200),
  due_at TIMESTAMPTZ NOT NULL,
  owner TEXT NOT NULL DEFAULT 'Advisory Intake Team',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON public.tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON public.tasks(due_at ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- ----------------------------------------------------------------------------
-- 4. Non-Secret Settings Table
-- ----------------------------------------------------------------------------
-- IMPORTANT: Never store API keys or secrets in this table. Secrets must stay
-- exclusively in server-side environment variables.
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  business_name TEXT NOT NULL DEFAULT 'George Stern Leadership',
  brand_accent TEXT NOT NULL DEFAULT '#1B4332',
  brand_tagline TEXT NOT NULL DEFAULT 'Leadership Coaching, Manager Development & Organizational Training',
  default_owner TEXT NOT NULL DEFAULT 'Coaching Practice Lead',
  booking_url_placeholder TEXT NOT NULL DEFAULT 'https://cal.example.com/leadership-discovery-placeholder',
  data_retention_days INTEGER NOT NULL DEFAULT 365 CHECK (data_retention_days >= 30 AND data_retention_days <= 3650),
  offers JSONB NOT NULL DEFAULT '[]'::jsonb,
  score_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_templates JSONB NOT NULL DEFAULT '[]'::jsonb,
  webhook_events JSONB NOT NULL DEFAULT '["lead.created", "lead.qualified"]'::jsonb
);

-- ----------------------------------------------------------------------------
-- 5. Updated_at Trigger Function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.settings;
CREATE TRIGGER trg_settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Row-Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Authenticated CRM operators can read and manage CRM records
CREATE POLICY "Authenticated users can manage leads"
  ON public.leads FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage activities"
  ON public.activities FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage tasks"
  ON public.tasks FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage settings"
  ON public.settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
