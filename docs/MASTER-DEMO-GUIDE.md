# The Master Button-by-Button Demo Guide
### *Bill Collection Tracker — Complete Click-by-Click Walkthrough*

Use this guide during your review. Every single button, screen, action, and behind-the-scenes process is explained in simple terms.

---

## 🗺️ High-Level Flow of Your Demo
```
1. Setup & Roles ➔ 2. Workflows ➔ 3. Create Batch ➔ 4. Magic Link & OTP ➔ 5. Approvals ➔ 6. Payment ➔ 7. Audit Trail
```

---

## SECTION 1: Top Navigation & Role Switcher Bar

At the very top of your screen, you have the **ACT AS ROLE** toolbar. This lets you switch users instantly without logging out.

| Button / Element | Where It Is | What Happens When You Click It | What Happens Behind the Scenes |
| :--- | :--- | :--- | :--- |
| **`[👑 Admin]`** | Top Role Bar | Logs in as `admin@example.test`. Highlights in dark green. | Loads an Admin JWT session. Unlocks the **Workflows**, **Contacts**, and **Confirm on behalf (offline)** buttons. |
| **`[👤 Primary Approver]`** | Top Role Bar | Logs in as `approver@example.test` (Stage 1 approver). | Switches user context to the primary approver. Restricts admin buttons. |
| **`[🛡️ Backup Approver]`** | Top Role Bar | Logs in as `backup@example.test` (Stage 2 approver). | Switches user context to the escalation / backup approver. |
| **Live Clock** *(top right)* | Header Topbar | Shows live ticking clock (e.g., `Saturday, 10 October 2026, 09:50 AM`). | Automatically updates every second in real time. |

---

## SECTION 2: Workflow Templates Manager (Phase 8)

Ensure **`[👑 Admin]`** is selected at the top.

### 1. Click **`[Workflows (1)]`** (Top Right Action Bar)
* **What opens**: A modal titled **"Workflow Templates"**.
* **What you see on screen**:
  - The existing **`Standard 2-Stage Approval`** template card.
  - **Stage Chips**: 
    - `Stage #1: Approver (24h interval)`
    - `→`
    - `Stage #2: Backup Approver (24h interval)`.
* **What to tell reviewers**:
  > *"Instead of hardcoding rules, our application lets managers configure dynamic, sequential approval workflows with customizable primary approvers, backup approvers, and quiet-hour-compliant reminder intervals."*

### 2. The Stage Builder Form (Inside the Workflows Modal)
* **Template Name Input**: Type a new name (e.g., `Fast-Track Executive Flow`).
* **Primary Approver Dropdown**: Select any contact from the dropdown list.
* **Backup Approver Dropdown**: Select an optional backup contact.
* **Interval (Hours)**: Default is `24` (hours between automated reminder sweeps).
* **Max Tries**: Default is `3` (after 3 tries without response, it automatically escalates to the backup approver).
* **`[＋ Add next approval stage]` Button**: Adds a dynamic `Stage 2` row.
* **`[Save Template]` Button**: Calls `POST /workflows` to save the template to the PostgreSQL database.
* **`[Close]`**: Closes the dialog.

---

## SECTION 3: Create an Approval Batch (Initial Step)

Now let's create a live batch of invoices.

### 1. Click **`[＋ Create batch]`** (Green Button, Top Right)
* **What opens**: The **"Create approval batch"** popup modal.

### 2. Fill in the Batch Form:
* **Workflow Template Dropdown**: Choose `Standard 2-Stage Approval`.
* **Bill number**: Type `INV-2026-001`.
* **Amount (INR)**: Type `100000` (₹1,00,000).
* **Due date**: Select any date next week.
* **`[＋ Add another bill]` Button**: 
  - Click this to add a second invoice!
  - Bill 2 number: `INV-2026-002`.
  - Amount: `50000` (₹50,000).
  - Due date: Select next week.

### 3. Click **`[Create batch]`**
* **What happens immediately on screen**:
  1. The dialog closes.
  2. A green notification appears: *"Batch created. The initial approver notification was attempted."*
  3. Your 2 bills appear in the **Recent Bills** table with status `Due soon`.
  4. At the top of the dashboard, a new card appears: **`WORKFLOW ACTION · BATCH [ID] — Approval in progress`**.
* **What happened behind the scenes**:
  1. The database executed an atomic transaction: saved the batch, locked the bills, created the step instances, and set Stage 1 to `ALERTED`.
  2. **Automated Notification Dispatched**: The email service was triggered automatically. It generated the digitally signed magic link token and recorded a notification as `SENT` in the database!

---

## SECTION 4: The Approver "Magic Link" Experience (⭐ Crucial Demo)

Now, explain how an approver acts on the email they received.

### 1. Click **`[Open Magic Link ↗]`**
* **Where it is**: Inside the pending card at the top.
* **What happens**: Opens a brand new tab at `http://localhost:3000/approve?token=...`.
* **What to tell reviewers**:
  > *"This simulates the link the approver clicks directly from their email inbox on their phone or laptop. Notice that no password or dashboard login is required—the security is handled cryptographically via signed tokens and email OTP."*

### 2. The Verification Screen:
* **Invoice Summary**: Displays `INV-2026-001` (₹1,00,000) and `INV-2026-002` (₹50,000), Total Balance: `₹1,50,000.00`.
* **OTP Verification Box**:
  - The screen prompts: *"Verify your email. A six-digit verification code was sent..."*
  - In local development mode, you will see a green badge: **`Local email simulation code: [123456]`** (e.g., `123456`).
  - Type the **6 digits** into the box.

### 3. Click **`[Verify code]`**
* **What happens**: The box validates the code and unlocks 3 action buttons:
  - **`[Approve batch]`** (Primary Green Button): Approves the batch and advances the workflow.
  - **`[Return with comment]`** (Secondary Button): If the invoice has an error, approver enters a reason in the comment box and returns it.
  - **`[Request reassignment]`** (Secondary Button): If the approver is on vacation, flags the step for admin reassignment.

### 4. Click **`[Approve batch]`**
* **What happens**: 
  - The card says: *"Approval recorded. This link can no longer be used."*
  - Re-opening or refreshing this link will reject any double-action!
  - The approver's **client IP address and browser User-Agent** are permanently written to the audit log.

---

## SECTION 5: Dashboard Progression & Offline Confirmation

Switch your browser tab back to the main dashboard: **`http://localhost:3000`**.

### 1. Observe the Live Progression:
* The card has automatically advanced to **Stage 2: Backup Approver**!
* In the toolbar, click **`[👑 Admin]`**.

### 2. The **`[Confirm on behalf (offline)]`** Button:
* **Where it is**: Next to the approval buttons on the Stage 2 card.
* **What to tell reviewers**:
  > *"In real business operations, a Director or VP may call the receivables team to give verbal confirmation over the phone. Instead of getting stuck, our Admin can click 'Confirm on behalf (offline)' to record the manual approval."*
* **Type a note**: In the text box, type: `Approved verbally via phone call with Director`.
* **Click `[Confirm on behalf (offline)]`**:
  - Stage 2 completes!
  - The batch status automatically moves to **`READY_FOR_PAYMENT`**!
  - The action is recorded in the audit trail with an explicit `source: 'manual'` tag.

---

## SECTION 6: Payment Settlement & Proof Upload (Phase 9)

Scroll down slightly to the new section: **`PAYMENT REVIEW · Ready for payment`**.

### 1. Click **`[Record payment]`**
* **What opens**: The **"Allocate payment"** popup dialog.
* **What you see**:
  - Row 1: `INV-2026-001` (₹1,00,000 remaining).
  - Row 2: `INV-2026-002` (₹50,000 remaining).

### 2. Enter Allocations & Deductions:
* **Bill 1 (`INV-2026-001`)**:
  - Cash applied: Type `98000`.
  - Deduction: Type `2000`.
  - Type: Select `TDS` (Tax Deducted at Source).
  - *(Notice: 98,000 + 2,000 = 1,00,000 total settlement)*.
* **Bill 2 (`INV-2026-002`)**:
  - Cash applied: Type `50000`.
* **Payment Date**: Select today's date.
* **Reference / UTR**: Type `UTR-HDFC-99214`.
* **Click `[Save allocations]`**:
  - The dialog closes.
  - The bills in the table turn green with status **`Paid`**!
  - The batch moves to **`COMPLETED`**!

### 3. Attach Payment Proof:
* Under **"Payment History"**, click **`[Attach proof]`**.
* Pick any PDF, JPG, or PNG file from your computer.
* Once uploaded, click **`[Get view link]`** / **`[Open proof]`** to demonstrate the secure download action.

---

## SECTION 7: Full Audit Trail & Email History (Phase 8)

Scroll down to the **"Approval Batches"** table at the bottom of the page.

### 1. Click **`[Audit trail & details →]`**
* **What opens**: The **"Batch Details & Lifecycle"** modal.

### 2. Walk Through the 4 Tabs:
1. **`[Stages]` Tab**:
   - Shows Stage 1 completed by the primary approver.
   - Shows Stage 2 completed via offline confirmation.
2. **`[Bills]` Tab**:
   - Shows `INV-2026-001` (₹1,00,000 paid, balance ₹0.00).
   - Shows `INV-2026-002` (₹50,000 paid, balance ₹0.00).
3. **`[Audit Trail]` Tab** *(⭐ Compliance Winner)*:
   - Shows the permanent chronological timeline:
     - `BATCH_CREATED`
     - `STEP_COMPLETED` (via magic link, with exact client IP and timestamp)
     - `STEP_CONFIRMED_ON_BEHALF` (with note: *"Approved verbally via phone call..."*)
     - `PAYMENT_ALLOCATED`
4. **`[Email Log]` Tab**:
   - Shows the exact email dispatch records: recipient address, status `SENT`, and dispatch timestamp.

---

## 💡 Quick Summary Checklist for Your Meeting

| Action to Take | Where to Click | Result to Point Out |
| :--- | :--- | :--- |
| **Start with Clean Board** | `http://localhost:3000` | Shows 0 bills, ₹0 outstanding. |
| **Show Role Switching** | `[👑 Admin]` / `[👤 Approver]` | Permanent bar at top switches context. |
| **Show Workflow Templates** | `[Workflows]` button | Visual stage builder with 24h intervals. |
| **Create Fresh Batch** | `[＋ Create batch]` | Instant transactional bill creation. |
| **Demonstrate Magic Link** | `[Open Magic Link ↗]` | No-password token link with email OTP. |
| **Demonstrate Offline Approval**| `[Confirm on behalf (offline)]` | Admin phone approval override. |
| **Settle Payments** | `[Record payment]` | TDS deduction + Proof upload. |
| **Prove Compliance** | `[Audit trail & details →]` | Chronological audit logs with client IP. |
