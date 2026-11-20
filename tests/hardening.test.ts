import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { NextRequest } from 'next/server';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

import { middleware } from '@/middleware';
import { getAuthMode, parseOperators } from '@/lib/auth/config';
import { createSessionToken, verifySessionToken } from '@/lib/auth/session';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { sendHumanApprovedEmail, getEmailProviderStatus } from '@/lib/email-adapter';
import { signWebhookPayload, verifyInboundWebhookAuth } from '@/lib/make-webhook';
import { StoreNotConfiguredError } from '@/lib/store-backend';
import {
  addLeadNote,
  createInquiryLead,
  demoToolsEnabled,
  getLeadWithDetails,
  getStorageMode,
  listLeads,
  purgeDemoRecords,
  readStore,
  resetDemoData,
  setTestStoreFilePath,
} from '@/lib/repository';
import { buildSeedDataset } from '@/lib/seed-data';
import { GET as leadsGET } from '@/app/api/leads/route';
import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as demoPOST } from '@/app/api/demo/route';
import { GET as brandingGET } from '@/app/api/public/branding/route';

const SECRET = 'test-session-secret-0123456789abcdef-xyz';
const OPERATOR_EMAIL = 'operator@coach-test.example.com';
const OPERATOR_PASSWORD = 'correct horse battery staple';
const TEST_DB_PATH = path.join(process.cwd(), '.data', `test-hardening-${process.pid}.json`);

let operatorsEnv = '';

beforeAll(async () => {
  operatorsEnv = `${OPERATOR_EMAIL}=${await hashPassword(OPERATOR_PASSWORD)}`;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(() => {
  try {
    fs.unlinkSync(TEST_DB_PATH);
  } catch {
    // ignore
  }
  setTestStoreFilePath(null);
});

function enforceLogin() {
  vi.stubEnv('CRM_OPERATORS', operatorsEnv);
  vi.stubEnv('SESSION_SECRET', SECRET);
}

async function sessionCookie(email = OPERATOR_EMAIL) {
  return `crm_session=${await createSessionToken(email, SECRET, 3600)}`;
}

function req(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
  return new NextRequest(`http://localhost:3000${url}`, init);
}

// ============================================================================
describe('Sessions & passwords', () => {
  it('signs and verifies session tokens; rejects tampering and expiry', async () => {
    const token = await createSessionToken('A@B.com', SECRET, 60);
    expect((await verifySessionToken(token, SECRET))?.sub).toBe('a@b.com');

    const [body, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'evil@x.com', exp: 9999999999 })).toString('base64url');
    expect(await verifySessionToken(`${forged}.${sig}`, SECRET)).toBeNull();
    expect(await verifySessionToken(`${body}.${sig}`, SECRET + 'x')).toBeNull();
    expect(await verifySessionToken(token, SECRET, Date.now() + 61_000)).toBeNull();
    expect(await verifySessionToken('garbage', SECRET)).toBeNull();
  });

  it('hashes passwords with scrypt and verifies them', async () => {
    const hash = await hashPassword('s3cret-pass-phrase');
    expect(hash.startsWith('scrypt.')).toBe(true);
    expect(hash).not.toContain('$'); // .env files expand $VARS
    expect(await verifyPassword('s3cret-pass-phrase', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('hash-password script output verifies with the app (formats stay in sync)', async () => {
    const run = spawnSync(
      process.execPath,
      ['scripts/hash-password.mjs', 'Script@Test.com', '--with-secret'],
      { input: 'a-long-enough-password\n', encoding: 'utf8' }
    );
    expect(run.status).toBe(0);
    const line = run.stdout.split('\n').find((l) => l.startsWith('CRM_OPERATORS='))!;
    const [op] = parseOperators(line.slice('CRM_OPERATORS='.length));
    expect(op.email).toBe('script@test.com');
    expect(await verifyPassword('a-long-enough-password', op.passwordHash)).toBe(true);
    const secretLine = run.stdout.split('\n').find((l) => l.startsWith('SESSION_SECRET='))!;
    expect(secretLine.length).toBeGreaterThan('SESSION_SECRET='.length + 32);
  });

  it('parses multiple operators and ignores malformed entries', () => {
    const ops = parseOperators('a@x.com=scrypt.s.h, bad-entry ,B@Y.com=scrypt.t.k,c@z.com=plain');
    expect(ops.map((o) => o.email)).toEqual(['a@x.com', 'b@y.com']);
  });
});

// ============================================================================
describe('Auth modes & middleware', () => {
  it('stays open for local development when nothing is configured', async () => {
    expect(getAuthMode()).toBe('open_dev');
    const res = await middleware(req('/api/leads'));
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('locks the operator area in production when login is not configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(getAuthMode()).toBe('misconfigured');
    expect((await middleware(req('/api/leads'))).status).toBe(503);
    expect((await middleware(req('/'))).status).toBe(503);
    // the public form still works
    expect((await middleware(req('/inquire'))).headers.get('x-middleware-next')).toBe('1');
    expect(
      (await middleware(req('/api/inquiries', { method: 'POST' }))).headers.get('x-middleware-next')
    ).toBe('1');
  });

  it('requires a valid session when login is configured', async () => {
    enforceLogin();
    expect(getAuthMode()).toBe('enforced');

    expect((await middleware(req('/api/leads'))).status).toBe(401);
    expect((await middleware(req('/api/settings'))).status).toBe(401);
    expect((await middleware(req('/api/inquiries'))).status).toBe(401); // GET is not public

    const page = await middleware(req('/'));
    expect(page.status).toBe(307);
    expect(page.headers.get('location')).toBe('http://localhost:3000/login');

    const deep = await middleware(req('/some/page?x=1'));
    expect(deep.headers.get('location')).toBe(
      'http://localhost:3000/login?next=%2Fsome%2Fpage%3Fx%3D1'
    );

    const ok = await middleware(req('/api/leads', { headers: { cookie: await sessionCookie() } }));
    expect(ok.headers.get('x-middleware-next')).toBe('1');

    const tampered = (await sessionCookie()).slice(0, -3) + 'abc';
    expect((await middleware(req('/api/leads', { headers: { cookie: tampered } }))).status).toBe(401);
  });

  it('blocks cross-site POSTs to operator routes even with a session', async () => {
    enforceLogin();
    const res = await middleware(
      req('/api/leads', {
        method: 'POST',
        headers: { cookie: await sessionCookie(), origin: 'https://evil.example.net' },
      })
    );
    expect(res.status).toBe(403);
  });
});

// ============================================================================
describe('Route-level protection & login API', () => {
  it('operator API routes check the session themselves (not only middleware)', async () => {
    setTestStoreFilePath(TEST_DB_PATH);
    await resetDemoData();
    enforceLogin();

    expect((await leadsGET(req('/api/leads'))).status).toBe(401);
    const ok = await leadsGET(req('/api/leads', { headers: { cookie: await sessionCookie() } }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).data.total).toBe(8);
  });

  it('logs in with correct credentials and sets an httpOnly cookie', async () => {
    enforceLogin();
    const res = await loginPOST(
      req('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
        body: JSON.stringify({ email: OPERATOR_EMAIL.toUpperCase(), password: OPERATOR_PASSWORD }),
      })
    );
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') || '';
    expect(cookie).toContain('crm_session=');
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
  });

  it('rejects wrong passwords with a generic message and rate-limits by email', async () => {
    enforceLogin();
    const attempt = (email: string, ip: string) =>
      loginPOST(
        req('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
          body: JSON.stringify({ email, password: 'wrong-password' }),
        })
      );

    const unknown = await attempt('nobody@example.com', '10.0.0.2');
    const wrong = await attempt('ratelimit@coach-test.example.com', '10.0.0.3');
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect((await unknown.json()).error.message).toBe((await wrong.json()).error.message);

    for (let i = 0; i < 4; i++) await attempt('ratelimit@coach-test.example.com', `10.0.1.${i}`);
    expect((await attempt('ratelimit@coach-test.example.com', '10.0.2.1')).status).toBe(429);
  });
});

// ============================================================================
describe('Storage safety & demo tools', () => {
  it('refuses to use the local file store in production without a database', async () => {
    setTestStoreFilePath(null);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_URL', '');
    expect(getStorageMode()).toBe('not_configured');
    await expect(readStore()).rejects.toBeInstanceOf(StoreNotConfiguredError);

    const res = await brandingGET();
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('STORAGE_NOT_CONFIGURED');
  });

  it('disables demo reset/replay in production but allows removing demo leads', async () => {
    setTestStoreFilePath(TEST_DB_PATH);
    await resetDemoData();
    vi.stubEnv('NODE_ENV', 'production');
    enforceLogin();
    expect(demoToolsEnabled()).toBe(false);

    const cookie = await sessionCookie();
    const post = (action: string) =>
      demoPOST(
        req('/api/demo', {
          method: 'POST',
          headers: { cookie, 'content-type': 'application/json' },
          body: JSON.stringify({ action }),
        })
      );
    expect((await post('reset')).status).toBe(403);
    expect((await post('replay')).status).toBe(403);

    const purge = await post('purge_demo');
    expect(purge.status).toBe(200);
    expect((await purge.json()).data.removed_leads).toBe(8);
    expect((await readStore()).leads).toHaveLength(0);
  });

  it('keeps every concurrent write in the local file store', async () => {
    setTestStoreFilePath(TEST_DB_PATH);
    await resetDemoData();
    const leadId = (await readStore()).leads[0].id;
    await Promise.all(
      Array.from({ length: 12 }, (_, i) => addLeadNote(leadId, `parallel note ${i}`, 'Tester'))
    );
    const notes = (await getLeadWithDetails(leadId))!.lead.notes;
    for (let i = 0; i < 12; i++) expect(notes).toContain(`parallel note ${i}`);
  });
});

// ============================================================================
describe('Postgres storage (PGlite over the real Postgres wire protocol)', () => {
  const port = 41000 + (process.pid % 20000);
  let db: PGlite;
  let server: PGLiteSocketServer;

  beforeAll(async () => {
    db = await PGlite.create();
    server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });
    await server.start();
    // Reset the cached backend once. PGlite's socket server serves a single
    // live session, so the tests must keep reusing one connection pool.
    setTestStoreFilePath(null);
  });

  afterAll(async () => {
    await server?.stop();
    await db?.close();
  });

  function usePostgres() {
    vi.stubEnv('DATABASE_URL', `postgres://postgres:postgres@127.0.0.1:${port}/postgres`);
    vi.stubEnv('DATABASE_POOL_MAX', '1'); // PGlite serves one session at a time
  }

  it('creates the table and starts empty (no demo data) on a fresh database', async () => {
    usePostgres();
    expect(getStorageMode()).toBe('postgres');
    const store = await readStore();
    expect(store.leads).toHaveLength(0);
    expect(store.settings.business_name).toBeTruthy();

    const rls = await db.query<{ relrowsecurity: boolean }>(
      `SELECT relrowsecurity FROM pg_class WHERE relname = 'crm_store'`
    );
    expect(rls.rows[0].relrowsecurity).toBe(true);
  });

  it('persists inquiries, qualification and notes to Postgres', async () => {
    usePostgres();
    const { lead, duplicate_prevented } = await createInquiryLead({
      name: 'Real Prospect',
      email: 'prospect@realco.test',
      organization: 'RealCo',
      role_type: 'hr_ld',
      team_size_range: '16-50',
      requested_service: 'corporate_training',
      challenge: 'We need a leadership program for 20 new managers this quarter.',
      timing: 'now',
      source: 'public_inquiry_form',
      referrer: '',
      consent_response: true,
      marketing_email_consent: true,
      website_url_hp: '',
    });
    expect(duplicate_prevented).toBe(false);
    expect(lead.qualification_status).toBe('mock_completed');

    const listed = await listLeads();
    expect(listed.total).toBe(1);
    expect(listed.leads[0].email).toBe('prospect@realco.test');

    const row = await db.query<{ version: number; n: number }>(
      `SELECT version, jsonb_array_length(data->'leads') AS n FROM crm_store WHERE id = 'default'`
    );
    expect(row.rows[0].n).toBe(1);
    expect(row.rows[0].version).toBeGreaterThanOrEqual(2); // insert + qualification

    await Promise.all(
      Array.from({ length: 10 }, (_, i) => addLeadNote(lead.id, `pg note ${i}`, 'Tester'))
    );
    const notes = (await getLeadWithDetails(lead.id))!.lead.notes;
    for (let i = 0; i < 10; i++) expect(notes).toContain(`pg note ${i}`);
  });

  it('only removes demo-flagged leads when purging', async () => {
    usePostgres();
    await createInquiryLead(
      {
        name: 'Demo Person',
        email: 'demo@demo.example.com',
        organization: '',
        role_type: 'manager',
        team_size_range: '',
        requested_service: 'one_to_one_coaching',
        challenge: 'Demo challenge text for testing the purge.',
        timing: 'later',
        source: 'demo',
        referrer: '',
        consent_response: true,
        marketing_email_consent: false,
        website_url_hp: '',
      },
      { is_demo: true }
    );
    expect((await listLeads()).total).toBe(2);
    expect((await purgeDemoRecords()).removed_leads).toBe(1);
    const remaining = await listLeads();
    expect(remaining.total).toBe(1);
    expect(remaining.leads[0].email).toBe('prospect@realco.test');
  });
});

// ============================================================================
describe('Email sending via Resend', () => {
  const realLead = { ...buildSeedDataset().leads[0], is_demo: false, marketing_email_consent: true };

  function configureResend(from = 'hello@coach-domain.test') {
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    vi.stubEnv('EMAIL_API_KEY', 're_test_key_123456');
    vi.stubEnv('EMAIL_FROM_ADDRESS', from);
    vi.stubEnv('EMAIL_REPLY_TO', 'coach@coach-domain.test');
  }

  it('sends through the Resend API with the right request', async () => {
    configureResend();
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'email_abc123' }), { status: 200 })
    );
    const result = await sendHumanApprovedEmail({
      lead: realLead,
      subject: 'Following up',
      body: 'Hello there, thanks for reaching out.',
      humanConfirmed: true,
      fromName: 'Coach "Inc" <x>',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toMatchObject({ sent: true, provider: 'resend', message_id: 'email_abc123' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer re_test_key_123456');
    expect(headers['Idempotency-Key']).toMatch(/^lead-/);
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      from: 'Coach Inc x <hello@coach-domain.test>',
      to: [realLead.email],
      subject: 'Following up',
      reply_to: 'coach@coach-domain.test',
    });
  });

  it('reports provider rejections instead of pretending the email was sent', async () => {
    configureResend();
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ message: 'The domain is not verified.' }), { status: 403 })
    );
    const result = await sendHumanApprovedEmail({
      lead: realLead,
      subject: 'Following up',
      body: 'Hello there, thanks for reaching out.',
      humanConfirmed: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.sent).toBe(false);
    expect(result.mode).toBe('provider_error');
    expect(result.error).toContain('domain is not verified');
  });

  it('never calls the provider for demo leads, missing consent or bad config', async () => {
    const fetchImpl = vi.fn();
    configureResend();
    for (const lead of [
      { ...realLead, is_demo: true },
      { ...realLead, marketing_email_consent: false },
    ]) {
      const r = await sendHumanApprovedEmail({
        lead,
        subject: 'Hi there',
        body: 'Body text long enough',
        humanConfirmed: true,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r.sent).toBe(false);
    }

    configureResend('inquiries@example.com');
    expect(getEmailProviderStatus().configured).toBe(false);
    vi.stubEnv('EMAIL_PROVIDER', 'smtp');
    expect(getEmailProviderStatus().problem).toContain('not supported');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

// ============================================================================
describe('Make.com inbound webhook auth', () => {
  it('accepts the shared secret or a valid HMAC signature, rejects everything else', () => {
    const secret = 'make-secret-0123456789';
    const rawBody = '{"name":"x"}';
    const sig = `sha256=${signWebhookPayload(rawBody, secret)}`;
    const check = (headerSecret: string | null, signatureHeader: string | null) =>
      verifyInboundWebhookAuth({ rawBody, secret, headerSecret, signatureHeader });

    expect(check(secret, null)).toBe(true);
    expect(check(null, sig)).toBe(true);
    expect(check('wrong', null)).toBe(false);
    expect(check(null, sig.slice(0, -1) + '0')).toBe(false);
    expect(check(null, null)).toBe(false);
    expect(verifyInboundWebhookAuth({ rawBody, secret: '', headerSecret: '', signatureHeader: null })).toBe(false);
  });
});
