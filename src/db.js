const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const templates = require('./templates');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'rent_reminder.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      rent_amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      due_day INTEGER NOT NULL DEFAULT 15,
      vs_type TEXT DEFAULT 'auto',
      custom_vs TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      year_month TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      paid_date TEXT,
      note TEXT,
      UNIQUE(tenant_id, year_month),
      FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminder_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      year_month TEXT NOT NULL,
      reminder_type TEXT NOT NULL,
      sent_to TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL,
      error_message TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Default settings
  const defaultSettings = {
    smtp_host: '',
    smtp_port: '587',
    smtp_secure: 'false',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    bank_account: '',
    bank_code: '',
    bank_iban: '',
    bank_swift: '',
    days_before_due: '3',
    days_after_due: '2',
    email_template_before: templates.en.before,
    email_template_after: templates.en.after
  };

  const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const setStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const updateStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = getStmt.get(key);
    if (!existing) {
      setStmt.run(key, value);
    } else if (key === 'email_template_before' || key === 'email_template_after') {
      // Force update if still containing old Czech default
      if (existing.value.includes('Vážený/á') || existing.value.includes('připomínáme nadcházející')) {
        updateStmt.run(key, value);
      }
    }
  }
}

initDb();

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

function updateSettings(newSettings) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const transaction = db.transaction((settingsObj) => {
    for (const [key, value] of Object.entries(settingsObj)) {
      stmt.run(key, String(value ?? ''));
    }
  });
  transaction(newSettings);
}

function generateVS(tenant, yearMonth) {
  if (tenant.vs_type === 'custom' && tenant.custom_vs && tenant.custom_vs.trim() !== '') {
    return tenant.custom_vs.trim();
  }
  // Auto mode: YYYYMM + 4-digit padded tenant ID (e.g. 2026070001)
  const cleanYM = (yearMonth || '').replace('-', '');
  const paddedId = String(tenant.id).padStart(4, '0');
  return `${cleanYM}${paddedId}`;
}

module.exports = {
  db,
  getSettings,
  updateSettings,
  generateVS
};
