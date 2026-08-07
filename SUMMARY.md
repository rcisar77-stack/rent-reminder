# Development Summary — Rent Reminder

This document provides a full summary of the development work on **Rent Reminder** — an open-source, self-hosted web application for landlords to manage tenants, track rental payments, and automate email reminders.

---

## 📋 Features & Component Overview

### 1. Backend & Business Logic (`src/`)
- **Database Module (`src/db.js`)**:
  - SQLite database (WAL mode) with auto-schema initialization: `properties`, `tenants`, `payments`, `reminder_logs`, `settings`.
  - Default settings with English email templates and configurable reminder rules.
  - **Payment Reference / Variable Symbol (VS)**: Supports both auto-generated (`YYYYMM` + Tenant ID) and custom fixed reference codes.

- **Mailer Module (`src/mailer.js`)**:
  - Transport layer via Nodemailer with custom SMTP configuration.
  - Dynamic placeholders (`{NAJEMNIK}`, `{CASTKA}`, `{MENA}`, `{DATUM_SPLATNOSTI}`, `{CISLO_UCTU}`, `{KOD_BANKY}`, `{IBAN}`, `{VS}`, `{OBDOBI}`).
  - SMTP connection test endpoint.

- **Automated Scheduler (`src/scheduler.js`)**:
  - Daily cron scheduler running at 08:00 AM.
  - **Idempotency Guarantee**: Ensures reminder emails are never sent twice for the same period and reminder type.

- **REST API (`src/routes/api.js`)**:
  - Full CRUD operations for tenants and properties.
  - Dashboard statistics calculation (expected vs. collected).
  - Manual payment status toggles (Paid, Pending, Overdue).
  - One-click manual email reminder trigger.
  - CSV Export (UTF-8 with BOM for Excel compatibility).

### 2. Internationalization & UI (`public/`)
- **Multi-Language Support (i18n)**:
  - English (`en`) set as the default primary language.
  - Language switcher in top navigation: 🇬🇧 English, 🇨🇿 Czech, 🇩🇪 German, 🇪🇸 Spanish, 🇫🇷 French.
  - Locale translation files stored in `public/locales/`.
- **Modern Responsive Design**:
  - Glassmorphic dark theme, responsive across desktop and mobile devices.
  - Interactive status badges, modal forms, and placeholder tag insertion helper.

### 3. Automated Test Suite (`tests/`)
- **Node.js Native Test Runner (`tests/app.test.js`)**:
  - Database initialization test.
  - Reference / Variable Symbol generation test.
  - Template variable replacement test.
  - Properties & Tenants CRUD test.
  - Scheduler idempotency test.

### 4. Containerization & Deployment
- `Dockerfile` and `docker-compose.yml` for single-command production deployment.

---

## 🧪 Test Results

All automated tests executed successfully (5/5 passed):

```text
> npm test

✔ 1. Database Initialization and Settings (1.11ms)
✔ 2. Variable Symbol Generation (Auto vs Custom) (0.21ms)
✔ 3. Template Variable Replacement (0.28ms)
✔ 4. Properties and Tenants CRUD (0.47ms)
✔ 5. Scheduler Idempotency Check (2.43ms)

ℹ tests 5 | pass 5 | fail 0
```

---

## 🚀 How to Run

### Local Node.js:
```bash
npm start
```
Open **`http://localhost:3000`** in your browser.

### Docker Compose:
```bash
docker compose up -d
```
