import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/lib/auth-schema';

// Supabase connection pooler (PgBouncer in transaction mode) uses a different
// hostname. Transaction mode requires prepared statements to be disabled.
// See: https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
const isPooler = (process.env.DATABASE_URL ?? '').includes('pooler.supabase.com');

// CLOUD-031: Tune pool size to avoid exhausting Supabase connection limits.
// PgBouncer pooler: max 2 per replica (multiplexing handles the rest).
// Direct connection: max 5 (was 10; reduces risk at 7+ replicas).
const client = postgres(process.env.DATABASE_URL!, {
  max: isPooler ? 2 : 5,
  idle_timeout: 20,
  connect_timeout: 10,
  max_lifetime: 60 * 30,
  ssl: 'require',
  connection: {
    statement_timeout: 30000,
  },
  ...(isPooler ? { prepare: false } : {}),
});

export const db = drizzle({ client, schema });
