import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/lib/auth-schema';

const isPooler = (process.env.DATABASE_URL ?? '').includes('pooler.supabase.com');

const client = postgres(process.env.DATABASE_URL!, {
  max: isPooler ? 5 : 10,
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
