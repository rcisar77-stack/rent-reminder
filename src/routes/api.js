const express = require('express');
const { db, getSettings, updateSettings, generateVS } = require('../db');
const { verifySmtp, sendReminder } = require('../mailer');
const { runSchedulerCheck } = require('../scheduler');
const templates = require('../templates');

const router = express.Router();
const pkg = require('../../package.json');

router.get('/templates/presets', (req, res) => {
  const lang = req.query.lang || 'en';
  res.json(templates[lang] || templates.en);
});

// --- VERSION CHECK ---
router.get('/version', async (req, res) => {
  const currentVersion = pkg.version || '1.0.1';
  const repo = req.query.repo || process.env.GITHUB_REPO || 'rcisar77-stack/rent-reminder';

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { 'User-Agent': 'RentReminderApp' }
    });

    if (response.ok) {
      const data = await response.json();
      const latestVersion = (data.tag_name || data.name || '').replace(/^v/, '');
      const updateAvailable = Boolean(latestVersion && latestVersion !== currentVersion);

      return res.json({
        currentVersion,
        latestVersion: latestVersion || currentVersion,
        updateAvailable,
        url: data.html_url || `https://github.com/${repo}/releases`,
        body: data.body || ''
      });
    }
  } catch (err) {
    // Silence network/API rate-limit errors
  }

  res.json({
    currentVersion,
    latestVersion: currentVersion,
    updateAvailable: false,
    offline: true
  });
});

// --- PROPERTIES ---
router.get('/properties', (req, res) => {
  const rows = db.prepare('SELECT * FROM properties ORDER BY name ASC').all();
  res.json(rows);
});

router.post('/properties', (req, res) => {
  const { name, address } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Property name is required.' });
  }
  const info = db.prepare('INSERT INTO properties (name, address) VALUES (?, ?)').run(name.trim(), address ? address.trim() : null);
  res.json({ id: info.lastInsertRowid, name: name.trim(), address });
});

router.delete('/properties/:id', (req, res) => {
  db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- TENANTS ---
router.get('/tenants', (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, p.name as property_name
    FROM tenants t
    LEFT JOIN properties p ON t.property_id = p.id
    ORDER BY t.name ASC
  `).all();
  res.json(rows);
});

router.post('/tenants', (req, res) => {
  const { property_id, name, email, phone, rent_amount, currency, due_day, vs_type, custom_vs } = req.body;
  if (!name || !email || !rent_amount) {
    return res.status(400).json({ error: 'Name, email, and rent amount are required.' });
  }

  const parsedRent = parseFloat(rent_amount);
  if (isNaN(parsedRent)) {
    return res.status(400).json({ error: 'Invalid rent amount.' });
  }

  let parsedDueDay = parseInt(due_day, 10);
  if (isNaN(parsedDueDay)) {
    parsedDueDay = 15;
  }
  parsedDueDay = Math.max(1, Math.min(28, parsedDueDay));

  const info = db.prepare(`
    INSERT INTO tenants (property_id, name, email, phone, rent_amount, currency, due_day, vs_type, custom_vs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    property_id || null,
    name.trim(),
    email.trim(),
    phone ? phone.trim() : null,
    parsedRent,
    currency || 'USD',
    parsedDueDay,
    vs_type || 'auto',
    custom_vs ? custom_vs.trim() : null
  );

  res.json({ id: info.lastInsertRowid, success: true });
});

router.put('/tenants/:id', (req, res) => {
  const { property_id, name, email, phone, rent_amount, currency, due_day, vs_type, custom_vs, active } = req.body;
  
  const parsedRent = parseFloat(rent_amount);
  if (isNaN(parsedRent)) {
    return res.status(400).json({ error: 'Invalid rent amount.' });
  }

  let parsedDueDay = parseInt(due_day, 10);
  if (isNaN(parsedDueDay)) {
    parsedDueDay = 15;
  }
  parsedDueDay = Math.max(1, Math.min(28, parsedDueDay));

  db.prepare(`
    UPDATE tenants
    SET property_id = ?, name = ?, email = ?, phone = ?, rent_amount = ?, currency = ?, due_day = ?, vs_type = ?, custom_vs = ?, active = ?
    WHERE id = ?
  `).run(
    property_id || null,
    name.trim(),
    email.trim(),
    phone ? phone.trim() : null,
    parsedRent,
    currency || 'USD',
    parsedDueDay,
    vs_type || 'auto',
    custom_vs ? custom_vs.trim() : null,
    active !== undefined ? (active ? 1 : 0) : 1,
    req.params.id
  );

  res.json({ success: true });
});

router.delete('/tenants/:id', (req, res) => {
  db.prepare('DELETE FROM tenants WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- DASHBOARD & PAYMENTS ---
router.get('/dashboard', (req, res) => {
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const yearMonth = req.query.month || currentYM;

  // Fetch active tenants
  const tenants = db.prepare(`
    SELECT t.*, p.name as property_name
    FROM tenants t
    LEFT JOIN properties p ON t.property_id = p.id
    WHERE t.active = 1
  `).all();

  // Ensure payment records exist for all active tenants for this month
  const getPayStmt = db.prepare('SELECT * FROM payments WHERE tenant_id = ? AND year_month = ?');
  const insertPayStmt = db.prepare('INSERT INTO payments (tenant_id, year_month, amount, status) VALUES (?, ?, ?, ?)');

  const items = tenants.map((tenant) => {
    let payment = getPayStmt.get(tenant.id, yearMonth);
    if (!payment) {
      // Calculate initial status if date is already passed
      const [y, m] = yearMonth.split('-');
      const dueDay = Math.min(tenant.due_day || 15, 28);
      const dueDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, dueDay);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let initialStatus = 'pending';
      if (today.getTime() > dueDate.getTime()) {
        initialStatus = 'overdue';
      }

      insertPayStmt.run(tenant.id, yearMonth, tenant.rent_amount, initialStatus);
      payment = getPayStmt.get(tenant.id, yearMonth);
    }

    const vs = generateVS(tenant, yearMonth);

    return {
      tenant,
      payment,
      vs
    };
  });

  // Calculate statistics
  const stats = {
    totalTenants: items.length,
    paidCount: items.filter(i => i.payment.status === 'paid').length,
    pendingCount: items.filter(i => i.payment.status === 'pending').length,
    overdueCount: items.filter(i => i.payment.status === 'overdue').length,
    totalExpected: items.reduce((sum, i) => sum + (i.payment.amount || 0), 0),
    totalCollected: items.filter(i => i.payment.status === 'paid').reduce((sum, i) => sum + (i.payment.amount || 0), 0)
  };

  res.json({
    yearMonth,
    stats,
    items
  });
});

router.post('/payments/status', (req, res) => {
  const { tenant_id, year_month, status, paid_date, note } = req.body;
  if (!tenant_id || !year_month || !status) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  const existing = db.prepare('SELECT id FROM payments WHERE tenant_id = ? AND year_month = ?').get(tenant_id, year_month);
  if (existing) {
    db.prepare(`
      UPDATE payments
      SET status = ?, paid_date = ?, note = ?
      WHERE tenant_id = ? AND year_month = ?
    `).run(status, status === 'paid' ? (paid_date || new Date().toISOString().split('T')[0]) : null, note || null, tenant_id, year_month);
  } else {
    const tenant = db.prepare('SELECT rent_amount FROM tenants WHERE id = ?').get(tenant_id);
    db.prepare(`
      INSERT INTO payments (tenant_id, year_month, amount, status, paid_date, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tenant_id, year_month, tenant ? tenant.rent_amount : 0, status, status === 'paid' ? (paid_date || new Date().toISOString().split('T')[0]) : null, note || null);
  }

  res.json({ success: true });
});

// --- MANUAL REMINDER ---
router.post('/reminders/send-manual', async (req, res) => {
  const { tenant_id, year_month, reminder_type } = req.body;
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenant_id);
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found.' });
  }

  try {
    await sendReminder({
      tenant,
      reminderType: reminder_type || 'before_due',
      yearMonth: year_month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      isManual: true
    });
    res.json({ success: true, message: `Reminder successfully sent to ${tenant.email}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TRIGGER SCHEDULER MANUALLY FOR TESTING ---
router.post('/scheduler/run', async (req, res) => {
  try {
    const results = await runSchedulerCheck();
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SETTINGS ---
router.get('/settings', (req, res) => {
  res.json(getSettings());
});

router.post('/settings', (req, res) => {
  updateSettings(req.body);
  res.json({ success: true, settings: getSettings() });
});

router.post('/settings/test-smtp', async (req, res) => {
  try {
    await verifySmtp(req.body);
    res.json({ success: true, message: 'SMTP connection successfully established!' });
  } catch (err) {
    res.status(400).json({ error: `SMTP error: ${err.message}` });
  }
});

// --- LOGS ---
router.get('/logs', (req, res) => {
  const rows = db.prepare(`
    SELECT l.*, t.name as tenant_name
    FROM reminder_logs l
    LEFT JOIN tenants t ON l.tenant_id = t.id
    ORDER BY l.sent_at DESC
    LIMIT 100
  `).all();
  res.json(rows);
});

// --- CSV EXPORT ---
router.get('/export/csv', (req, res) => {
  const yearMonth = req.query.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  
  const rows = db.prepare(`
    SELECT 
      t.name as tenant_name,
      t.email,
      t.phone,
      p.name as property_name,
      pay.amount,
      t.currency,
      pay.status,
      pay.paid_date,
      pay.note
    FROM tenants t
    LEFT JOIN properties p ON t.property_id = p.id
    LEFT JOIN payments pay ON t.id = pay.tenant_id AND pay.year_month = ?
    WHERE t.active = 1
  `).all(yearMonth);

  let csv = 'Tenant;Email;Phone;Property;Amount;Currency;Status;Paid Date;Note\n';
  
  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    return str.replace(/"/g, '""');
  };

  for (const r of rows) {
    csv += `"${escapeCsv(r.tenant_name)}";"${escapeCsv(r.email)}";"${escapeCsv(r.phone)}";"${escapeCsv(r.property_name)}";"${r.amount || 0}";"${escapeCsv(r.currency || 'USD')}";"${escapeCsv(r.status || 'pending')}";"${escapeCsv(r.paid_date)}";"${escapeCsv(r.note)}"\n`;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=rent_reminder_${yearMonth}.csv`);
  res.send('\uFEFF' + csv); // Add BOM for Excel UTF-8
});

module.exports = router;
