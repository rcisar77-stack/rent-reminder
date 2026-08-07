const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// Use temp test database
const testDbPath = path.join(__dirname, 'test_rent_reminder.db');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}
process.env.DB_PATH = testDbPath;

const { db, getSettings, updateSettings, generateVS } = require('../src/db');
const { runSchedulerCheck } = require('../src/scheduler');
const { replaceVariables } = require('../src/mailer');

test.after(() => {
  db.close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

test('1. Database Initialization and Settings', () => {
  const settings = getSettings();
  assert.equal(settings.days_before_due, '3');
  assert.equal(settings.days_after_due, '2');
  assert.ok(settings.email_template_before.includes('{TENANT}'));
});

test('2. Variable Symbol Generation (Auto vs Custom)', () => {
  const tenantAuto = { id: 5, vs_type: 'auto', custom_vs: null };
  const vsAuto = generateVS(tenantAuto, '2026-07');
  assert.equal(vsAuto, '2026070005', 'Auto VS should be YYYYMM + 0005');

  const tenantCustom = { id: 5, vs_type: 'custom', custom_vs: '99887766' };
  const vsCustom = generateVS(tenantCustom, '2026-07');
  assert.equal(vsCustom, '99887766', 'Custom VS should match custom_vs field exactly');
});

test('3. Template Variable Replacement', () => {
  const template = 'Hello {TENANT}, please pay {AMOUNT} {CURRENCY} with ref {VS}.';
  const result = replaceVariables(template, {
    TENANT: 'John Smith',
    AMOUNT: '1,500',
    CURRENCY: 'USD',
    VS: '2026070001'
  });

  assert.equal(result, 'Hello John Smith, please pay 1,500 USD with ref 2026070001.');
});

test('4. Properties and Tenants CRUD', () => {
  // Create property
  const propInfo = db.prepare('INSERT INTO properties (name, address) VALUES (?, ?)').run('Apartment 1', 'Main Street 100');
  assert.ok(propInfo.lastInsertRowid > 0);

  // Create tenant
  const tenantInfo = db.prepare(`
    INSERT INTO tenants (property_id, name, email, rent_amount, due_day, vs_type, custom_vs)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(propInfo.lastInsertRowid, 'Peter Miller', 'peter@test.com', 1200, 15, 'auto', null);

  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantInfo.lastInsertRowid);
  assert.equal(tenant.name, 'Peter Miller');
  assert.equal(tenant.due_day, 15);
  assert.equal(tenant.rent_amount, 1200);
});

test('5. Scheduler Idempotency Check', async () => {
  // Clear any logs
  db.prepare('DELETE FROM reminder_logs').run();

  // Test run for 3 days before due date (e.g., 2026-07-12 for due_day 15 with 3 days before)
  const targetDate = new Date(2026, 6, 12); // July 12, 2026

  // Since SMTP is empty in test environment, sendReminder will fail gracefully and log failure in DB
  await runSchedulerCheck(targetDate);

  const logs1 = db.prepare('SELECT * FROM reminder_logs').all();
  assert.ok(logs1.length >= 1, 'Should create log entry');

  // Run scheduler check again for exact same date
  await runSchedulerCheck(targetDate);
  const logs2 = db.prepare('SELECT * FROM reminder_logs').all();

  assert.equal(logs2.length, logs1.length, 'Scheduler should be idempotent and not attempt duplicate reminders on same day');
});
