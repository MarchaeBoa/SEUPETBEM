/**
 * Cliente Postgres (Neon) + inicialização idempotente do schema.
 *
 * Usamos o driver HTTP `@neondatabase/serverless`, que é o indicado para
 * ambientes serverless (Vercel, Cloudflare Workers etc.): não abre conexões
 * persistentes, não precisa de pool e funciona sobre fetch.
 */
const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL não definida. Configure a variável de ambiente com a ' +
      'connection string do Neon (ex.: postgresql://user:pass@host/db?sslmode=require).'
  );
}

const sql = neon(DATABASE_URL);

/**
 * Executa uma query parametrizada ($1, $2, ...) e retorna sempre um array de linhas.
 * Compatível tanto com o modo default quanto com `fullResults: true`.
 */
async function query(text, params = []) {
  const result = await sql.query(text, params);
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

/** Retorna a primeira linha ou `null`. */
async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] || null;
}

// ─── Schema ───────────────────────────────────────────────────────────────
// Criação idempotente do schema. Roda no máximo uma vez por instância da
// function (cold-start). Requisições paralelas compartilham a mesma Promise.
let schemaReadyPromise = null;

function ensureSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS businesses (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          plan TEXT NOT NULL DEFAULT 'starter',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'owner',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS clients (
          id SERIAL PRIMARY KEY,
          business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS pets (
          id SERIAL PRIMARY KEY,
          business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          species TEXT NOT NULL,
          breed TEXT,
          birth_date TEXT,
          weight REAL,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS appointments (
          id SERIAL PRIMARY KEY,
          business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
          service TEXT NOT NULL,
          scheduled_at TIMESTAMPTZ NOT NULL,
          status TEXT NOT NULL DEFAULT 'agendado',
          price REAL NOT NULL DEFAULT 0,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_clients_business ON clients(business_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_pets_client ON pets(client_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_pets_business ON pets(business_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_appointments_business ON appointments(business_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_at)`;
    })().catch((err) => {
      // Em caso de falha, zera o cache para tentar de novo na próxima requisição.
      schemaReadyPromise = null;
      throw err;
    });
  }
  return schemaReadyPromise;
}

module.exports = { sql, query, queryOne, ensureSchema };
