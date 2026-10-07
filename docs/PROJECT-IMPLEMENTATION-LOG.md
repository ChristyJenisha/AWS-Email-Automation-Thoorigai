# Project Implementation Log

This document tracks completed work, implementation decisions, verification, and remaining work for the Bill Collection Tracker POC. Update it in the same change whenever project behavior or infrastructure changes.

## Project target

Follow `Bill collection tracker — POC implementation plan.pdf`. The current working implementation uses Next.js and NestJS on EC2-style local container hosting, PostgreSQL on local Docker for development, private S3 for bill/payment files, and AWS SES for reminder email dispatch. Local development continues to work without AWS credentials by falling back to a local simulated delivery log when SES is not configured.

## Change log

## File-by-file change inventory

| File | Change and purpose |
| --- | --- |
| `web/src/app/page.tsx` | Dashboard with authenticated API loading, workflow actions, batch creation, contact management, payment review/allocation entry, and clearly temporary demo-bill/payment behavior. |
| `web/src/app/globals.css` | Responsive dashboard, batch/contact/payment dialogs, summary, chart, approval view, and reduced-motion styling. |
| `web/src/app/layout.tsx` | Product page title/description and global stylesheet import. |
| `api/prisma/schema.prisma` | Relational POC entities, status enums, foreign-key relations, and query indexes. |
| `api/prisma/migrations/20260929072721_init/migration.sql` | Initial local database migration generated from the Prisma schema. |
| `api/prisma/seed.js` | Idempotent local demo organization, contacts, and workflow seed. |
| `api/src/prisma/prisma.module.ts` | Global Nest provider module for database access. |
| `api/src/prisma/prisma.service.ts` | Prisma connection lifecycle for Nest startup/shutdown. |
| `api/src/workflows/workflow.dto.ts` | Validated workflow and stage request shapes. |
| `api/src/workflows/workflows.controller.ts` | Workflow list/detail/create/replace/delete HTTP routes. |
| `api/src/workflows/workflows.service.ts` | Organization/contact checks, stage ordering, audit records, and protection of workflows already used by batches. |
| `api/src/workflows/workflows.module.ts` | Registers the workflow controller and service. |
| `api/src/workflows/workflows.service.spec.ts` | Workflow service behavior and boundary tests. |
| `api/src/workflows/workflow-transitions.service.ts` | Complete/return transitions, organization and approver checks, signed approval-token creation/verification/inspection, reminder scheduling, audit writes, and concurrency guards. |
| `api/src/workflows/approvals.controller.ts` | Public token-scoped approval inspection, completion, and return endpoints. |
| `api/src/workflows/workflow-transitions.service.spec.ts` | Tests sequential approval, reactivation after return, final-stage completion, return comments, missing steps, and duplicate action conflicts. |
| `api/src/batches/batch.dto.ts` | Validated batch and bill submission request shapes. |
| `api/src/batches/batches.controller.ts` | Batch list/detail/create HTTP routes. |
| `api/src/batches/batches.service.ts` | Organization/workflow checks, transactional bill/step creation, initial reminder scheduling, audit logging, and post-commit initial approval notification. |
| `api/src/batches/batches.module.ts` | Registers the batch controller and service. |
| `api/src/batches/batches.service.spec.ts` | Batch creation, initial approval state, duplicate bills, and organization-boundary tests. |
| `api/src/payments/payment.dto.ts` | Validated payment and per-bill allocation inputs with optional typed deductions. |
| `api/src/payments/payments.controller.ts` | Authenticated, organization-scoped payment routes, including proof upload confirmation and short-lived download links. |
| `api/src/payments/payments.service.ts` | Transactional payment/allocation writes, bill balance/status updates, final batch completion, audit logging, and proof-key checks. |
| `api/src/payments/payments.service.spec.ts` and `api/src/payments/payments.controller.spec.ts` | Payment allocation, partial/full settlement, rejection rules, organization scoping, and actor attribution tests. |
| `api/src/contacts/contact.dto.ts` | Validated contact create/update request DTOs. |
| `api/src/contacts/contacts.controller.ts` and `api/src/contacts/contacts.service.ts` | Admin-only, organization-scoped contact listing, creation, and updates with duplicate-email protection. |
| `api/src/contacts/contacts.service.spec.ts` and `api/src/contacts/contacts.controller.spec.ts` | Contact normalization, duplicate prevention, organization isolation, and admin-access tests. |
| `web/src/app/page.tsx` | Admin sign-in option and contact manager for updating approver emails without direct database edits. |
| `api/src/reminders/reminders.service.ts` | Initial and due reminder email delivery, signed approval links, notification outcomes, and escalation processing. |
| `api/src/reminders/reminders-scheduler.service.ts` | In-process one-minute cron sweeper with overlap protection and Nest lifecycle cleanup. |
| `api/src/notifications/notifications.module.ts` and `api/src/reminders/reminders.module.ts` | Import AuthModule so guarded controllers resolve AuthGuard dependencies at runtime. |
| `api/src/s3/s3-storage.service.spec.ts` | Regression coverage for browser MIME types with case and charset parameters. |
| `web/src/app/approve/page.tsx` | Token-based approval page that previews batch bills and submits approve/return actions. |
| `api/src/s3/s3.module.ts` | Registers and exports the S3 storage adapter. |
| `api/src/s3/s3-health.controller.ts` | Read-only AWS storage health route at `/health/aws`. |
| `api/src/s3/s3-storage.service.ts` | Default-chain AWS credentials, private bucket checks, and 5-minute presigned upload/download URLs for PDF/JPEG/PNG; checks uploaded files before confirming or signing downloads. |
| `infra/aws/s3-local-cors.json` | Optional CORS example for future direct browser-to-S3 uploads; the current dashboard uploads through the API. |
| `docs/S3-PAYMENT-PROOF-SETUP.md` | Documents local disk proof storage and optional AWS-backed storage. |
| `api/src/app.module.ts` | Registers Prisma, S3, workflow, and batch modules. |
| `api/package.json` and root `package-lock.json` | AWS S3 SDK and DTO-validation dependencies; Prisma generate/migrate/seed scripts. |
| `docker-compose.aws.yml` | Opt-in, read-only mount of the local AWS CLI profile for local container testing. |
| `infra/docker/api.Dockerfile` | Generates Prisma Client during API image build through the API workspace script. |
| `.env.example` | Clarifies AWS S3 settings are optional locally and static AWS keys must not be stored there. |
| `README.md` | Links the implementation log and documents S3 setup, workflow/batch routes, and authentication limitations. |
| `docs/PROJECT-IMPLEMENTATION-LOG.md` | This running record of phase status, decisions, file changes, verification, and next work. |

## Latest verification snapshot

- `npm test --workspace=api` passed: 53 tests across 14 files.
- API build and API lint passed; web production build and focused lint for the changed dashboard passed.
- Browser verification confirmed the local dashboard reports `Live API connected`; local demo login and authenticated workflow/batch reads returned 201/200/200.
- The API maps `/approvals/inspect`, `/approvals/complete`, and `/approvals/return`; an empty inspection request correctly receives HTTP 400 validation.
- No real SES inbox delivery or real approval action was performed in this verification pass.
- Browser verified Admin login, contact manager access, and listing of both seeded contacts; no contact was edited and no email was sent in that check.

### 2026-09-29 - Dashboard prototype

- Replaced the Next.js starter page with a bill-collection dashboard, summary metrics, collection trend, searchable/status-filtered bill list, add-bill dialog, and mark-paid demo action.
- Added responsive app styling and product metadata.
- The records and all mutations are browser-only demo state. They reset on reload and are not connected to the API/database.
- Verification: `npm run build --workspace=web` passed; browser verified the dashboard, overdue filter, and add-bill dialog.

### 2026-09-29 - POC data model and local persistence foundation

- Added Prisma models for organizations, contacts, workflow templates/stages, batches, bills, workflow step instances, payments/allocations, notifications, and audit logs; included POC status enums and indexes.
- Added global Nest `PrismaService` and `PrismaModule`, migration/seed scripts, and Prisma client generation in the API image.
- Created and applied the initial local PostgreSQL migration and an idempotent demo workflow seed.
- Verification: Prisma client generation, API build, unit tests, and lint passed. Local database seed counts were 1 organization, 2 contacts, 1 workflow, and 1 stage. The API returned HTTP 200 after Prisma initialization.
- Docker Desktop later returned an engine HTTP 500 during image export; image export must be retried after Docker Desktop is healthy.

### 2026-09-29 - AWS S3 adapter

- Added AWS SDK v3 S3 dependencies, a Nest S3 service/module, `/health/aws`, and short-lived bill/proof upload and download URL generation.
- Added an opt-in `docker-compose.aws.yml` that mounts the local AWS CLI profile read-only; production is intended to use an EC2 IAM role instead of long-lived keys.
- Documented local AWS profile use and the production credential model in the README.
- Read-only AWS inspection found a likely project bucket, `bill-tracker-poc-foundation-billfilesbucket-r9iwd9znqbx6`, in `ap-south-1`. Public access is blocked and default encryption is AES256. A direct AWS SDK `HeadBucket` and application adapter URL-signing check succeeded; no objects were uploaded.
- No RDS instance was found in `ap-south-1`. Five EC2 instances and seven S3 buckets exist; their ownership/role in this POC is not fully confirmed. No AWS resources were created or changed.
- Verification: API build, test, lint, Compose overlay parsing, AWS SDK bucket health, and signed URL generation passed. Docker Desktop's daemon became unavailable again during an image build; container endpoint verification remains pending.

### 2026-09-29 - Workflow template API (Phase 4 start)

- Added validated workflow request DTOs and list/detail/create/replace/delete routes under `/workflows`.
- Stage contacts must be active and belong to the workflow organization. Stage order is assigned from request order; reminders default to 24 hours and 3 attempts.
- Workflow changes write audit log entries. Templates already used by batches cannot be replaced or deleted.
- These routes are not authenticated yet. Keep this POC API private/local; do not expose it publicly until client authentication and organization authorization are implemented.
- Added unit coverage for organization-scoped contacts, ordered stages/defaults, audit recording, immutability once batches use a workflow, missing organization query, and missing workflow deletion.
- Verification: API build passed; 6 tests across 2 files passed; API lint and TypeScript diagnostics passed. Live `/workflows` HTTP test is blocked because Docker Desktop reports "unable to start" and localhost:3001 times out.

### 2026-09-29 - Batch and bill submission API (Phase 4 continued)

- Added `POST /batches`, `GET /batches?organizationId=...`, and `GET /batches/:id` with validated request DTOs.
- Batch creation verifies the organization/workflow match, requires active stage contacts, rejects duplicate bill numbers, initializes each bill's balance, creates ordered step instances in one database transaction, alerts the first stage, schedules its first reminder, and writes an audit entry.
- Email is not sent yet. The first stage is marked alerted in the database; Phase 5 must dispatch and log its email and handle delivery failures before production use.
- Added tests for the initial stage/reminder state, bill normalization, audit creation, duplicate bill rejection, organization isolation, and inactive approver rejection.
- Verification: API build passed; 10 tests across 3 files passed; lint passed. Live endpoint verification remains blocked by the Docker Desktop daemon failure described above.

### 2026-09-30 - Approval state transitions (Phase 4 continued)

- Added an internal workflow transition service for completing an alerted step, activating its next pending stage and scheduling its reminder, or marking the batch `READY_FOR_PAYMENT` after the final stage.
- Added return-with-comment behavior that reactivates the previous completed stage and records the comment in the audit trail.
- When that previous stage completes again, a returned next stage is reactivated and its old completion/comment fields are cleared so the approval loop can continue.
- Transitions use conditional updates inside a database transaction so duplicate concurrent actions fail rather than double-advance the workflow.
- Added unit tests for advancement, re-review after return, final-stage handling, return comments, missing steps, and duplicate-action conflicts.
- Transition methods are not exposed through HTTP yet. Client authentication and approver identity are required before exposing complete/return/reassign actions.
- Verification: API build passed; 17 tests across 4 files passed; lint passed. Docker-backed runtime checks remain blocked by disk exhaustion on C:.

### 2026-09-30 - SES reminder delivery (Phase 5)

- Added an AWS SES email service with a local fallback so reminders can send in real AWS environments without breaking local development.
- Wired reminder processing to call the email sender when due workflow steps are alerted.
- Updated the reminder service to mark notifications as sent only after the delivery attempt completes.
- Added the email service to the reminder module and validated the flow with unit tests for reminder creation and local fallback logic.
- Verification: `npm test --workspace=api -- --run src/email/email.service.spec.ts src/reminders/reminders.service.spec.ts src/auth/auth.service.spec.ts src/workflows/workflow-transitions.service.spec.ts src/workflows/workflows.controller.spec.ts` passed with 16 tests; `npm run build --workspace=api` also passed.

### 2026-10-02 - Authenticated approval and batch flow

- Upgraded demo login to bcrypt-checked credentials and signed JWT sessions; dashboard requests now wait for a session token, send Bearer authentication, and re-login once if a cached token is rejected.
- Added organization-scoped approval JWTs and public inspect/complete/return endpoints. The approval page previews batch bill balances before allowing an action; returning requires a comment.
- Batch creation now sends the first approval notification after the database transaction commits and records delivery success/failure. Reminder emails include the signed approval URL.
- Added a multi-bill batch creation dialog to the dashboard, connected to the authenticated `POST /batches` endpoint.
- Fixed missing AuthModule imports in guarded NotificationsModule and RemindersModule after live Docker startup exposed Nest dependency-injection failures.
- Normalized S3 upload MIME types, including browser values such as `Application/PDF; charset=binary`.
- Verification: 33 API tests, API build/lint, web build, and focused dashboard lint passed. Local Docker API startup and authenticated reads were verified; SES delivery was not tested against a real inbox.

### 2026-10-02 - Payment allocation API

- Added authenticated `GET /payments/batch/:batchId` and `POST /payments` routes with organization-level access checks.
- Payment recording is allowed only after a batch reaches `READY_FOR_PAYMENT`. Cash allocations plus typed deductions must equal the settlement total; both reduce bill balances.
- Bill balances/statuses, payment allocations, batch completion after the final balance clears, and audit logs are written in one transaction.
- Added tests for partial settlement, final settlement, over-allocation, early payment rejection, amount mismatch, organization scope, and actor attribution.
- Verification: the two focused payment test files pass (7 tests total); full API validation is pending for this change.
- Final verification: full API suite passed with 40 tests across 11 files; API build/lint passed. Local Nest startup registered both payment routes, and an unauthenticated payment request correctly returned HTTP 401.

### 2026-10-02 - Scheduled reminder and escalation engine

- Added an in-process `node-cron` sweep every minute and clean task shutdown with the Nest module lifecycle.
- Added a database lease using a conditional due-step update, so scheduled and manual runs cannot claim the same reminder concurrently; failed primary email delivery is recorded and retried after the lease window without incrementing the reminder count.
- Reminder-limit escalation now sends tracked email to the configured backup approver and active organization contacts with an admin role.
- Added tests for scheduler lifecycle, claim conflicts, failed delivery retry, and escalation recipients.
- Remaining Phase 7 gaps: quiet hours, escalation policy validation with the client, and real SES delivery checks.
- Verification: 44 API tests across 12 files, API build, and API lint passed.

### 2026-10-02 - Admin contact management

- Added admin-only, organization-scoped contact list/create/update APIs with email normalization and duplicate checks.
- Added an Admin sign-in option and responsive dashboard contact editor so the demo approver can be replaced with a real verified recipient.
- Verification: 53 API tests across 14 files, API build/lint, web build, and focused dashboard lint passed. Browser verified Admin login and contact listing; no contact was changed and no real email was sent.

### 2026-10-03 - Payment proof upload and viewing flow

- Added a dashboard payment history with PDF/JPG/PNG proof attachment and viewing-link actions.
- Added an authenticated endpoint that returns a short-lived proof download link only for a payment in the signed-in user's organization.
- Proof keys are now saved only after S3 confirms the uploaded file exists. Downloads also check that the file exists before returning a signed link.
- Added an authenticated API upload path for proof files, with a 10 MB size limit and PDF/JPG/PNG signature checks.
- Local-only mode stores proofs under the ignored `api/local-storage/payment-proofs/` directory; viewing uses an organization-authorized API route.
- The same API upload path writes to S3 when `S3_BUCKET` is configured. No AWS resources were changed.
- Verification remains pending: no build, lint, browser upload, or S3 file upload/download was run for this change.

### 2026-10-03 - Local-only development mode

- Set `AWS_SES_FROM` and `S3_BUCKET` blank in the local `.env` and updated `.env.example` to use email simulation and disable S3 by default.
- Recreated only the API container. The database container and its volume were left running and untouched.
- The API reports S3 as `not_configured`; no AWS resource settings were changed. The local proof flow is implemented but has not been exercised in this update.

### 2026-10-05 - Pending approval batches in dashboard

- Confirmed batch creation transactionally creates one step instance per workflow stage, marks the first stage `ALERTED`, and leaves later stages `PENDING`.
- Made the initial `IN_PROGRESS` batch status explicit when creating a batch.
- Fixed the dashboard approval panel to show every in-progress batch with an alerted step instead of showing only one batch, which could leave a newly created batch hidden behind an older pending batch.
- Approval refreshes now send the signed-in token and reload batches for the user's organization.
- No existing batch records were edited. Build and end-to-end verification remain pending.

### 2026-10-06 - Receivables dashboard calculations

- Dashboard bill mapping now retains both original invoice amount and remaining balance.
- Outstanding, overdue, and due-soon totals now sum remaining balances; aging uses date-only parsing so API timestamps are not misread as invalid dates.
- Recent Bills now displays original amount plus remaining balance, and recognizes partial/disputed payment states with filters.
- Payment totals now use recorded payment amounts, including on-account entries; the this-month value uses payment dates. Demo-only paid bills remain identified as demo data.
- Build and browser verification remain pending for these changes.

### 2026-10-06 - Notification route access checks

- Notification listing now checks that the signed-in user belongs to the batch's organization.
- The notification status route now requires an organization Admin and confirms the notification belongs to the batch in the URL; its database update is also constrained to that batch.
- This route only changes the recorded status to `SENT`; it does not perform email delivery. Actual email sending remains handled by the existing email flows.
- Build and API verification remain pending for these changes.

### 2026-10-07 - Safe local email defaults

- Cleared `AWS_SES_FROM` in `.env.example` so a fresh local setup uses simulated email as its comments describe; AWS SES now requires an intentional local configuration change.
- The existing `.env` was not changed and no email was sent.

## Current phase status

### Done or mostly done

- **Phase 2 - Repo and local setup:** The code repository, Docker setup, and app workspaces are ready. Deployment setup and instructions remain.
- **Phase 3 - Database:** The initial tables, migrations, and demo data are ready. Final business-rule review and client sample data remain.

### In progress

- **Phase 4 - Backend:** Workflows, batches, bills, contacts, login, and approvals are implemented. Reassignment and a final access review remain; notification batch access has been scoped, but this change still needs verification.
- **Phase 5 - Email:** SES email and local simulation are connected. Real delivery and bounce/limit handling need verification.
- **Phase 6 - Approver links:** Signed approval links work. OTP, link revocation/single-use protection, and real-email testing remain.
- **Phase 7 - Reminders:** Scheduling, retries, and escalation are implemented. Quiet hours, recipient agreement, and SES testing remain.
- **Phase 8 - Admin screens:** Login, approvals, batch creation, contacts, and payment review are available. Workflow editing and batch history remain.
- **Phase 9 - Payments:** Payment allocation, on-account flows, and local/S3 proof upload/view code are present. End-to-end checks remain.
- **Phase 11 - QA:** Earlier API tests and local checks passed. The latest dashboard and notification access changes have not yet been verified; full end-to-end and production-readiness checks remain.

### Not started or not ready

- **Phase 1 - AWS setup:** No production AWS resources have been configured. The target server, database, permissions, network rules, and budget need confirmation.
- **Phase 10 - Deployment:** Production hosting, HTTPS, automated deployment, health checks, and rollback are not set up.
- **Phase 12 - Demo and handover:** Demo data, presentation steps, cost/limitation notes, and handover materials are still needed.

**Overall:** The local POC is usable for development, but production deployment and final end-to-end validation are not complete.

## Safety and deployment notes

- Never commit AWS credentials, Gmail app passwords, database passwords, or JWT secrets.
- Use an EC2 instance role for S3 in AWS. The optional local profile mount is read-only and must only be used with a least-privilege profile.
- Do not create or modify AWS resources until the user identifies the target EC2/bucket and confirms an RDS monthly budget.
- Do not deploy the development Compose file publicly. Production identity, OTP, secrets, TLS, SES validation, and deployment controls remain incomplete.
- Keep the demo UI visibly marked as demo until it is wired to persisted APIs.

## Next actions

1. Sign in as Admin, replace the demo approver email with a verified SES recipient, create a fresh batch, and confirm the approval message/link in the inbox and spam folder.
2. Add Phase 7 quiet-hour configuration and agree on the client escalation recipient policy; verify escalation email through SES after identities are ready.
3. Exercise the payment-proof upload and viewing flow in the local stack; optionally verify AWS-backed storage later if needed.
4. Bring magic links into line with the brief: valid until the step is completed, add OTP, record IP/contact attribution, and implement client-approved reassignment.
5. Complete workflow/contact administration and perform a real SES inbox test after sender and recipient identities are ready.
6. After target resources and spend are confirmed, connect the app to RDS and attach the S3 IAM role to the selected EC2 instance; complete CI/CD, health checks, rollback, QA, and handover.
