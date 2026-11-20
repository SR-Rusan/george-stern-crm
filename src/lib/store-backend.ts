import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

/**
 * Persistence backends for the CRM dataset.
 *
 * The CRM keeps its whole dataset (leads, activities, tasks, settings) as one
 * JSON document. Writes are serialised: Postgres takes a row lock
 * (SELECT ... FOR UPDATE) for the read-modify-write, so concurrent requests
 * queue instead of overwriting each other.
 *
 * - `postgres`   — production. Any Postgres (Supabase, Neon, RDS...) via DATABASE_URL.
 * - `local_file` — local development / demos only (.data/db.json).
 */

export interface StoreSnapshot<T> {
  data: T;
  version: number;
}

export class StoreNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreNotConfiguredError';
  }
}

export interface StoreBackend<T> {
  readonly kind: 'postgres' | 'local_file';
  /** Returns null when no dataset has been initialised yet. */
  load(): Promise<StoreSnapshot<T> | null>;
  /** Creates the dataset if it does not exist yet. No-op when it already exists. */
  initialize(data: T): Promise<void>;
  /**
   * Atomic read-modify-write. `mutator` edits the data in place and returns a
   * result; returning null means "nothing changed" and skips the write.
   * `mutator` must be synchronous.
   */
  mutate<R>(mutator: (data: T) => R | null): Promise<R | null>;
}

// ============================================================================
// Postgres backend
// ============================================================================

const STORE_ROW_ID = 'default';

export const POSTGRES_STORE_DDL = `
CREATE TABLE IF NOT EXISTS public.crm_store (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.crm_store ENABLE ROW LEVEL SECURITY;
`;

function shouldUseSsl(databaseUrl: string): false | 'require' {
  const mode = (process.env.DATABASE_SSL || '').trim().toLowerCase();
  if (mode === 'disable' || mode === 'false') return false;
  if (mode === 'require' || mode === 'true') return 'require';
  try {
    const host = new URL(databaseUrl).hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
  } catch {
    // fall through to secure default
  }
  return 'require';
}

export function createPostgresBackend<T>(databaseUrl: string): StoreBackend<T> {
  const sql = postgres(databaseUrl, {
    // Small pool: serverless functions run many short-lived instances.
    max: Number(process.env.DATABASE_POOL_MAX || 3),
    idle_timeout: 20,
    connect_timeout: 10,
    // Required for transaction-mode poolers (Supabase port 6543, PgBouncer).
    prepare: false,
    ssl: shouldUseSsl(databaseUrl),
    onnotice: () => {},
  });

  let schemaReady: Promise<void> | null = null;
  const ensureSchema = () => {
    if (!schemaReady) {
      schemaReady = sql.unsafe(POSTGRES_STORE_DDL).then(() => undefined);
      schemaReady.catch(() => {
        schemaReady = null;
      });
    }
    return schemaReady;
  };

  return {
    kind: 'postgres',

    async load() {
      await ensureSchema();
      const rows = await sql<{ version: number; data: T }[]>`
        SELECT version, data FROM public.crm_store WHERE id = ${STORE_ROW_ID}
      `;
      if (rows.length === 0) return null;
      return { data: rows[0].data, version: Number(rows[0].version) };
    },

    async initialize(data) {
      await ensureSchema();
      await sql`
        INSERT INTO public.crm_store (id, version, data)
        VALUES (${STORE_ROW_ID}, 0, ${sql.json(data as never)})
        ON CONFLICT (id) DO NOTHING
      `;
    },

    async mutate<R>(mutator: (data: T) => R | null): Promise<R | null> {
      await ensureSchema();
      const outcome = await sql.begin(async (tx) => {
        const rows = await tx<{ data: T }[]>`
          SELECT data FROM public.crm_store WHERE id = ${STORE_ROW_ID} FOR UPDATE
        `;
        if (rows.length === 0) {
          throw new Error('The CRM data store has not been initialised.');
        }
        const data = rows[0].data;
        const result = mutator(data);
        if (result === null) return { result: null };
        await tx`
          UPDATE public.crm_store
          SET data = ${tx.json(data as never)},
              version = version + 1,
              updated_at = NOW()
          WHERE id = ${STORE_ROW_ID}
        `;
        return { result };
      });
      return (outcome as { result: R | null }).result;
    },
  };
}

// ============================================================================
// Local JSON file backend (development / demo only)
// ============================================================================

interface LocalFileEnvelope<T> {
  version: number;
  data: T;
}

export function createLocalFileBackend<T>(filePath: string): StoreBackend<T> {
  // In-memory copy keeps the demo usable when the filesystem is read-only.
  let memory: LocalFileEnvelope<T> | null = null;

  const readFile = (): LocalFileEnvelope<T> | null => {
    try {
      if (!fs.existsSync(filePath)) return memory;
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      // Legacy files (pre-versioning) stored the dataset at the top level.
      if (parsed && typeof parsed.version === 'number' && parsed.data) {
        return parsed as LocalFileEnvelope<T>;
      }
      if (parsed && Array.isArray(parsed.leads)) {
        return { version: 0, data: parsed as T };
      }
      return memory;
    } catch {
      return memory;
    }
  };

  const writeFile = (envelope: LocalFileEnvelope<T>) => {
    memory = envelope;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), 'utf8');
    } catch {
      // read-only filesystem: keep the in-memory copy
    }
  };

  return {
    kind: 'local_file',

    async load() {
      const envelope = readFile();
      return envelope ? { data: envelope.data, version: envelope.version } : null;
    },

    async initialize(data) {
      if (!readFile()) writeFile({ version: 0, data });
    },

    async mutate<R>(mutator: (data: T) => R | null): Promise<R | null> {
      // Read, change and write with no await in between: atomic within the
      // single Node process that owns the file.
      const current = readFile();
      if (!current) throw new Error('The CRM data store has not been initialised.');
      const data = structuredClone(current.data);
      const result = mutator(data);
      if (result === null) return null;
      writeFile({ version: current.version + 1, data });
      return result;
    },
  };
}
