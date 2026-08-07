# 🏠 Rent Reminder — Self-Hosted Rent Tracking & Automated Reminders

> **Automated, self-hosted rent tracking & email reminders for landlords.**  
> *Your data, your server, zero monthly cloud fees.*

![License: Source-Available / Anti-SaaS](https://img.shields.io/badge/License-Anti--SaaS_/_Fair--Use-orange.svg)
![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)

---

## ✨ Features

- 📊 **Clear Dashboard:** Instant visual overview for every month (Paid / Pending / Overdue).
- ✉️ **Automated Email Notices & Reminders:**
  - 1st reminder before due date (e.g. 3 days prior).
  - 2nd urgency notice after due date for late payments.
  - Sent via **your own SMTP server** (emails originate directly from your account).
  - Idempotency guarantee (no email is ever sent twice).
- 🔢 **Payment Reference / Variable Symbol (VS):**
  - **Automatic mode:** Formula `YYYYMM` + Tenant ID (e.g. `2026070001`).
  - **Custom fixed mode:** Assign a permanent reference code per tenant.
- 🏢 **Property & Tenant Management:** Track units, rent amounts, due days, and currencies (USD, EUR, CZK, GBP, etc.).
- 📝 **Email Template Editor:** Fully customizable notification text with dynamic placeholders (`{TENANT}`, `{AMOUNT}`, `{VS}`, `{ACCOUNT_NUMBER}`, etc.).
- 📥 **Export Overdue Tenants to CSV:** Generate MS Excel-compatible reports (UTF-8 with BOM).
- 🔒 **100% Private:** Embedded SQLite database running locally on your server. Zero third-party data sharing.

---

## 🚀 Quickstart

### Option A: Docker Compose (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/rcisar77-stack/rent-reminder.git
   cd rent-reminder
   ```

2. Launch via Docker:
   ```bash
   docker compose up -d
   ```

3. Open in your browser: **`http://localhost:3000`**

---

### Option B: Direct Node.js Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the application:
   ```bash
   npm start
   ```

3. Open in your browser: **`http://localhost:3000`**

---

## 🧪 Testing

To run automated unit tests:
```bash
npm test
```

---

## 📜 License

This project is licensed under the **Rent Reminder Source-Available & Anti-SaaS License (v1.0)**:
- 🟢 **Free for personal & business use:** Any individual or company (real estate agencies, property managers, landlords) may freely install, run, and modify the software to manage their own properties.
- 🔴 **No SaaS Resell (Anti-SaaS):** Operating or reselling this software as a commercial paid cloud service (SaaS) for third parties is prohibited without a commercial license from the author.

---

## 📝 Changelog

### v1.0.1
- **Fix:** CSV export escaping quotes and proper header encoding.
- **Security:** Strict input validation for tenant rental amounts and due dates.
- **Localization:** Primary language changed to English as standard codebase baseline.
