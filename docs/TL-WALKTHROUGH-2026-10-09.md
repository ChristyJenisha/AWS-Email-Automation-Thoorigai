# Bill Collection Tracker — Simple Project Walkthrough

**Prepared:** 9 October 2026  
**Purpose:** A plain-English guide for reviewing the POC with a team lead.

## 1. What the project does

This is an email-based bill collection tracker. A user creates a batch of bills. The bills move through approval steps in order. Approvers receive a link, review the bills, and approve them or return them with a comment. The system can send reminders. When approval is finished, an admin records money received, assigns it to bills, and can attach proof of payment.

The goal is to make bill approval and collection visible in one place. It is a proof of concept (POC), so some production work is still open.

## 2. How the pieces fit together

```text
User's browser
  ├─ Next.js web app (port 3000)
  └─ sends API requests to NestJS (port 3001)
       ├─ Prisma reads and writes PostgreSQL
       ├─ AWS SES sends email when configured
       └─ AWS S3 stores files when configured
```

For local development, Docker Compose starts PostgreSQL, the API, and the web app. When AWS email is not configured, email is simulated for local use. When S3 is not configured, payment proofs use local storage. The local setup is not the same as a production AWS deployment.

## 3. Main folders and important files

| Location | What it contains |
| --- | --- |
| `web/` | The browser application, built with Next.js and React. |
| `web/src/app/page.tsx` | Main dashboard: bills, approval/payment areas, sign-in, and admin dialogs. |
| `web/src/app/approve/page.tsx` | Page opened by an approver link; shows bill information and the approval/return flow. |
| `web/src/app/globals.css` | Shared colors, layout, responsive styles, dialogs, and visual design. |
| `api/` | Server application, built with NestJS and TypeScript. It checks requests and applies business rules. |
| `api/src/workflows/` | Workflow templates, approval links, and approve/return transitions. |
| `api/src/batches/` and `api/src/bills/` | Batch and bill creation and retrieval. |
| `api/src/payments/` | Payments, bill allocations, deductions, and proof upload/view routes. |
| `api/src/reminders/`, `email/`, and `notifications/` | Scheduled reminders, email sending/simulation, and delivery records. |
| `api/src/contacts/` and `api/src/auth/` | Organization contacts and demo sign-in/access checks. |
| `api/src/s3/` | S3 storage integration and AWS storage health route. |
| `api/src/audit/` | Audit module used to record important business actions. |
| `api/src/prisma/` | Shared Prisma database connection for the API. |
| `api/prisma/schema.prisma` | Database tables, relationships, and status types. |
| `api/prisma/migrations/` | Versioned database structure changes. The latest OTP migration must be applied to the local database. |
| `api/prisma/seed.js` | Demo organization, contacts, and workflow data for local use. |
| `infra/docker/` | Docker build instructions for the API and web app. |
| `infra/aws/` | AWS-related examples; currently includes an optional S3 CORS file. |
| `docker-compose.yml` | Local development services: PostgreSQL, API, and web app. |
| `docker-compose.aws.yml` | Optional local AWS CLI profile mount for testing; it does not deploy the app. |
| `docs/` | Project status, AWS setup notes, payment-proof notes, and this walkthrough. |
| `.env.example` | Safe template of settings needed to run the app. Use it as a guide; never share actual secret values. |

## 4. Database in simple terms

The project uses **PostgreSQL**, a relational database. In local development it runs as a Docker container. **Prisma** is the tool the API uses to describe the database and read/write records. Prisma migrations update the database structure in controlled steps.

The important records are:

| Record | Meaning |
| --- | --- |
| Organization | The company or workspace that owns the data. |
| Contact | An admin, approver, or backup approver and their email address. |
| Workflow template and stage | The approval plan and the people/order of its steps. |
| Batch | One submitted collection/approval group. |
| Bill | An invoice in a batch, with original amount, remaining balance, due date, and status. |
| Step instance | A particular approval step for a particular batch; stores state and reminder timing. |
| Payment | Money received, date, reference, optional proof, and any unallocated balance. |
| Payment allocation | The part of a payment assigned to an individual bill, including typed deductions. |
| Notification | A record of an email attempt and its result. |
| Audit log | A record of important actions for later review. |

The database also stores a temporary OTP hash/expiry/attempt information for approval verification. The migration that adds these fields exists in the project, but the implementation log says it still needs to be applied to the local database.

## 5. AWS services and what they do here

| AWS item | Intended use in this project | Current state from the repository notes |
| --- | --- | --- |
| **Amazon S3** | Private storage for bill/payment documents. The API checks the file and can return a short-lived viewing link. | Code is present. Local mode uses disk storage when no bucket is configured. An earlier project log says a likely private bucket was inspected, but the intended bucket and a current end-to-end upload still need confirmation. |
| **Amazon SES** | Sends approval and reminder email. | Integration code is present. Local mode simulates email when `AWS_SES_FROM` is blank. A real inbox delivery, sender verification, sandbox status, and bounce/complaint handling remain to be verified. |
| **IAM role/profile** | Gives the API permission to call AWS without putting AWS access keys in source code. | Default AWS credential lookup and an optional read-only local profile mount exist. A production EC2/task role is not confirmed. |
| **Amazon EC2** | A possible server to host the app. The URL provided for review uses a public IP. | This review environment could not connect to that IP, so it did not confirm which server serves it or what is deployed there. The project notes say production hosting/deployment is not complete. |
| **Amazon RDS** | Managed PostgreSQL for a deployed environment. | The app uses PostgreSQL locally. RDS production setup is not complete; the implementation log says no RDS instance was found in the checked region during its earlier inspection. |
| **Systems Manager Parameter Store** | A recommended place for deployed configuration/secrets. | Mentioned in deployment guidance; no completed deployment integration is recorded. |

**Not currently evidenced as implemented:** AWS CloudWatch monitoring, automated deployment/CI, production HTTPS setup, and a configured production RDS database. Do not present these as completed features.

## 6. Features and current state

| Feature | What a user can do | Current state |
| --- | --- | --- |
| Dashboard | View recent bills, amount outstanding, overdue/due-soon totals, approval/payment areas, and payment history. | Available locally; some dashboard figures/demo bills are still sample/demo data. |
| Sign-in and roles | Sign in to the demo Admin or approver surface and make organization-scoped API requests. | Implemented for the POC. Production identity and account/security review are still needed. |
| Workflow templates | Define ordered approver stages on the API. | Backend routes exist. A full workflow editor in the dashboard is still listed as remaining. |
| Create batch and bills | Submit one or more bills into an approval workflow. | Implemented. Batch, bills, and approval steps are created together in a database transaction. |
| Approval | An approver opens a token link, reviews bill balances, and approves or returns with a reason. | Implemented. OTP is in code; its migration and real-email end-to-end flow still need verification. |
| Approval reminders | Send reminders on a schedule and escalate after the configured attempts. | Scheduler, retry, and escalation logic exist. Quiet hours, policy agreement, and actual SES testing remain. |
| Contacts | Admin can list, add, or update organization contacts from the dashboard. | Implemented; final access review and real recipient checks remain. |
| Payment recording | Record payments after a batch is ready, allocate money to bills, add supported deductions, and retain unallocated money. | Backend and dashboard flow exist; full current end-to-end verification remains. |
| Proof files | Upload PDF/JPG/PNG proof and open it using local access or an S3 viewing link. | Local storage flow has worked in the user's previous local run. AWS-backed end-to-end flow remains unverified. |
| Audit/notifications | Keep records of workflow and payment actions and email delivery outcomes. | Data structures and API logic exist; final operational review remains. |

## 7. Work completed so far, in order

The implementation log records work from **29 September to 8 October 2026**. In simple terms:

1. The repository was organized into a web app, API, database schema, Docker setup, and project notes.
2. PostgreSQL schema, initial migration, and demo seed data were added.
3. Workflow and batch APIs were built. Creating a batch creates its bills and ordered approval steps together.
4. Approval state changes, signed approval links, and email notification/reminder code were added.
5. The dashboard gained bill views, batch creation, contact management, approval/payment areas, and payment-proof controls.
6. Payment allocation, partial payment, deductions, on-account handling, and proof storage code were added.
7. Reminder scheduling, retry, escalation, audit records, and organization access checks were added.
8. On 8 October, approval OTP was added with expiry, retry limits, and a database migration. API/web builds passed according to the log; tests were not run for that OTP work and the migration was not applied locally.

The earlier project log reports successful tests/builds for earlier changes. That evidence does not prove every current workflow is fully tested. The latest documented check says the Oct 8 builds passed, tests were not run for the OTP change, and end-to-end/production checks remain.

## 8. Phase status against the POC plan

| Phase | Status | Plain-English explanation |
| --- | --- | --- |
| 1. AWS foundation | **Not ready** | Production server/database/permissions/network and spend plan need confirmation. S3/SES code or earlier read-only inspection does not mean production is deployed. |
| 2. Repository and local setup | **Mostly complete** | Web/API workspaces and local Docker setup exist. Production setup instructions are still incomplete. |
| 3. Database | **Mostly complete** | PostgreSQL schema, migrations, and seed data exist. Apply the latest OTP migration locally and finish business-data review. |
| 4. Backend | **In progress** | Main APIs for batches, bills, workflows, contacts, and approvals exist. Reassignment and final access checks remain. |
| 5. Notifications/email | **In progress** | SES integration and local simulation exist. Real sending, delivery monitoring, and failure handling need verification. |
| 6. Approver links | **In progress** | Signed links and OTP code exist. Apply migration and verify complete real-email approval/return flows and action attribution. |
| 7. Reminders/escalation | **In progress** | Scheduling, retry, and escalation exist. Quiet hours and policy/SES checks remain. |
| 8. Admin web screens | **In progress** | Dashboard, contacts, batch creation, approvals, and payments exist. Workflow editor and batch history remain. |
| 9. Payments | **In progress** | Allocation/on-account and proof flows exist. Complete the full local and optional AWS checks. |
| 10. Deployment/CI | **Not ready** | Production hosting, HTTPS, automated release, health checks, and rollback are not set up. |
| 11. QA | **In progress** | Earlier automated checks passed. OTP-specific tests and full end-to-end checks are outstanding. |
| 12. Demo and handover | **Not complete** | Prepare verified demo data, demonstration steps, limitations/cost notes, and final handover. |

## 9. UI/UX update in this review

The existing screen structure and forest-green/sage identity were preserved. Small styling refinements were made in `web/src/app/globals.css`: clearer search focus, larger filter/status/action targets, visible row actions on touch devices, scrollable navigation and filters on narrow screens, better bounded dialogs on small screens, and clear keyboard focus. These changes do not alter API behavior, database tables, or the bill/approval/payment process.

The live address `http://13.126.39.176:3000/` could not be reached from this review environment. Therefore, the new styling has not been visually checked on that server. It must be built/deployed and checked in a browser before saying the live site has the new design.

## 10. Recommended review/demo order

1. Start the local app and confirm the dashboard says the live API is connected.
2. Sign in as Admin and show the bill list and current approval batches.
3. Create a small test batch and point out its bills and first pending approval.
4. Open the approver link, request/enter the OTP, then approve or return the test batch.
5. Show the reminder/notification status without claiming real email unless the test inbox received it.
6. When the batch is ready, record a small test payment, allocate it to a bill, and attach a test proof file.
7. Open the local proof. Explain S3 is the optional AWS version and show it only after a real S3 upload/download test.
8. End with the remaining phases: apply OTP migration, finish end-to-end checks, verify SES/S3, then agree AWS production resources/budget and deployment plan.

Use a test batch and test document during the demonstration. Do not send real customer emails or use real financial records unless the team has approved that test.

## 11. Short report to the team lead

> The local Bill Collection Tracker POC has the main bill, approval, reminder, payment, contact, and proof flows implemented. It uses Next.js, NestJS, PostgreSQL, and Prisma. AWS SES and S3 integrations are present, while local development can simulate email and store proof files locally. The OTP database migration, latest end-to-end checks, real SES/S3 verification, production security/configuration, deployment, and handover are still open. The supplied public URL was not reachable from my review environment, so its current deployed version has not been confirmed.
