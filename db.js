/**
 * Cliente de banco via @libsql/client (Turso).
 *
 * - Em produção (Vercel): usa Turso — banco SQLite distribuído gerenciado.
 *   Basta configurar TURSO_DATABASE_URL e TURSO_AUTH_TOKEN.
 * - Em desenvolvimento: se as variáveis do Turso não estiverem definidas,
 *   cai num arquivo SQLite local (`file:./data/petcare.db`), o que mantém
 *   o fluxo de `npm start` sem dependências externas.
 *
 * A API do libsql é assíncrona: todas as queries retornam `Promise`. Quem
 * importar este módulo deve usar `await db.execute(...)`.
 */
const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

const url =
  process.env.TURSO_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'file:./data/petcare.db';

const authToken = process.env.TURSO_AUTH_TOKEN;

// Para URLs `file:` o libsql não cria diretórios pais automaticamente —
// garantimos que a pasta existe antes de abrir o banco local. No Vercel,
// onde só /tmp é gravável, recomende Turso (TURSO_DATABASE_URL) ou use um
// caminho em /tmp via DATABASE_URL.
if (url.startsWith('file:')) {
  const filePath = url.slice('file:'.length);
  const dir = path.dirname(filePath);
  if (dir && dir !== '.') {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const db = createClient({ url, authToken });

// Declarações do schema. Cada entrada é executada isoladamente porque
// `db.execute` aceita apenas uma statement por chamada.
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'starter',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS pets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    species TEXT NOT NULL,
    breed TEXT,
    birth_date TEXT,
    weight REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    pet_id INTEGER NOT NULL,
    service TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'agendado',
    price REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id)`,
  `CREATE INDEX IF NOT EXISTS idx_clients_business ON clients(business_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pets_client ON pets(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pets_business ON pets(business_id)`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_business ON appointments(business_id)`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_at)`,
];

// Memoiza a inicialização: no ambiente serverless do Vercel, cada cold
// start chama `init()` uma única vez e as invocações seguintes reusam a
// mesma Promise (resolvida).
let initPromise = null;
function init() {
  if (!initPromise) {
    initPromise = (async () => {
      for (const stmt of SCHEMA_STATEMENTS) {
        await db.execute(stmt);
      }
    })().catch((err) => {
      // Em caso de falha, limpa o cache para permitir nova tentativa
      // na próxima requisição (ex.: falha transitória de rede).
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

module.exports = { db, init };
