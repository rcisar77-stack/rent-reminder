const cron = require('node-cron');
const { db, getSettings } = require('./db');
const { sendReminder } = require('./mailer');

async function runSchedulerCheck(targetDate = new Date()) {
  const settings = getSettings();
  const daysBefore = parseInt(settings.days_before_due || '3', 10);
  const daysAfter = parseInt(settings.days_after_due || '2', 10);

  const activeTenants = db.prepare('SELECT * FROM tenants WHERE active = 1').all();

  const results = [];

  for (const tenant of activeTenants) {
    const today = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;

    const dueDay = Math.min(tenant.due_day || 15, 28);
    const dueDate = new Date(year, month, dueDay);

    // Ensure payment record exists for this month
    let payment = db.prepare('SELECT * FROM payments WHERE tenant_id = ? AND year_month = ?').get(tenant.id, yearMonth);
    if (!payment) {
      db.prepare(`
        INSERT INTO payments (tenant_id, year_month, amount, status)
        VALUES (?, ?, ?, 'pending')
      `).run(tenant.id, yearMonth, tenant.rent_amount);
      payment = { tenant_id: tenant.id, year_month: yearMonth, amount: tenant.rent_amount, status: 'pending' };
    }

    if (payment.status === 'paid') {
      continue; // Rent already paid for this month
    }

    // Calculate trigger dates
    const beforeTriggerDate = new Date(dueDate);
    beforeTriggerDate.setDate(dueDate.getDate() - daysBefore);

    const afterTriggerDate = new Date(dueDate);
    afterTriggerDate.setDate(dueDate.getDate() + daysAfter);

    // Check if today matches beforeTriggerDate
    if (today.getTime() === beforeTriggerDate.getTime()) {
      const alreadySent = db.prepare(`
        SELECT id FROM reminder_logs
        WHERE tenant_id = ? AND year_month = ? AND reminder_type = 'before_due'
      `).get(tenant.id, yearMonth);

      if (!alreadySent) {
        try {
          await sendReminder({ tenant, reminderType: 'before_due', yearMonth });
          results.push({ tenantId: tenant.id, type: 'before_due', status: 'sent' });
        } catch (err) {
          results.push({ tenantId: tenant.id, type: 'before_due', status: 'error', error: err.message });
        }
      }
    }

    // Check if today matches or exceeds afterTriggerDate and hasn't been sent yet
    if (today.getTime() >= afterTriggerDate.getTime()) {
      const alreadySent = db.prepare(`
        SELECT id FROM reminder_logs
        WHERE tenant_id = ? AND year_month = ? AND reminder_type = 'after_due'
      `).get(tenant.id, yearMonth);

      if (!alreadySent) {
        // Mark payment as overdue
        db.prepare('UPDATE payments SET status = "overdue" WHERE tenant_id = ? AND year_month = ?').run(tenant.id, yearMonth);

        try {
          await sendReminder({ tenant, reminderType: 'after_due', yearMonth });
          results.push({ tenantId: tenant.id, type: 'after_due', status: 'sent' });
        } catch (err) {
          results.push({ tenantId: tenant.id, type: 'after_due', status: 'error', error: err.message });
        }
      }
    }
  }

  return results;
}

function startScheduler() {
  // Run daily at 08:00
  cron.schedule('0 8 * * *', async () => {
    console.log('[Scheduler] Running daily rent reminder check...');
    try {
      const res = await runSchedulerCheck();
      console.log('[Scheduler] Daily check completed:', res);
    } catch (err) {
      console.error('[Scheduler] Error during daily check:', err);
    }
  });
  console.log('[Scheduler] Daily cron job scheduled for 08:00');
}

module.exports = {
  runSchedulerCheck,
  startScheduler
};
