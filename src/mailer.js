const nodemailer = require('nodemailer');
const { db, getSettings, generateVS } = require('./db');

function createTransporter(settings) {
  if (!settings.smtp_host) {
    return null;
  }

  const port = parseInt(settings.smtp_port, 10) || 587;
  const isSecure = settings.smtp_secure === 'true' || port === 465;

  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: port,
    secure: isSecure,
    auth: settings.smtp_user ? {
      user: settings.smtp_user,
      pass: settings.smtp_pass
    } : undefined,
    tls: {
      rejectUnauthorized: false
    }
  });
}

async function verifySmtp(testSettings) {
  const transporter = createTransporter(testSettings || getSettings());
  if (!transporter) {
    throw new Error('SMTP host is not configured.');
  }
  return await transporter.verify();
}

function formatDate(dateObj) {
  const d = dateObj.getDate();
  const m = dateObj.getMonth() + 1;
  const y = dateObj.getFullYear();
  return `${d}. ${m}. ${y}`;
}

function replaceVariables(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(placeholder, value || '');
  }
  return result;
}

async function sendReminder({ tenant, reminderType, yearMonth, isManual = false }) {
  const settings = getSettings();
  const transporter = createTransporter(settings);

  if (!transporter) {
    const errorMsg = 'SMTP server is not configured. Email was not sent.';
    db.prepare(`
      INSERT INTO reminder_logs (tenant_id, year_month, reminder_type, sent_to, status, error_message)
      VALUES (?, ?, ?, ?, 'failed', ?)
    `).run(tenant.id, yearMonth, reminderType, tenant.email, errorMsg);
    throw new Error(errorMsg);
  }

  // Determine due date
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const dueDay = Math.min(tenant.due_day || 15, 28); // handle month end simply
  const dueDateObj = new Date(year, month, dueDay);

  const formattedDueDate = formatDate(dueDateObj);
  const vs = generateVS(tenant, yearMonth);

  const variables = {
    // English
    TENANT: tenant.name,
    TENANT_NAME: tenant.name,
    AMOUNT: Number(tenant.rent_amount).toLocaleString('en-US'),
    CURRENCY: tenant.currency || 'USD',
    DUE_DATE: formattedDueDate,
    ACCOUNT_NUMBER: settings.bank_account || '',
    BANK_CODE: settings.bank_code || '',
    IBAN: settings.bank_iban || '',
    SWIFT: settings.bank_swift || '',
    BIC: settings.bank_swift || '',
    SWIFT_BIC: settings.bank_swift || '',
    VS: vs,
    PAYMENT_REF: vs,
    PERIOD: `${monthStr}/${yearStr}`,

    // Czech
    NAJEMNIK: tenant.name,
    CASTKA: Number(tenant.rent_amount).toLocaleString('cs-CZ'),
    MENA: tenant.currency || 'CZK',
    DATUM_SPLATNOSTI: formattedDueDate,
    CISLO_UCTU: settings.bank_account || '',
    KOD_BANKY: settings.bank_code || '',
    OBDOBI: `${monthStr}/${yearStr}`,

    // German
    MIETER: tenant.name,
    BETRAG: Number(tenant.rent_amount).toLocaleString('de-DE'),
    WAEHRUNG: tenant.currency || 'EUR',
    FAELLIGKEITSDATUM: formattedDueDate,
    KONTONUMMER: settings.bank_account || '',
    BANKLEITZAHL: settings.bank_code || '',
    VERWENDUNGSZWECK: vs,
    ZEITRAUM: `${monthStr}/${yearStr}`,

    // Spanish
    INQUILINO: tenant.name,
    MONTO: Number(tenant.rent_amount).toLocaleString('es-ES'),
    MONEDA: tenant.currency || 'EUR',
    FECHA_VENCIMIENTO: formattedDueDate,
    NUMERO_CUENTA: settings.bank_account || '',
    CODIGO_BANCO: settings.bank_code || '',
    REFERENCIA: vs,
    PERIODO: `${monthStr}/${yearStr}`,

    // French
    LOCATAIRE: tenant.name,
    MONTANT: Number(tenant.rent_amount).toLocaleString('fr-FR'),
    DEVISE: tenant.currency || 'EUR',
    DATE_ECHEANCE: formattedDueDate,
    NUMERO_COMPTE: settings.bank_account || '',
    CODE_BANQUE: settings.bank_code || '',
    REFERENCE: vs,
    PERIODE: `${monthStr}/${yearStr}`
  };

  const isBefore = reminderType === 'before_due';
  const rawSubject = isBefore
    ? `Rent Payment Reminder for period ${yearMonth} (${tenant.name})`
    : `Rent Overdue Notice for period ${yearMonth} (${tenant.name})`;

  const template = isBefore ? settings.email_template_before : settings.email_template_after;
  const bodyText = replaceVariables(template, variables);

  const mailOptions = {
    from: settings.smtp_from || settings.smtp_user,
    to: tenant.email,
    subject: isManual ? `[Manual Reminder] ${rawSubject}` : rawSubject,
    text: bodyText
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    db.prepare(`
      INSERT INTO reminder_logs (tenant_id, year_month, reminder_type, sent_to, status, error_message)
      VALUES (?, ?, ?, ?, 'success', NULL)
    `).run(tenant.id, yearMonth, reminderType, tenant.email);

    return { success: true, messageId: info.messageId };
  } catch (err) {
    db.prepare(`
      INSERT INTO reminder_logs (tenant_id, year_month, reminder_type, sent_to, status, error_message)
      VALUES (?, ?, ?, ?, 'failed', ?)
    `).run(tenant.id, yearMonth, reminderType, tenant.email, err.message);

    throw err;
  }
}

module.exports = {
  verifySmtp,
  sendReminder,
  replaceVariables,
  formatDate
};
