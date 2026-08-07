document.addEventListener('DOMContentLoaded', () => {

  // --- I18N / TRANSLATIONS ---
  let currentLang = localStorage.getItem('rent_reminder_lang') || 'en';
  let i18n = {};

  const langSelector = document.getElementById('language-selector');
  if (langSelector) {
    langSelector.value = currentLang;
    langSelector.addEventListener('change', (e) => {
      setLanguage(e.target.value);
    });
  }

  const defaultTemplateSignatures = [
    '{TENANT}', '{NAJEMNIK}', '{MIETER}', '{INQUILINO}', '{LOCATAIRE}',
    'Vážený', 'připomínáme', 'upozorňujeme', 'Splatnost',
    'Dear', 'upcoming rent payment', 'not yet received', 'Payment Details',
    'Sehr geehrte', 'Mietzahlung', 'Zahlungsdetails',
    'Estimado', 'alquiler', 'Detalles del pago',
    'Bonjour', 'loyer', 'Détails du paiement'
  ];

  function isUnmodifiedTemplate(text) {
    if (!text || text.trim() === '') return true;
    return defaultTemplateSignatures.some(sig => text.includes(sig));
  }

  async function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('rent_reminder_lang', lang);
    try {
      const res = await fetch(`/locales/${lang}.json`);
      if (res.ok) {
        i18n = await res.json();
      } else {
        const fallbackRes = await fetch('/locales/en.json');
        i18n = await fallbackRes.json();
      }

      // Auto-load matching template presets for selected language if input contains default preset text
      const tRes = await fetch(`/api/templates/presets?lang=${lang}`);
      const tData = await tRes.json();
      const beforeEl = document.getElementById('setting-email_template_before');
      const afterEl = document.getElementById('setting-email_template_after');
      if (beforeEl && afterEl && tData.before && tData.after) {
        if (isUnmodifiedTemplate(beforeEl.value)) {
          beforeEl.value = tData.before;
        }
        if (isUnmodifiedTemplate(afterEl.value)) {
          afterEl.value = tData.after;
        }
      }
    } catch (err) {
      console.error('Failed to load translations:', err);
    }
    applyTranslations();
    loadDashboard();
    loadTenants();
  }

  function t(key, fallback = '') {
    return i18n[key] || fallback || key;
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (i18n[key]) {
        el.textContent = i18n[key];
      }
    });
    renderPlaceholderTags();
  }

  function renderPlaceholderTags() {
    const container = document.getElementById('placeholder-tags-container');
    if (!container) return;
    container.innerHTML = '';
    const tags = i18n.placeholders || ["{TENANT}", "{AMOUNT}", "{CURRENCY}", "{DUE_DATE}", "{ACCOUNT_NUMBER}", "{BANK_CODE}", "{IBAN}", "{VS}", "{PERIOD}"];

    tags.forEach(tagText => {
      const tag = document.createElement('span');
      tag.className = 'placeholder-tag';
      tag.dataset.var = tagText;
      tag.textContent = tagText;
      tag.addEventListener('click', () => {
        if (activeTextarea) {
          const start = activeTextarea.selectionStart;
          const end = activeTextarea.selectionEnd;
          const text = activeTextarea.value;
          activeTextarea.value = text.substring(0, start) + tagText + text.substring(end);
          activeTextarea.focus();
          activeTextarea.selectionStart = activeTextarea.selectionEnd = start + tagText.length;
        }
      });
      container.appendChild(tag);
    });
  }

  // Initial translation load
  setLanguage(currentLang);

  // --- STATE ---
  let properties = [];
  let tenants = [];
  let currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  // --- INITIALIZATION ---
  document.getElementById('month-selector').value = currentMonth;
  initTabs();
  initModals();
  initVSInputs();
  loadProperties();
  loadSettings();
  loadLogs();

  // --- NAVIGATION TABS ---
  function initTabs() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        navBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(targetTab).classList.add('active');

        // Refresh tab data
        if (targetTab === 'dashboard') loadDashboard();
        if (targetTab === 'tenants') { loadTenants(); loadProperties(); }
        if (targetTab === 'settings') loadSettings();
        if (targetTab === 'logs') loadLogs();
      });
    });
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // --- MODALS ---
  function initModals() {
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        document.getElementById(modalId).classList.remove('active');
      });
    });

    document.getElementById('btn-add-tenant').addEventListener('click', () => {
      openTenantModal();
    });

    document.getElementById('btn-add-property').addEventListener('click', () => {
      document.getElementById('form-property').reset();
      document.getElementById('modal-property').classList.add('active');
    });
  }

  function initVSInputs() {
    const radios = document.querySelectorAll('input[name="tenant-vs_type"]');
    const customVsInput = document.getElementById('tenant-custom_vs');
    radios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
          customVsInput.style.display = 'block';
        } else {
          customVsInput.style.display = 'none';
        }
      });
    });
  }

  // --- DASHBOARD ---
  document.getElementById('month-selector').addEventListener('change', (e) => {
    currentMonth = e.target.value;
    loadDashboard();
  });

  document.getElementById('btn-export-csv').addEventListener('click', () => {
    window.location.href = `/api/export/csv?month=${currentMonth}`;
  });

  document.getElementById('btn-run-scheduler-now').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/scheduler/run', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(t('btn_check_due') + ' complete.', 'success');
        loadDashboard();
        loadLogs();
      } else {
        showToast(data.error || 'Error running scheduler', 'error');
      }
    } catch (err) {
      showToast('Server communication error.', 'error');
    }
  });

  async function loadDashboard() {
    try {
      const res = await fetch(`/api/dashboard?month=${currentMonth}`);
      const data = await res.json();

      // Stats
      document.getElementById('stat-total-tenants').textContent = data.stats.totalTenants;
      document.getElementById('stat-paid-count').textContent = data.stats.paidCount;
      document.getElementById('stat-pending-count').textContent = data.stats.pendingCount;
      document.getElementById('stat-overdue-count').textContent = data.stats.overdueCount;
      document.getElementById('stat-money').textContent = `${data.stats.totalExpected.toLocaleString()} / ${data.stats.totalCollected.toLocaleString()}`;

      // Table
      const tbody = document.getElementById('dashboard-table-body');
      tbody.innerHTML = '';

      if (data.items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No active tenants found. Add your first tenant to get started.</td></tr>`;
        return;
      }

      data.items.forEach(item => {
        const tr = document.createElement('tr');

        let statusBadge = '';
        if (item.payment.status === 'paid') {
          statusBadge = `<span class="badge-status paid"><i class="fa-solid fa-check"></i> ${t('status_paid')}</span>`;
        } else if (item.payment.status === 'pending') {
          statusBadge = `<span class="badge-status pending"><i class="fa-solid fa-hourglass-half"></i> ${t('status_pending')}</span>`;
        } else {
          statusBadge = `<span class="badge-status overdue"><i class="fa-solid fa-triangle-exclamation"></i> ${t('status_overdue')}</span>`;
        }

        const dueDay = item.tenant.due_day || 15;

        tr.innerHTML = `
          <td><strong>${item.tenant.name}</strong><br><small style="color: var(--text-secondary);">${item.tenant.email}</small></td>
          <td>${item.tenant.property_name || '<em>-</em>'}</td>
          <td><strong>${item.payment.amount.toLocaleString()} ${item.tenant.currency}</strong></td>
          <td>${dueDay}</td>
          <td><code style="background: rgba(255,255,255,0.06); padding: 0.2rem 0.4rem; border-radius: 4px;">${item.vs}</code></td>
          <td>${statusBadge}</td>
          <td>${item.payment.paid_date ? item.payment.paid_date : '<span style="color: var(--text-secondary);">-</span>'}</td>
          <td>
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
              ${item.payment.status !== 'paid' ? `
                <button class="btn btn-sm btn-success btn-mark-paid" data-tenant-id="${item.tenant.id}">
                  <i class="fa-solid fa-check"></i> ${t('btn_mark_paid')}
                </button>
              ` : `
                <button class="btn btn-sm btn-mark-pending" data-tenant-id="${item.tenant.id}">
                  <i class="fa-solid fa-undo"></i> ${t('btn_undo')}
                </button>
              `}
              <button class="btn btn-sm btn-primary btn-send-reminder" data-tenant-id="${item.tenant.id}">
                <i class="fa-solid fa-paper-plane"></i> ${t('btn_send_reminder')}
              </button>
            </div>
          </td>
        `;

        tbody.appendChild(tr);
      });

      // Attach event listeners to buttons
      document.querySelectorAll('.btn-mark-paid').forEach(btn => {
        btn.addEventListener('click', () => updatePaymentStatus(btn.dataset.tenantId, 'paid'));
      });
      document.querySelectorAll('.btn-mark-pending').forEach(btn => {
        btn.addEventListener('click', () => updatePaymentStatus(btn.dataset.tenantId, 'pending'));
      });
      document.querySelectorAll('.btn-send-reminder').forEach(btn => {
        btn.addEventListener('click', () => sendManualReminder(btn.dataset.tenantId));
      });

    } catch (err) {
      showToast('Error loading dashboard.', 'error');
    }
  }

  async function updatePaymentStatus(tenantId, status) {
    try {
      const res = await fetch('/api/payments/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, year_month: currentMonth, status })
      });
      const data = await res.json();
      if (data.success) {
        showToast(status === 'paid' ? 'Payment marked as paid.' : 'Payment status updated.', 'success');
        loadDashboard();
      }
    } catch (err) {
      showToast('Error updating payment status.', 'error');
    }
  }

  async function sendManualReminder(tenantId) {
    try {
      showToast('Sending reminder email...', 'info');
      const res = await fetch('/api/reminders/send-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, year_month: currentMonth, reminder_type: 'before_due' })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        loadLogs();
      } else {
        showToast(data.error || 'Error sending reminder', 'error');
      }
    } catch (err) {
      showToast('Error sending message.', 'error');
    }
  }


  // --- PROPERTIES & TENANTS ---
  async function loadProperties() {
    try {
      const res = await fetch('/api/properties');
      properties = await res.json();

      const container = document.getElementById('properties-list');
      const select = document.getElementById('tenant-property_id');
      
      container.innerHTML = '';
      select.innerHTML = '<option value="">-- Select Property --</option>';

      if (properties.length === 0) {
        container.innerHTML = `<span style="color: var(--text-secondary); font-size: 0.9rem;">No properties found. Add your first property above.</span>`;
      }

      properties.forEach(p => {
        // Property badge tag
        const tag = document.createElement('div');
        tag.className = 'btn btn-sm';
        tag.style.background = 'rgba(255, 255, 255, 0.05)';
        tag.innerHTML = `<i class="fa-solid fa-building"></i> ${p.name} <button data-del-prop="${p.id}" style="background:none; border:none; color:var(--danger); cursor:pointer; margin-left:0.4rem;">&times;</button>`;
        container.appendChild(tag);

        // Select option
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
      });

      document.querySelectorAll('[data-del-prop]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm('Delete this property?')) {
            await fetch(`/api/properties/${btn.dataset.delProp}`, { method: 'DELETE' });
            loadProperties();
            loadTenants();
          }
        });
      });

    } catch (err) {
      showToast('Error loading properties.', 'error');
    }
  }

  document.getElementById('form-property').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('property-name').value;
    const address = document.getElementById('property-address').value;

    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address })
      });
      const data = await res.json();
      if (data.id) {
        showToast('Property created successfully.', 'success');
        document.getElementById('modal-property').classList.remove('active');
        loadProperties();
      }
    } catch (err) {
      showToast('Error creating property.', 'error');
    }
  });


  async function loadTenants() {
    try {
      const res = await fetch('/api/tenants');
      tenants = await res.json();

      const tbody = document.getElementById('tenants-table-body');
      tbody.innerHTML = '';

      if (tenants.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No tenants registered yet.</td></tr>`;
        return;
      }

      tenants.forEach(tData => {
        const tr = document.createElement('tr');
        const vsDisplay = tData.vs_type === 'custom' && tData.custom_vs ? `${tData.custom_vs} (Custom)` : 'Auto (YYYYMM+ID)';

        tr.innerHTML = `
          <td><strong>${tData.name}</strong></td>
          <td>${tData.property_name || '<em>-</em>'}</td>
          <td>${tData.email}</td>
          <td>${tData.phone || '-'}</td>
          <td><strong>${tData.rent_amount.toLocaleString()} ${tData.currency}</strong></td>
          <td>${tData.due_day}</td>
          <td><small>${vsDisplay}</small></td>
          <td>${tData.active ? `<span style="color: var(--success);"><i class="fa-solid fa-circle-check"></i> ${t('active_yes')}</span>` : `<span style="color: var(--text-secondary);">${t('active_no')}</span>`}</td>
          <td>
            <div style="display: flex; gap: 0.3rem;">
              <button class="btn btn-sm btn-edit-tenant" data-id="${tData.id}"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="btn btn-sm btn-danger btn-del-tenant" data-id="${tData.id}"><i class="fa-solid fa-trash"></i></button>
            </div>
          </td>
        `;

        tbody.appendChild(tr);
      });

      document.querySelectorAll('.btn-edit-tenant').forEach(btn => {
        btn.addEventListener('click', () => {
          const tenant = tenants.find(tData => tData.id == btn.dataset.id);
          if (tenant) openTenantModal(tenant);
        });
      });

      document.querySelectorAll('.btn-del-tenant').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm('Delete this tenant?')) {
            await fetch(`/api/tenants/${btn.dataset.id}`, { method: 'DELETE' });
            showToast('Tenant removed.', 'info');
            loadTenants();
            loadDashboard();
          }
        });
      });

    } catch (err) {
      showToast('Error loading tenants.', 'error');
    }
  }

  function openTenantModal(tenant = null) {
    const form = document.getElementById('form-tenant');
    form.reset();
    
    if (tenant) {
      document.getElementById('modal-tenant-title').textContent = t('modal_edit_tenant');
      document.getElementById('tenant-id').value = tenant.id;
      document.getElementById('tenant-name').value = tenant.name;
      document.getElementById('tenant-email').value = tenant.email;
      document.getElementById('tenant-phone').value = tenant.phone || '';
      document.getElementById('tenant-property_id').value = tenant.property_id || '';
      document.getElementById('tenant-rent_amount').value = tenant.rent_amount;
      document.getElementById('tenant-currency').value = tenant.currency || 'USD';
      document.getElementById('tenant-due_day').value = tenant.due_day || 15;
      
      const vsRadio = document.querySelector(`input[name="tenant-vs_type"][value="${tenant.vs_type || 'auto'}"]`);
      if (vsRadio) vsRadio.checked = true;

      const customVsInput = document.getElementById('tenant-custom_vs');
      if (tenant.vs_type === 'custom') {
        customVsInput.style.display = 'block';
        customVsInput.value = tenant.custom_vs || '';
      } else {
        customVsInput.style.display = 'none';
      }
    } else {
      document.getElementById('modal-tenant-title').textContent = t('modal_add_tenant');
      document.getElementById('tenant-id').value = '';
      document.getElementById('tenant-custom_vs').style.display = 'none';
      document.querySelector('input[name="tenant-vs_type"][value="auto"]').checked = true;
    }

    document.getElementById('modal-tenant').classList.add('active');
  }

  document.getElementById('form-tenant').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('tenant-id').value;
    const vsType = document.querySelector('input[name="tenant-vs_type"]:checked').value;

    const payload = {
      property_id: document.getElementById('tenant-property_id').value || null,
      name: document.getElementById('tenant-name').value,
      email: document.getElementById('tenant-email').value,
      phone: document.getElementById('tenant-phone').value,
      rent_amount: document.getElementById('tenant-rent_amount').value,
      currency: document.getElementById('tenant-currency').value,
      due_day: document.getElementById('tenant-due_day').value,
      vs_type: vsType,
      custom_vs: document.getElementById('tenant-custom_vs').value
    };

    const url = id ? `/api/tenants/${id}` : '/api/tenants';
    const method = id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success || data.id) {
        showToast(id ? 'Tenant updated.' : 'Tenant created.', 'success');
        document.getElementById('modal-tenant').classList.remove('active');
        loadTenants();
        loadDashboard();
      }
    } catch (err) {
      showToast('Error saving tenant.', 'error');
    }
  });


  // --- SETTINGS ---
  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const settings = await res.json();

      for (const [key, val] of Object.entries(settings)) {
        const el = document.getElementById(`setting-${key}`);
        if (el) el.value = val;
      }

      // If loaded template text is unmodified default, apply preset for current language
      const beforeEl = document.getElementById('setting-email_template_before');
      const afterEl = document.getElementById('setting-email_template_after');
      if (beforeEl && afterEl) {
        const tRes = await fetch(`/api/templates/presets?lang=${currentLang}`);
        const tData = await tRes.json();
        if (tData.before && isUnmodifiedTemplate(beforeEl.value)) {
          beforeEl.value = tData.before;
        }
        if (tData.after && isUnmodifiedTemplate(afterEl.value)) {
          afterEl.value = tData.after;
        }
      }
    } catch (err) {
      showToast('Error loading settings.', 'error');
    }
  }

  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const payload = {};
    const keys = [
      'bank_account', 'bank_code', 'bank_iban', 'bank_swift',
      'smtp_host', 'smtp_port', 'smtp_from', 'smtp_user', 'smtp_pass',
      'days_before_due', 'days_after_due',
      'email_template_before', 'email_template_after'
    ];

    keys.forEach(k => {
      const el = document.getElementById(`setting-${k}`);
      if (el) payload[k] = el.value;
    });

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Settings saved successfully.', 'success');
      }
    } catch (err) {
      showToast('Error saving settings.', 'error');
    }
  });

  document.getElementById('btn-test-smtp').addEventListener('click', async () => {
    const payload = {
      smtp_host: document.getElementById('setting-smtp_host').value,
      smtp_port: document.getElementById('setting-smtp_port').value,
      smtp_user: document.getElementById('setting-smtp_user').value,
      smtp_pass: document.getElementById('setting-smtp_pass').value
    };

    showToast('Testing SMTP connection...', 'info');

    try {
      const res = await fetch('/api/settings/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
      } else {
        showToast(data.error || 'SMTP Test failed.', 'error');
      }
    } catch (err) {
      showToast('Error during SMTP test.', 'error');
    }
  });

  // Placeholder tags click to insert into active textarea
  let activeTextarea = document.getElementById('setting-email_template_before');
  document.getElementById('setting-email_template_before').addEventListener('focus', function() { activeTextarea = this; });
  document.getElementById('setting-email_template_after').addEventListener('focus', function() { activeTextarea = this; });

  document.querySelectorAll('.placeholder-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const varText = tag.dataset.var;
      if (activeTextarea) {
        const start = activeTextarea.selectionStart;
        const end = activeTextarea.selectionEnd;
        const text = activeTextarea.value;
        activeTextarea.value = text.substring(0, start) + varText + text.substring(end);
        activeTextarea.focus();
        activeTextarea.selectionStart = activeTextarea.selectionEnd = start + varText.length;
      }
    });
  });


  // --- VERSION CHECK ---
  document.getElementById('btn-check-updates-now')?.addEventListener('click', () => {
    checkAppVersion(true);
  });

  async function checkAppVersion(userTriggered = false) {
    const resultEl = document.getElementById('version-check-result');
    const versionEl = document.getElementById('app-current-version');
    if (resultEl && userTriggered) {
      resultEl.innerHTML = `<span style="color: var(--text-secondary);"><i class="fa-solid fa-spinner fa-spin"></i> Checking...</span>`;
    }

    try {
      const res = await fetch('/api/version');
      const data = await res.json();

      if (versionEl && data.currentVersion) {
        versionEl.textContent = `v${data.currentVersion}`;
      }

      if (data.updateAvailable) {
        const updateHtml = `
          <span style="color: var(--warning); font-weight: 600;">
            <i class="fa-solid fa-circle-arrow-up"></i> ${t('msg_update_found')} (v${data.latestVersion})
          </span>
          <a href="${data.url}" target="_blank" class="btn btn-sm btn-primary" style="margin-left: 0.75rem; text-decoration: none;">
            <i class="fa-solid fa-download"></i> GitHub Release
          </a>
        `;
        if (resultEl) resultEl.innerHTML = updateHtml;
        if (userTriggered) showToast(`${t('msg_update_found')} (v${data.latestVersion})`, 'success');
      } else {
        if (resultEl) {
          resultEl.innerHTML = `<span style="color: var(--success);"><i class="fa-solid fa-check"></i> ${t('msg_already_latest')} (v${data.currentVersion})</span>`;
        }
        if (userTriggered) showToast(t('msg_already_latest'), 'info');
      }
    } catch (err) {
      if (resultEl) resultEl.textContent = 'Could not reach update server.';
    }
  }

  checkAppVersion(false);

  // --- LOGS ---
  document.getElementById('btn-refresh-logs').addEventListener('click', loadLogs);

  async function loadLogs() {
    try {
      const res = await fetch('/api/logs');
      const logs = await res.json();

      const tbody = document.getElementById('logs-table-body');
      tbody.innerHTML = '';

      if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No messages sent yet.</td></tr>`;
        return;
      }

      logs.forEach(l => {
        const tr = document.createElement('tr');
        const isOk = l.status === 'success';

        tr.innerHTML = `
          <td><small>${new Date(l.sent_at).toLocaleString()}</small></td>
          <td><strong>${l.tenant_name || 'Unknown'}</strong></td>
          <td>${l.year_month}</td>
          <td>${l.reminder_type === 'before_due' ? t('msg_type_before') : t('msg_type_after')}</td>
          <td>${l.sent_to}</td>
          <td>${isOk ? `<span class="badge-status paid">Sent</span>` : `<span class="badge-status overdue">Failed</span>`}</td>
          <td><small style="color: ${isOk ? 'var(--text-secondary)' : 'var(--danger)'};">${l.error_message || 'OK'}</small></td>
        `;

        tbody.appendChild(tr);
      });
    } catch (err) {
      showToast('Error loading logs.', 'error');
    }
  }

});
