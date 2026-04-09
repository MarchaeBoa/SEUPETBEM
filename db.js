/**
 * Inicialização e schema do banco SQLite.
 * Cria o arquivo e as tabelas automaticamente na primeira execução.
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Em serverless (Vercel) o sistema de arquivos é somente leitura, exceto /tmp.
// Usamos /tmp como fallback para que a aplicação suba sem crashar. ATENÇÃO:
// /tmp é efêmero entre invocações — para produção, use um banco gerenciado.
const DEFAULT_DB_PATH = process.env.VERCEL
  ? '/tmp/petcare.db'
  : path.join(__dirname, 'data', 'petcare.db');

const DB_PATH = process.env.DATABASE_PATH || DEFAULT_DB_PATH;

// Garante que a pasta do banco existe
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
// WAL não é suportado em /tmp em todos os ambientes serverless; mantemos
// o modo padrão (DELETE) quando rodando no Vercel.
if (!process.env.VERCEL) {
  db.pragma('journal_mode = WAL');
}
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'starter',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pets (
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
  );

  CREATE TABLE IF NOT EXISTS appointments (
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
  );

  CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id);
  CREATE INDEX IF NOT EXISTS idx_clients_business ON clients(business_id);
  CREATE INDEX IF NOT EXISTS idx_pets_client ON pets(client_id);
  CREATE INDEX IF NOT EXISTS idx_pets_business ON pets(business_id);
  CREATE INDEX IF NOT EXISTS idx_appointments_business ON appointments(business_id);
  CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_at);
`);

module.exports = db;
