# Project Implementation Log

This document tracks completed work, implementation decisions, verification, and remaining work for the Bill Collection Tracker POC. Update it in the same change whenever project behavior or infrastructure changes.

## Project target

Follow `Bill collection tracker — POC implementation plan.pdf`. The current working implementation uses Next.js and NestJS on EC2-style local container hosting, PostgreSQL on local Docker for development, private S3 for bill/payment files, and AWS SES for reminder email dispatch. Local development continues to work without AWS credentials by falling back to a local simulated delivery log when SES is not configured.

## Change log

## File-by-file change inventory

| File | Change and purpose |
| --- | --- |
| `web/src/app/page.tsx` | Dashboard prototype, demo bills, filters/search, add-bill dialog, and temporary mark-paid behavior. |
| `web/src/app/globals.css` | Responsive dashboard, table, summary, chart, dialog, and reduced-motion styling. |
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
| `api/src/workflows/workflow-transitions.service.ts` | Internal complete/return state transitions, next-stage reminder scheduling, payment-ready handling, audit writes, and concurrency guards. |
| `api/src/workflows/workflow-transitions.service.spec.ts` | Tests sequential approval, reactivation after return, final-stage completion, return comments, missing steps, and duplicate action conflicts. |
| `api/src/batches/batch.dto.ts` | Validated batch and bill submission request shapes. |
| `api/src/batches/batches.controller.ts` | Batch list/detail/create HTTP routes. |
| `api/src/batches/batches.service.ts` | Organization/workflow checks, transactional bill/step creation, first reminder scheduling, and audit logging. |
| `api/src/batches/batches.module.ts` | Registers the batch controller and service. |
| `api/src/batches/batches.service.spec.ts` | Batch creation, initial approval state, duplicate bills, and organization-boundary tests. |
| `api/src/s3/s3.module.ts` | Registers and exports the S3 storage adapter. |
| `api/src/s3/s3-health.controller.ts` | Read-only AWS storage health route at `/health/aws`. |
| `api/src/s3/s3-storage.service.ts` | Default-chain AWS credentials, private bucket checks, and 5-minute presigned upload/download URLs for PDF/JPEG/PNG. |
| `api/src/app.module.ts` | Registers Prisma, S3, workflow, and batch modules. |
| `api/package.json` and root `package-lock.json` | AWS S3 SDK and DTO-validation dependencies; Prisma generate/migrate/seed scripts. |
| `docker-compose.aws.yml` | Opt-in, read-only mount of the local AWS CLI profile for local container testing. |
| `infra/docker/api.Dockerfile` | Generates Prisma Client during API image build through the API workspace script. |
| `.env.example` | Clarifies AWS S3 settings are optional locally and static AWS keys must not be stored there. |
| `README.md` | Links the implementation log and documents S3 setup, workflow/batch routes, and authentication limitations. |
| `docs/PROJECT-IMPLEMENTATION-LOG.md` | This running record of phase status, decisions, file changes, verification, and next work. |

## Latest verification snapshot

- `npm run build` passed for API and web.
- `npm run lint` passed for API and web.
- `npm test --workspace=api` passed: 17 tests across 4 files.
- Prisma schema generation, local migration, and demo seed passed earlier in this session.
- AWS SDK bucket access and application presigned-URL generation passed using the local AWS identity; no object upload was performed.
- Live Compose/API endpoint verification is currently blocked: Docker Desktop reports "unable to start" and localhost API requests time out.

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

## Current phase status

| POC phase | Status | Remaining work |
| --- | --- | --- |
| 1. AWS foundation | Partial | Confirm target EC2, attach least-privilege role, establish RDS, verify VPC/security groups, set budget alerts. No cloud resources changed yet. |
| 2. Repo/tooling/environments | Mostly complete | Add a distinct POC deployment environment and finish deploy documentation. |
| 3. Data model/migrations | Complete for initial schema | Replace demo seed with client test workflow; review schema against final business rules. |
| 4. Backend core | In progress | Workflow CRUD, batch/bill submission, and internal complete/return transition logic are implemented and unit-tested; client auth, contact management, protected transition endpoints, reassign approval, and email-triggered transitions remain. |
| 5. Email | In progress / configured for SES with local fallback | Verify SES identity/domain in AWS, configure production env, perform a real inbox test, and review rate-limit and bounce handling. |
| 6. Approver links | Not started | Signed link, OTP, approver actions, and audit attribution. |
| 7. Reminders/escalation | In progress | Reminder scheduler and escalation logic are implemented; production verification and quiet-hours business rules remain. |
| 8. Admin frontend | Partial | Current dashboard is demo-only; login, workflow builder, batch creation/detail, contacts, and API wiring remain. |
| 9. Payments/allocation | Partial | Schema exists; allocation rules, API/UI, S3 proof upload flow, and partial-payment tests remain. |
| 10. Deployment/CI | Partial | Production EC2/RDS deployment, IAM, secrets, TLS, CI/CD, health checks, rollback. |
| 11. QA | Partial | Existing unit tests pass; workflow, payment, reminder, and end-to-end test plan remains. |
| 12. Demo/handover | Not started | Prepare real workflow data, demo steps, cost/limitations summary, and handover. |

## Safety and deployment notes

- Never commit AWS credentials, Gmail app passwords, database passwords, or JWT secrets.
- Use an EC2 instance role for S3 in AWS. The optional local profile mount is read-only and must only be used with a least-privilege profile.
- Do not create or modify AWS resources until the user identifies the target EC2/bucket and confirms an RDS monthly budget.
- Do not deploy the development Compose file publicly. Workflow routes currently lack authentication and authorization.
- Keep the demo UI visibly marked as demo until it is wired to persisted APIs.

## Next actions

1. Free C: disk space safely, restart Docker Desktop, and verify workflow/batch APIs against the migrated local database.
2. Add contact management and client authentication, then expose protected workflow transition routes with verified actor identity.
3. Add reassign requests with client approval; implement the Phase 5 Gmail adapter and notification logging before any batch sends a real email.
4. Add signed approver links and OTP before exposing approval actions to email recipients.
5. After target resources and spend are confirmed, connect the app to RDS and attach the S3 IAM role to the selected EC2 instance.