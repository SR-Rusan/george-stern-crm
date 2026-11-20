-- ============================================================================
-- 002 — Versioned CRM store + RLS lockdown
-- ============================================================================
-- The app stores its dataset in public.crm_store (one JSONB document with a
-- version number used for compare-and-swap writes). The app creates this table
-- automatically on first connection; this migration is for teams that prefer
-- to manage schema explicitly.
--
-- Access model: ONLY the Next.js server talks to the database, using the
-- DATABASE_URL connection string (table owner — bypasses RLS). Browsers never
-- query the database directly, so the Supabase `anon` and `authenticated`
-- roles get no access at all.

CREATE TABLE IF NOT EXISTS public.crm_store (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_store ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_store FROM anon, authenticated;

-- The relational tables from 001 are not used by the current app version.
-- Remove the permissive policies so they can't be read through the public API
-- with any signed-in Supabase account.
DROP POLICY IF EXISTS "Authenticated users can manage leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can manage activities" ON public.activities;
DROP POLICY IF EXISTS "Authenticated users can manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can manage settings" ON public.settings;
REVOKE ALL ON public.leads, public.activities, public.tasks, public.settings FROM anon, authenticated;
