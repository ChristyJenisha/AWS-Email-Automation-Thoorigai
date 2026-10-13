# Thoorigai Ledger — Client Handover & Operations Guide
**Product:** Bill Collection Tracker with AWS Email Automation  
**Organization:** ThoorigAI Infotech  
**Version:** 1.0.0 (Production-Ready POC)

---

## Table of Contents
1. [Executive Summary & System Architecture](#1-executive-summary--system-architecture)
2. [Quickstart: Local & Server Setup](#2-quickstart-local--server-setup)
3. [Environment Configuration (`.env`)](#3-environment-configuration-env)
4. [Amazon SES Setup & Email Verification](#4-amazon-ses-setup--email-verification)
5. [User Roles & Contact Management](#5-user-roles--contact-management)
6. [Designing Approval Workflows](#6-designing-approval-workflows)
7. [Creating Batches & Submitting Bills](#7-creating-batches--submitting-bills)
8. [The Approver Journey (Magic Link & 2FA OTP)](#8-the-approver-journey-magic-link--2fa-otp)
9. [Automated Reminders & Escalation Engine](#9-automated-reminders--escalation-engine)
10. [Payment Settlement, TDS & Allocations](#10-payment-settlement-tds--allocations)
11. [Audit Trail & Compliance Reporting](#11-audit-trail--compliance-reporting)
12. [Troubleshooting & Support Runbook](#12-troubleshooting--support-runbook)

---

## 1. Executive Summary & System Architecture

Thoorigai Ledger is an enterprise receivables management system designed to eliminate lost invoices, payment delays, and authorization bottlenecks. It features password-less approver workflows, automated Amazon SES reminder loops, statutory deductions tracking (TDS/Retention), and immutable audit logs.

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           THOORIGAI LEDGER SYSTEM                           │
│                                                                             │
│  ┌───────────────────────┐              ┌────────────────────────────────┐  │
│  │   Next.js Frontend    │  HTTP: 3000  │        NestJS API              │  │
│  │ (Admin Dashboard &    │ ───────────► │ (State Machine, Workflow Engine│  │
│  │  Approver Magic Link) │              │  In-process node-cron Sweeper) │  │
│  └───────────────────────┘              └────────┬──────────────┬────────┘  │
│                                                  │              │           │
│                                      PostgreSQL  │              │ AWS SDK   │
│                                      Port: 5432  ▼              ▼           │
│                                        ┌───────────┐    ┌────────────────┐  │
│                                        │ Database  │    │ Amazon SES &   │  │
│                                        │ (Prisma)  │    │ S3 Storage     │  │
│                                        └───────────┘    └────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Frontend (`web`)**: Next.js 16 with responsive executive dashboard and dedicated token-based approval portal (`/approve`).
- **Backend (`api`)**: NestJS modular service implementing strict state-machine transitions and concurrency controls.
- **Database (`db`)**: PostgreSQL 16 managed via Prisma ORM with relational integrity and cascade policies.
- **Cloud Services**: Amazon Simple Email Service (SES) for email alerts, Amazon S3 for document storage.

---

## 2. Quickstart: Local & Server Setup

### System Prerequisites
- **Docker Desktop** (version 24+ recommended) with Docker Compose.
- **Node.js** (v20+ LTS) and **npm** (v10+).
- **Git** installed on the machine.

### Installation Steps (Run in Terminal)

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd "AWS Email Automation Thoorigai"
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

3. **Initialize the local container stack**:
   ```bash
   docker compose up -d
   ```
   *This starts the PostgreSQL database (port 5432), the NestJS API (port 3001), and the Next.js frontend (port 3000).*

4. **Verify running services**:
   ```bash
   docker compose ps
   ```
   You should see `db`, `api`, and `web` in an `Up` status.

5. **Access the application**:
   - **Admin Dashboard**: `http://localhost:3000`
   - **API Health Check**: `http://localhost:3001/health`

---

## 3. Environment Configuration (`.env`)

The `.env` file at the root of the project contains the core operational settings:

```dotenv
# Database Configuration
POSTGRES_DB=bill_tracker
POSTGRES_USER=tracker
POSTGRES_PASSWORD=local-dev-only
DATABASE_URL=postgresql://tracker:local-dev-only@db:5432/bill_tracker?schema=public

# Application Ports & URLs
API_PORT=3001
WEB_PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:3001
APPROVAL_APP_URL=http://localhost:3000

# Security Secrets (Replace with long random strings for production)
JWT_SECRET=super-secret-jwt-signing-key-for-admin-sessions
TOKEN_SIGNING_SECRET=cryptographic-secret-for-approver-magic-links
OTP_TTL_SECONDS=600

# AWS SES Configuration
AWS_REGION=ap-south-1
AWS_SES_FROM=thoorigai.infotech.ai@gmail.com
```

> **Security Rule**: In production (AWS EC2), secrets should be loaded from AWS Systems Manager Parameter Store rather than plain text `.env` files.

---

## 4. Amazon SES Setup & Email Verification

The system sends emails using **Amazon Simple Email Service (SES)** in region `ap-south-1` (Mumbai).

### Understanding Sandbox vs. Production Mode
1. **Sandbox Mode (Default for new AWS Accounts)**:
   - Amazon requires **both** the sender email and all recipient emails to be verified before sending.
   - Rate limit: 200 emails per 24 hours.
2. **Production Mode (Live Business Use)**:
   - In AWS Console ➔ Amazon SES ➔ click **"Request Production Access"**.
   - Once approved by AWS (typically 12–24 hours), emails can be sent to **any recipient in the world** without prior verification.

### How to Verify a New Approver Email in AWS SES (Sandbox Mode)
If you add a new approver while in sandbox mode, verify their email in AWS:
```bash
# Using AWS CLI
aws ses verify-email-identity --email-address "approver@company.com" --region ap-south-1
```
Amazon will automatically send a confirmation email. The approver must click the link in that email once. Afterwards, delivery is permanently unlocked.

---

## 5. User Roles & Contact Management

### Role Definitions
- **Administrator (`Admin`)**: Finance/operations team. Can create batches, configure workflows, add contacts, record payments, and view audit trails.
- **Approver (`Approver`)**: Department manager or director. Reviews invoices, confirms approvals, requests revisions, or delegates.

### Adding New Approvers in the Dashboard
1. Log in as an **Admin** at `http://localhost:3000`.
2. Click **`Contacts`** on the top navigation bar.
3. Under **ADD CONTACT**:
   - **Name**: e.g., `Rajesh Kumar`
   - **Email**: `rajesh@company.com`
   - **Role**: `Approver` (or `Backup approver`)
4. Click **`Add contact`**.

---

## 6. Designing Approval Workflows

Workflows define the sequential chain of review for bill batches before payment release.

### How to Create or Edit a Workflow Template
1. In the top bar, click **`Workflows`**.
2. Under **CREATE NEW WORKFLOW TEMPLATE**:
   - **Workflow Name**: e.g., `Executive Operations Approval`
   - **Stage 1**:
     - *Primary Approver*: Select the primary manager from the dropdown.
     - *Backup Approver*: Select the backup manager (steps in during escalation or leave).
     - *Interval (Hours)*: Hours between automated reminders (e.g., `24`).
     - *Max Tries*: Number of reminders before automatic escalation (e.g., `3`).
   - *(Optional)* Click **`＋ Add Stage`** for multi-level review (e.g., Stage 1: Department Manager ➔ Stage 2: VP of Finance).
3. Click **`Save workflow template`**.

---

## 7. Creating Batches & Submitting Bills

Invoices are processed in **batches** to allow grouping related bills under a single approval cycle.

### Step-by-Step Batch Creation:
1. On the dashboard, click the green button **`＋ Create batch`**.
2. Select the **Workflow & Approver Chain** from the dropdown.
3. Review the approver banner:
   > 📧 *Magic Link will be sent to: Primary Approver (email)*
4. Enter bill details:
   - **Bill number**: e.g., `INV-2026-001`
   - **Amount (INR)**: e.g., `100000`
   - **Due date**: Select due date from the picker.
   - *(Optional)* Click **`＋ Add another bill`** to add additional invoices to this batch.
5. Click **`Create batch`**.

**Result**: 
- The batch enters **`ALERTED`** status.
- Stage 1 is activated.
- AWS SES automatically dispatches the Magic Link to the Primary Approver's inbox.

---

## 8. The Approver Journey (Magic Link & 2FA OTP)

Approvers **never need to remember passwords or register accounts**.

```
1. Email Received in Inbox ──► Contains HMAC-Signed Magic Link
2. Approver Clicks Link    ──► Opens /approve?token=...
3. Security Gate Triggers  ──► AWS SES delivers 6-digit OTP code
4. Approver Inputs OTP     ──► Identity Confirmed (Verified Approver)
5. Action Buttons Unlock   ──► [Approve] or [Return for Revision]
```

### Reviewing & Actioning the Batch:
1. The approver opens the link in their email (or click **`Open Magic Link ↗`** in the demo).
2. **2-Factor Identity Verification**:
   - The approver clicks **`Send verification code`** (or uses **`✨ Auto-Fill & Verify`** in demo mode).
   - Enters the 6-digit OTP sent to their email.
3. **Approver Actions**:
   - **✅ Approve batch**: Type an optional note and click approve. The batch advances to Stage 2 (or moves to `READY_FOR_PAYMENT`).
   - **↩️ Return for revision**: If an invoice has errors, enter a required comment. The batch returns to the previous stage with the reason recorded.
   - **🔄 Request reassignment**: If on vacation, the approver can delegate the batch to the backup approver.

---

## 9. Automated Reminders & Escalation Engine

The system features an **in-process automated sweeper** running every 60 seconds (`node-cron`).

### How SLA Reminders Work:
- Every minute, the scheduler checks for steps where `status = 'ALERTED'` and `next_reminder_at <= now()`.
- **Quiet Hours Suppression**: Reminders are silenced between **11:00 PM and 8:00 AM IST** to prevent disturbing approvers at night.
- Each reminder increments `reminder_count` and updates the next reminder schedule.

### Automated Escalation to Backup Approver:
- When `reminder_count >= max_reminders` (e.g., 3 unanswered alerts):
  1. The step transitions to **`ESCALATED`**.
  2. AWS SES sends an urgent escalation alert to the **Backup Approver**.
  3. A new secure Magic Link is generated specifically for the backup approver.
  4. The escalation event is stamped into the audit trail.

---

## 10. Payment Settlement, TDS & Allocations

When all approval stages complete, the batch moves to the Finance department in **`READY_FOR_PAYMENT`** status.

### Settle Payments with Statutory Deductions:
1. On the dashboard, locate the batch and click **`Record payment`**.
2. **Payment Header**:
   - Enter **Amount received** (e.g., `100000`).
   - Enter **Bank Reference / UTR** (e.g., `HDFC-NEFT-98210`).
   - *(Optional)* Attach payment proof PDF/receipt (stored in private S3).
3. **Bill-Level Allocation & Deductions**:
   - For each bill, assign the cash amount.
   - If tax was withheld at source, enter:
     - **Deduction Type**: `TDS` (or `Retention`, `Penalty`)
     - **Deduction Amount**: e.g., `10000`
   - *Example*: Cash `90,000` + TDS `10,000` = `100,000` settlement.
4. Click **`Confirm Payment`**.
5. Once all bills reach balance ₹0, the batch transitions to **`COMPLETED`**.

---

## 11. Audit Trail & Compliance Reporting

Every action in the system writes to an **immutable, append-only audit trail**.

To inspect the history of any batch:
1. On the batch table, click **`Audit trail & details →`**.
2. Explore the 4 inspection tabs:
   - **Stages**: Shows who reviewed each stage, timestamps, and comments.
   - **Bills**: Shows individual invoice balances, payment dates, and settlements.
   - **Notifications**: Full delivery log of every email sent via AWS SES.
   - **Audit**: Chronological system event log (Batch created ➔ OTP sent ➔ Approved ➔ Payment settled).

---

## 12. Troubleshooting & Support Runbook

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **`401 Unauthorized` on dashboard action** | User session expired or clicked "Sign out". | Click **`👑 Admin`** at the top bar to refresh your session. |
| **`403 Forbidden: Administrator access is required`** | Currently acting as an Approver. | Switch to **`Admin`** role before adding contacts or workflows. |
| **Email not arriving in recipient inbox** | Recipient not verified in AWS SES Sandbox. | Verify the email address in AWS SES Console or request AWS Production access. |
| **`Open Magic Link ↗` button missing** | Step is not in `ALERTED` status. | Ensure the previous stage was approved. Completed batches move to payment. |
| **Database connection error on startup** | PostgreSQL container is still starting. | Run `docker compose restart api` after database healthcheck passes. |
| **Want to reset test bills to clean slate** | Accumulated test data. | Execute table truncate command in PostgreSQL (`TRUNCATE TABLE payment_allocations, payments, bills, notifications, step_instances, batches, audit_log CASCADE;`). |

---

### Support & Handover Contacts
- **Project Lead**: Christy Jenisha (`christyjenisha12@gmail.com`)
- **System Administrator**: ThoorigAI Infotech (`thoorigai.infotech.ai@gmail.com`)
- **Deployment Region**: AWS Asia Pacific (`ap-south-1`, Mumbai)
