import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { resolveClientConfig, client } from '@/config/client';
import { contrastWithWhite, SERVICE_SLOTS } from '@/config/schema';
import { composeEmailDraft } from '@/lib/email-adapter';
import { buildSeedDataset } from '@/lib/seed-data';

const clientsDir = path.join(process.cwd(), 'clients');
const clientIds = fs
  .readdirSync(clientsDir)
  .filter((f) => f.endsWith('.ts') && !f.startsWith('_'))
  .map((f) => f.replace(/\.ts$/, ''))
  .filter((id) => !process.env.CHECK_CLIENT_ID || id === process.env.CHECK_CLIENT_ID);

async function loadRaw(id: string) {
  return (await import(path.join(clientsDir, `${id}.ts`))).default;
}

describe('Client profiles (/clients)', () => {
  it.each(clientIds)('%s is valid, complete and matches its file name', async (id) => {
    const source = fs.readFileSync(path.join(clientsDir, `${id}.ts`), 'utf8');
    expect(source, 'template placeholders left in the file').not.toMatch(/REPLACE/);

    const resolved = resolveClientConfig(await loadRaw(id));
    expect(resolved.id).toBe(id);
    expect(resolved.enabledServices.length).toBeGreaterThan(0);
    expect(contrastWithWhite(resolved.brand.accent)).toBeGreaterThanOrEqual(4.5);
    // every enabled service has an email template (specific or generic)
    for (const slot of resolved.enabledServices) {
      expect(
        resolved.emailTemplates.some((t) => t.route === slot || t.route === 'general'),
        `no email template for ${slot}`
      ).toBe(true);
    }
  });

  it('the template file still type-checks and imports', async () => {
    expect((await import(path.join(clientsDir, '_template.ts'))).default.business).toBeTruthy();
  });

  it('the active client is one of the client files', () => {
    expect(fs.readdirSync(clientsDir)).toContain(`${client.id}.ts`);
  });
});

describe('Client config rules', () => {
  const base = async () => structuredClone(await loadRaw(client.id));

  it('rejects brand colours too light for white button text', async () => {
    const raw = await base();
    raw.brand.accent = '#F5D90A';
    expect(() => resolveClientConfig(raw)).toThrow(/too light/);
  });

  it('rejects unknown email placeholders with a clear message', async () => {
    const raw = await base();
    raw.emailTemplates = [
      { id: 'tpl_x', name: 'X', route: 'review', subject: 'Hi {{first_name}}', body: 'Hello there {{lead_name}}' },
    ];
    expect(() => resolveClientConfig(raw)).toThrow(/Unknown placeholder\(s\) \{\{first_name\}\}/);
  });

  it('requires at least one enabled service', async () => {
    const raw = await base();
    for (const slot of SERVICE_SLOTS) raw.services[slot].enabled = false;
    expect(() => resolveClientConfig(raw)).toThrow(/At least one service/);
  });

  it('generates follow-up templates when a client gives none', async () => {
    const raw = await base();
    delete raw.emailTemplates;
    raw.services.speaking.enabled = false;
    const resolved = resolveClientConfig(raw);
    const routes = resolved.emailTemplates.map((t) => t.route);
    expect(routes).toEqual([...resolved.enabledServices, 'review']);
    expect(routes).not.toContain('speaking');
  });

  it('client values flow into settings, offers and email drafts', () => {
    const { settings, leads } = buildSeedDataset();
    expect(settings.business_name).toBe(client.business.name);
    expect(settings.brand_accent).toBe(client.brand.accent);
    expect(settings.default_owner).toBe(client.business.ownerLabel);
    expect(settings.booking_url_placeholder).toBe(client.links.bookingUrl);
    expect(settings.offers.filter((o) => o.active && o.route !== 'review').map((o) => o.route)).toEqual(
      client.enabledServices
    );

    const draft = composeEmailDraft(leads[0], settings);
    expect(draft.body).toContain(client.business.name);
    expect(draft.body).not.toMatch(/\{\{/); // every placeholder filled
  });
});
