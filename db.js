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

// Em ambientes serverless (Vercel), o filesystem do projeto é read-only:
// apenas /tmp é gravável. Se o operador não configurou Turso, caímos para
// um SQLite em /tmp (note que /tmp não persiste entre cold starts — isso
// é apenas um fallback para não derrubar o deploy; use Turso em produção).
const isServerless = !!process.env.VERCEL;
const defaultLocalUrl = isServerless
  ? 'file:/tmp/petcare.db'
  : 'file:./data/petcare.db';

const url =
  process.env.TURSO_DATABASE_URL ||
  process.env.DATABASE_URL ||
  defaultLocalUrl;

const authToken = process.env.TURSO_AUTH_TOKEN;

if (isServerless && !process.env.TURSO_DATABASE_URL && !process.env.DATABASE_URL) {
  console.warn(
    '[db] Rodando no Vercel sem TURSO_DATABASE_URL configurada. ' +
    'Usando SQLite em /tmp (os dados NÃO persistem entre deploys/cold starts). ' +
    'Configure Turso em produção: https://turso.tech'
  );
}

// Para URLs `file:` o libsql não cria diretórios pais automaticamente —
// garantimos que a pasta existe antes de abrir o banco local.
if (url.startsWith('file:')) {
  const filePath = url.slice('file:'.length);
  const dir = path.dirname(filePath);
  if (dir && dir !== '.' && dir !== '/') {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.error(`[db] Não foi possível criar diretório ${dir}:`, err.message);
    }
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
  // Lançamentos financeiros (contas a pagar e a receber) do negócio.
  // Usado na view "Finanças" do dashboard para o operador registrar
  // despesas fixas/variáveis e receitas além dos serviços agendados.
  `CREATE TABLE IF NOT EXISTS finances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('receita', 'despesa')),
    category TEXT,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    due_date TEXT,
    paid INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
  )`,
  // Histórico de mensagens do Assistente IA do dashboard. Mantemos por
  // usuário/negócio para oferecer continuidade de contexto nas próximas
  // perguntas sem pagar re-envio completo de todo o histórico.
  `CREATE TABLE IF NOT EXISTS ai_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
  )`,
  // Waitlist / lista de espera de pré-lançamento. É a captura de lead
  // "honesta" — não promete funcionalidades prontas, apenas reserva a vaga
  // para quando a plataforma abrir para novos negócios.
  `CREATE TABLE IF NOT EXISTS waitlist_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    business_name TEXT,
    business_type TEXT,
    phone TEXT,
    source TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    ip TEXT,
    user_agent TEXT,
    consent_marketing INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id)`,
  `CREATE INDEX IF NOT EXISTS idx_clients_business ON clients(business_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pets_client ON pets(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pets_business ON pets(business_id)`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_business ON appointments(business_id)`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_at)`,
  `CREATE INDEX IF NOT EXISTS idx_finances_business ON finances(business_id)`,
  `CREATE INDEX IF NOT EXISTS idx_finances_due ON finances(due_date)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_messages_user ON ai_messages(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist_leads(created_at)`,
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
