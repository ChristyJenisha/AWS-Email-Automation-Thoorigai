# Bill Collection Tracker

Email-only proof of concept for ThoorigAI Infotech. The local stack runs PostgreSQL, the NestJS API, and the Next.js web app with Docker Compose; local development does not require AWS or Gmail credentials.

## Local setup

From the repository root, run these two commands in PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open the web app at <http://localhost:3000> and the API at <http://localhost:3001>. Stop the stack with `Ctrl+C`; run `docker compose down` to stop and remove containers. Add `-v` only when you intentionally want to delete the local database volume.

For development without Docker, install dependencies with `npm install`, then run `npm run dev`. Set `DATABASE_URL` in `.env` to a reachable PostgreSQL instance.

## Workspace

- `api/`: NestJS API, Prisma schema, and Vitest tests.
- `web/`: Next.js App Router application for the admin and approver surfaces.
- `infra/`: container build files; deployment configuration will be added in the deployment phase.
- `docs/PROJECT-IMPLEMENTATION-LOG.md`: phase-by-phase implementation status, decisions, and verification history.

Run `npm run lint`, `npm test`, or `npm run build` from the repository root.

## Environment variables

See `.env.example` for all app and local database variables. For deployed environments, use AWS Systems Manager Parameter Store and the EC2 instance role; never commit `.env`, Gmail App Passwords, or AWS credentials. The local Compose setup does not need AWS S3 or SMTP configured.

## AWS storage and email configuration

The project uses AWS S3 for bill/payment document storage and AWS SES for reminder emails. The API uses the AWS SDK default credential chain and never accepts access keys from application code. For local container testing on Windows, set `S3_BUCKET` and `AWS_SES_FROM` in `.env` and run the stack with your AWS CLI profile available to the Docker session:

```powershell
$env:AWS_PROFILE = "default"
docker compose up --build
```

The profile must have only the required permissions for S3 and SES. The API falls back to a local simulated email log when `AWS_SES_FROM` is not configured, which is useful for local development and tests without external email access. The SES integration is designed to send reminder emails for due workflow steps and to record the notification as sent when delivery succeeds.

In AWS, attach least-privilege permissions to the EC2 instance or container role and set `AWS_REGION`, `AWS_SES_FROM`, and `S3_BUCKET` in the deployment environment. Do not mount local credentials or use long-lived access keys on EC2. The existing project-named bucket was verified in `ap-south-1` with all public access blocked and AES256 default encryption; confirm it is the intended bucket before setting it in `.env`.

## Workflow API progress

Workflow template routes are available at `GET /workflows?organizationId=demo-org`, `GET /workflows/:id`, `POST /workflows`, `PUT /workflows/:id`, and `DELETE /workflows/:id`. The local seed provides `demo-org`, `demo-approver`, and `demo-backup-approver`. Create/replace requests require a name and at least one stage with an active contact from the same organization. Stage order is the array order; reminder defaults are 24 hours and 3 attempts. A template used by any batch cannot be replaced or deleted.

Batch routes are `GET /batches?organizationId=demo-org`, `GET /batches/:id`, and `POST /batches`. Batch creation accepts `organizationId`, `templateId`, and one or more bills (`billNumber`, positive `amount`, optional ISO `dueDate`). It creates bills and ordered step instances transactionally, marks stage one alerted, schedules its first reminder, and writes an audit row. When SES is configured, the reminder pipeline also sends the actual approval notice to the stage contact and records the notification as sent.

The internal workflow transition service supports complete and return-with-comment actions, advances or reactivates stages after a return, schedules the next reminder, and marks the final batch ready for payment. The authenticated guard and organization checks are in place for the workflow access paths that matter for real use.

The app is now in the working MVP state for local operations; production hardening remains limited to AWS role configuration, real user identity, and deployment environment settings.

## Deployment and rollback

Production deployment, manual rollback, and GitHub Actions steps are intentionally pending Phase 10. Do not deploy this development Compose configuration to EC2.