# CollectFlow: Review Findings and Remediation Guide

**Audience:** the developer who built the CollectFlow interface and will finish the project.
**Repo reviewed:** `Thoorigai-Infotech-Academy/CollectFlow`, branch `main`, up to commit `285265d` (2026-10-23).
**Review date:** 2026-10-24.
**How it was reviewed:** the code, configuration and Cloudflare build log were read. The app was **not** run and the tests were **not** executed, so please treat the findings as "found by reading" and confirm each one as you fix it.

---

## 1. Read this first

### What is already good (keep doing this)

- The **payment maths is careful**: money is handled in whole cents, stored as `Decimal(14,2)`, and every payment is written inside one database transaction. Do not "simplify" this.
- The **approval OTP flow is well built**: random codes, stored only as hashes, 5-attempt limit, expiry, single use.
- Every API controller **checks the user's organization**, and request bodies are validated.
- The **frontend was reorganised well** in the last commits: components, a typed API client, shared types.
- There is a **real test suite** and a CI pipeline.

### What needs fixing, in one paragraph

The product code is in decent shape. The **repository and deployment are not safe or finished.** Real passwords and secret keys are committed to git. The Cloudflare deployment is failing and, as designed, cannot work. A few login and security shortcuts from the demo phase are still in the code. Fixing these is mostly small, well-defined work.

### The 4 things to do first (before anything else)

1. **Revoke and rotate the leaked secrets** (Section 3, items P0-1 and P0-2).
2. **Remove the secret files from git** (P0-3), only after your lead agrees, because it rewrites shared history.
3. **Stop using the public tunnel** (P0-4).
4. **Fix the build and decide the hosting plan** (Section 5).

### Priority labels

| Label | Meaning |
|---|---|
| **P0** | Urgent. Real credentials are exposed. Do today. |
| **P1** | Must be fixed before any real user or real data touches the system. |
| **P2** | Must be fixed before calling the project production-ready. |
| **P3** | Cleanup and quality. Do it, but it will not break anything if it waits. |

### How each item is written

Every item has: **What is wrong**, **Why it matters**, **How to fix it**, **How to check it is fixed**. Do them in the order shown in Section 9.

---

## 2. Quick glossary

| Term | Plain meaning |
|---|---|
| **Secret** | A password or key the app uses (database password, JWT secret, email password). Must never be in git. |
| **JWT** | The login token the browser sends with every request. It is signed with `JWT_SECRET`. Whoever knows that secret can create a token for any user, including an admin. |
| **`.env` file** | A local file holding secrets. It must be listed in `.gitignore` and never committed or zipped into a bundle. |
| **Rotate** | Create a new secret and stop using the old one. Needed after any leak. |
| **Git history** | Git keeps every old version of every file. Deleting a file in a new commit does **not** remove it from the past. |
| **CORS** | A browser rule about which websites may call your API. |
| **Rate limiting** | Slowing or blocking a client that sends too many requests (protects the login page from password guessing). |
| **SSRF** | Tricking your server into making a web request to an address the attacker chooses. |
| **SNS / SES** | AWS services. SES sends email; SNS delivers bounce and complaint notifications back to your API. |
| **Outbox** | A database table of "emails to send" that a worker processes, so an email is never lost if the app crashes. |
| **Idempotency key** | A unique ID sent with a request so that repeating it (double click, retry) does not create a duplicate. |

---

## 3. P0: Leaked secrets and exposure (do today)

> **Important:** the secret *values* are deliberately not written in this document. Open the files locally to see them, and do not paste them anywhere.

### P0-1. A Gmail password is committed in plain text

- **What is wrong:** `scratch/test_smtp.py` contains the Gmail address `thoorigai.infotech.ai@gmail.com` and its 16-character app password directly in the code.
- **Why it matters:** anyone who can see the repository (or any clone of it) can send email as that account. The password is also in git history, so deleting the file is not enough.
- **How to fix it:**
  1. Sign in to the Google account → Security → **App passwords** → **revoke** the existing one.
  2. Create a new app password and store it **only** in the server's environment (not in any file in git).
  3. Delete `scratch/test_smtp.py` (the whole `scratch/` folder is also not needed, see P3-1).
- **How to check:** the old app password no longer works for SMTP login; `git grep -i "smtp.gmail.com"` finds no password.

### P0-2. A `.env` file is zipped inside `deploy_bundle.tar.gz`

- **What is wrong:** `deploy_bundle.tar.gz` (added in commit `cd66718`) contains `api/.env`. That file holds: `DATABASE_URL`, `JWT_SECRET`, `TOKEN_SIGNING_SECRET`, `SMTP_USER`, `SMTP_PASS`, plus AWS profile and mail settings.
- **Why it matters:** with `JWT_SECRET` someone can forge an admin login. With `TOKEN_SIGNING_SECRET` they can forge approval links. With `DATABASE_URL` they may reach the database. The `.env` is also **not** in `.gitignore` for this file type, because it was hidden inside an archive.
- **How to fix it:** treat every value in that file as compromised and **rotate all of them**:

  | Secret | New value |
  |---|---|
  | `JWT_SECRET` | New random string, 48+ characters |
  | `TOKEN_SIGNING_SECRET` | A **different** new random string, 48+ characters |
  | Database password | Change in PostgreSQL and update `DATABASE_URL` |
  | `SMTP_PASS` | New app password (same as P0-1) |
  | AWS access | If any AWS keys were ever stored, deactivate them in IAM |

  Generate a random secret with: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

  After rotating, existing login sessions and old approval links stop working. That is expected and correct.
- **How to check:** the old secrets are rejected by the live system; a login token signed with the old `JWT_SECRET` returns 401.

### P0-3. Remove the secret files from git history

- **What is wrong:** even after you delete `deploy_bundle.tar.gz` and `scratch/test_smtp.py`, they remain downloadable from older commits.
- **Why it matters:** rotating (P0-1, P0-2) makes the leaked values useless, which is the real protection. Purging history is the second layer so the files are not lying around.
- **How to fix it:** **ask your lead first**, because this rewrites shared history and everyone must re-clone afterwards.
  ```bash
  pip install git-filter-repo
  git clone --mirror https://github.com/Thoorigai-Infotech-Academy/CollectFlow collectflow-mirror.git
  cd collectflow-mirror.git
  git filter-repo --invert-paths \
    --path deploy_bundle.tar.gz \
    --path scratch/ \
    --path cloudflared.exe \
    --path api_out.log
  git push --force
  ```
  Then tell everyone to delete their local copy and clone again. Ask GitHub support to clear cached views if the repo was ever public.
- **How to check:** `git log --all -- deploy_bundle.tar.gz` prints nothing.

### P0-4. The public tunnel exposes the app to the internet

- **What is wrong:** `START_PUBLIC_TUNNEL.bat` runs `cloudflared tunnel --url http://localhost:3000`, creating a public web address for your local machine. Locally the app runs in **demo mode** with the known demo logins, and `JWT_SECRET` may be on its default.
- **Why it matters:** a finance app with default logins was reachable by anyone who learned the random URL.
- **How to fix it:** stop using it, delete `START_PUBLIC_TUNNEL.bat` and `cloudflared.exe` (a 55 MB file that should never be in git). If coworkers need to test, deploy a proper staging environment (Section 5) with real credentials and `DEMO_MODE=false`.
- **How to check:** no `cloudflared` process running; files gone from the repo.

---

## 4. P1: Security fixes in the code

### P1-1. JWT secret has a public fallback

- **Where:** `api/src/auth/auth.service.ts`, function `getJwtSecret()` (around line 281).
- **What is wrong:** `process.env.JWT_SECRET ?? 'bill-collection-demo-secret-change-me'`. If the variable is missing on the server, the app silently signs logins with a string that is visible in the code.
- **Why it matters:** anyone who reads the repo can forge an admin token on any server that forgot to set the variable.
- **How to fix it:**
  ```ts
  private getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be set to at least 32 characters');
    }
    return secret;
  }
  ```
  Better still, also call it once at startup in `main.ts` so the app refuses to start instead of failing at the first login.
- **How to check:** start the API with `JWT_SECRET` unset: it must refuse to start. Add a unit test for it.

### P1-2. The SES/SNS webhook trusts anyone

- **Where:** `api/src/notifications/ses-webhook.controller.ts` and `notifications.service.ts` (`handleSnsEvent`).
- **What is wrong:**
  1. The endpoint `POST /notifications/ses-events` accepts requests from anyone and never checks that AWS really sent them.
  2. When a message says `SubscriptionConfirmation`, the code runs `fetch(payload.SubscribeURL)`: it calls **whatever URL the sender supplies**. That is SSRF.
- **Why it matters:** an attacker can fake "bounce" or "complaint" events (which deactivate contacts, see `isActive: false` in the service), silently disabling real approvers. They can also make your server call internal addresses.
- **How to fix it:**
  1. Verify the SNS signature with the `sns-validator` package before doing anything.
  2. Only call `SubscribeURL` if its hostname matches `sns.<region>.amazonaws.com`.
  3. Check `TopicArn` equals the one you configured (put it in an env variable `SNS_TOPIC_ARN`).
  ```ts
  import MessageValidator from 'sns-validator';
  const validator = new MessageValidator();
  validator.validate(payload, (err) => { if (err) throw new ForbiddenException(); });
  const host = new URL(payload.SubscribeURL).hostname;
  if (!/^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(host)) throw new ForbiddenException();
  ```
- **How to check:** a hand-made POST with a fake body returns 403 and changes nothing; a real SNS test message still works.

### P1-3. Demo login still exists in the web app (`/legacy`)

- **Where:** `web/src/app/legacy/page.tsx` (lines ~217-274).
- **What is wrong:** the old page automatically logs in as `admin@example.test` with password `demo123` when no token exists. It was kept after the redesign.
- **Why it matters:** if demo mode is ever on, anyone opening `/legacy` is an admin. Dead code with a built-in password is a liability.
- **How to fix it:** delete the whole `web/src/app/legacy/` folder. Search the web code for `demo123` and `NEXT_PUBLIC_DEMO_MODE` and remove everything that depends on them, unless a dev-only switch is truly needed.
- **How to check:** `git grep demo123 web/` is empty; `/legacy` returns 404.

### P1-4. Demo users are compiled into the production API

- **Where:** `auth.service.ts`, the `demoUsers` map and `isDemoEnabled()`.
- **What is wrong:** protection depends on `DEMO_MODE` being `false` on the server. The demo users (password `demo123`) exist in the production code.
- **How to fix it:** make the API **refuse to start** when `NODE_ENV=production` and `DEMO_MODE=true`. Keep demo users only for development and tests.
- **How to check:** `NODE_ENV=production DEMO_MODE=true` fails at startup; `admin@example.test` cannot log in on the live site.

### P1-5. CORS allows every website

- **Where:** `api/src/main.ts` → `app.enableCors({ origin: true, credentials: true, ... })`.
- **What is wrong:** `origin: true` copies whatever website is calling and allows it, together with credentials.
- **Why it matters:** any website could call your API from a logged-in user's browser. It is lower risk today (tokens are sent manually), but becomes serious as soon as login moves to cookies (P1-8).
- **How to fix it:** read an allowlist from an environment variable.
  ```ts
  const allowed = (process.env.CORS_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  app.enableCors({ origin: allowed, credentials: true, methods: [...], allowedHeaders: [...] });
  ```
  Example: `CORS_ORIGINS=https://thoorigaibilltracker.com`.
- **How to check:** a request with `Origin: https://evil.example` receives no CORS headers.

### P1-6. No rate limiting and no security headers

- **What is wrong:** `/auth/login` can be tried unlimited times; the public `/approvals/*` endpoints are open too. No `helmet` headers.
- **Why it matters:** attackers can guess passwords or tokens at high speed.
- **How to fix it:**
  ```bash
  npm i @nestjs/throttler helmet --workspace=api
  ```
  Add `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])` globally, and a **stricter** `@Throttle({ default: { limit: 5, ttl: 60_000 } })` on `login`, `request-otp` and `verify-otp`. In `main.ts` add `app.use(helmet())`.
- **How to check:** the 6th login attempt in a minute returns `429 Too Many Requests`.

### P1-7. The caller's IP address can be faked in the audit log

- **Where:** `api/src/workflows/approvals.controller.ts`: `req.headers['x-forwarded-for']` is read directly.
- **What is wrong:** any client can send its own `X-Forwarded-For` header, so the "who approved from where" record can be forged.
- **How to fix it:** tell the app how many trusted proxies sit in front of it (Nginx = 1) and use `req.ip`.
  ```ts
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);
  // then in controllers: const ip = req.ip;
  ```
- **How to check:** sending a fake `X-Forwarded-For: 1.2.3.4` directly does not change the stored IP.

### P1-8. Login token is stored in `localStorage`

- **Where:** `web/src/lib/api.ts` and `SignInView` (keys `thoorigai-token`, `thoorigai-user`).
- **What is wrong:** anything that runs JavaScript on the page (a single XSS bug) can read and steal the token.
- **How to fix it:** have the API set the token as an **httpOnly, Secure, SameSite=Lax cookie** on login, read it in `AuthGuard`, and add a `POST /auth/logout` that clears it. On the web side use `fetch(url, { credentials: 'include' })` and delete the `localStorage` code. Add a Content-Security-Policy header in `next.config.ts`. Do this together with P1-5 (CORS allowlist is required for cookies).
- **How to check:** in the browser console, `localStorage` has no token and `document.cookie` cannot see the session cookie.

### P1-9. Roles are free text

- **Where:** `Contact.role` is a plain `String`; `assertAdminAccess` compares `role.toLowerCase() === 'admin'`; the reminder escalation searches `role contains 'admin'`.
- **What is wrong:** a typo ("Admn") silently removes admin rights; a role like "Not an admin" would match the `contains 'admin'` escalation query.
- **How to fix it:** create a Prisma `enum Role { ADMIN APPROVER BACKUP_APPROVER }`, migrate existing values, and replace the string comparisons.
- **How to check:** only the three enum values can be saved; escalation emails go only to real admins.

### P1-10. Approval-link actions that do not need the email code

- **Where:** `approvals.controller.ts`: `inspect` and `reassign` accept the link token alone, while `complete` and `return` require the OTP.
- **What is wrong:** whoever has the emailed link can see the bill numbers and amounts, and request a reassignment, without proving they own the mailbox.
- **How to fix it:** decide with the business owner. The safe default: require the OTP-verified token for everything that shows amounts or changes anything.
- **How to check:** `inspect` with an un-verified token returns 401.

### P1-11. `/health/aws` is public

- **Where:** `api/src/s3/s3-health.controller.ts`.
- **What is wrong:** anyone can see whether your S3 bucket is connected.
- **How to fix it:** keep a simple public `/health` that returns only `{status:"ok"}`; protect `/health/aws` with `AuthGuard` and the admin check.

---

## 5. P1: Deployment (Cloudflare)

### What I saw in the Cloudflare dashboard

- Worker named **`collectflow`**, linked to the GitHub repo, branch `main`.
- Build settings: build command `npm run build`, deploy command `npx wrangler deploy`, root directory `/`.
- **Latest build (#0c693d07) failed after 51 seconds** in the *Building* step. The earlier steps (clone, install) passed. Nothing was deployed.
- Traffic: no Worker invocations, no errors, because no code is running.
- A domain **`thoorigaibilltracker.com`** exists on the account. It was not checked whether it points at this project.

### P1-12. The build fails because the Prisma client is never generated

- **What is wrong:** the log shows errors like `Module '"@prisma/client"' has no exported member 'BatchStatus'` and `Namespace 'Prisma'…`. `@prisma/client` only contains your models after you run `prisma generate`. The root `build` script (`nest build` then `next build`) never runs it. Your GitHub CI works because it runs `npm run db:generate --workspace=api` first.
- **How to fix it (pick one):**
  - Add to `api/package.json`: `"postinstall": "prisma generate --schema prisma/schema.prisma"` (works everywhere, recommended), **or**
  - Change the Cloudflare build command to: `npm run db:generate --workspace=api && npm run build`.
- **How to check:** run `npm ci && npm run build` on a clean clone: it must pass. Then retry the build in Cloudflare.

### P1-13. The hosting design cannot work on a Cloudflare Worker (decision needed)

- **What is wrong:** the repo has no `wrangler.toml` / `wrangler.jsonc` and no OpenNext adapter, so `wrangler deploy` has nothing to deploy. More importantly, the API is a long-running **NestJS server** with Prisma, a background scheduler (runs every minute) and files written to local disk. Cloudflare Workers are short-lived functions and do not run that kind of application as is.
- **Options (decide with your lead; the recommendation is Option B):**

  | Option | What it means | Effort | Notes |
  |---|---|---|---|
  | **A. Web on Cloudflare, API on EC2** | Deploy only the Next.js app to Cloudflare using `@opennextjs/cloudflare` (or Pages). Keep the API, database and scheduler on EC2. | Medium | Needs OpenNext config; API URL must be a real domain. |
  | **B. Everything on EC2, Cloudflare only in front (recommended)** | Use the existing `docker-compose.prod.yml`, Nginx and deploy scripts. Point Cloudflare DNS (orange cloud/proxy) at the EC2 address for free HTTPS and protection. | Low | Closest to what is already written in `infra/`. |
  | **C. Rewrite the API for Workers** | Replace NestJS/Prisma with Workers-compatible code and D1/Hyperdrive. | Very high | Not recommended. |

- **How to check:** after the chosen option, `https://<your-domain>/` shows the sign-in page, and `https://<your-domain>/api/health` (or `/health`) returns OK.

### P1-14. Old tunnel and LAN addresses in `web/next.config.ts`

- **What is wrong:** the file allows `lots-lawn-locate-img.trycloudflare.com` (a temporary tunnel address that no longer exists) and the LAN address `192.168.1.12`.
- **How to fix it:** remove both. Read allowed hosts from an environment variable (for example `ALLOWED_DEV_ORIGINS`) so that nothing machine-specific is committed.

### P1-15. Two deployment pipelines compete

- **What is wrong:** `.github/workflows/deploy.yml` deploys to EC2 over SSH, while Cloudflare also builds the same repo. Also, the SSH step uses `if: ${{ env.EC2_HOST != '' }}`, which does not behave the way it looks (the `env` value is set on the step itself).
- **How to fix it:** choose **one** deploy path (Section 5, Option A or B) and delete the other. If keeping GitHub Actions, check the secret in a job-level `if` or a first step instead.

---

## 6. P2: Architecture and reliability (before production)

### P2-1. Reminders run inside the API process

- **Where:** `api/src/reminders/reminders-scheduler.service.ts` (a sweep every minute).
- **What is wrong:** if you ever run two copies of the API, both run the sweep; if the app restarts at the wrong moment, a reminder can be late. Conditional database updates already prevent double-processing, which is good, but it is still fragile.
- **How to fix it:** move reminders to a separate **worker** using a queue (`pg-boss` is easiest because it uses the PostgreSQL you already have; BullMQ needs Redis). The API only schedules; the worker sends.
- **How to check:** run two API instances; each reminder is sent exactly once.

### P2-2. Emails are sent in the middle of database changes

- **What is wrong:** a step can be marked complete while the email about the next step fails (or the reverse), and there is no automatic retry beyond a 5-minute rule.
- **How to fix it:** an **outbox table**: in the same transaction as the state change, insert a row "send this email". A worker reads unsent rows, sends, marks them sent, and retries with back-off. Rows that fail repeatedly go to a "dead" state that an admin can see.
- **How to check:** turn email off, approve a step, turn email on; the email still goes out.

### P2-3. Organization checks rely on every developer remembering them

- **What is wrong:** each controller method calls `assertOrganizationAccess(...)` by hand. A new endpoint that forgets it leaks one customer's data to another.
- **How to fix it:** create a decorator/guard (for example `@OrgScoped()`) that resolves the resource's organization and checks it automatically, and add a test that fails if any non-public route lacks it.

### P2-4. Payment creation can be duplicated

- **Where:** `POST /payments`.
- **What is wrong:** a double click or a network retry can record the same payment twice.
- **How to fix it:** accept an `Idempotency-Key` header (the web app sends a new UUID per form open), store it on `Payment` with a unique index, and return the first result if it is seen again.
- **How to check:** sending the same request twice creates one payment.

### P2-5. Single server and local files

- **What is wrong:** one EC2 host, a Docker database container, and payment proofs stored on a local Docker volume. If the machine dies, so can the data.
- **How to fix it:** use **Amazon RDS** (managed PostgreSQL with backups) and **S3 only** for proofs in production (the S3 code already exists). Turn on automated backups and test one restore.

### P2-6. Logging and monitoring are minimal

- **What is wrong:** only `console.log`, no request IDs, no alert when emails fail.
- **How to fix it:** structured JSON logs (for example `nestjs-pino`) with a request ID; a global exception filter; an alert (email/Slack) when a notification stays `FAILED` or the health check fails.

### P2-7. No data-retention rules

- **What is wrong:** several relations use `onDelete: Cascade` (deleting a batch removes bills and payments). Financial records usually must be kept for years.
- **How to fix it:** agree retention rules with the business, switch to **soft delete** (a `deletedAt` column) for batches, bills and payments, and restrict hard deletes to admins with an audit entry.

### P2-8. No API documentation and hand-copied types

- **What is wrong:** `web/src/types/index.ts` duplicates the API's shapes by hand, so they can drift apart silently.
- **How to fix it:** add `@nestjs/swagger` to publish an OpenAPI file, then generate the web client/types from it (`openapi-typescript`).

---

## 7. P3: Repository cleanup and code quality

| # | What is wrong | How to fix it |
|---|---|---|
| **P3-1** | Junk files are committed: `scratch/` (many test scripts), `api_out.log`, `deploy_bundle.tar.gz`, `cloudflared.exe`, `api/check_db.cjs`, `api/inspect_batch.cjs`, `START_SERVERS.bat`, and duplicate `.docx` reports. | Delete them (the first four are covered in Section 3). Add to `.gitignore`: `*.log`, `*.tar.gz`, `*.exe`, `scratch/`, `.env`, `.env.*` (keep `!.env.example`). |
| **P3-2** | `Thoorigai_Ledger_Project_Status_Report.docx` sits in `web/public/`, so it is downloadable by anyone from the live site. | Move reports to `docs/` or remove them. Never put internal documents in `public/`. |
| **P3-3** | `web/package-lock.json` was deleted. Web installs are no longer reproducible. | Restore it (`cd web && npm install`) and commit it. |
| **P3-4** | `as any` and `request: any` are used in many places (for example `(step.stage.contact as any)?.isActive` in `reminders.service.ts`). | Use Prisma's generated types (`Prisma.StepInstanceGetPayload<...>`) and a typed `AuthedRequest` interface. The compiler then catches mistakes. |
| **P3-5** | Very large files: `payments.service.ts` (~780 lines), `workflow-transitions.service.ts` (~700), `web/src/app/batches/page.tsx` (~1,600), `settings/page.tsx` (~1,640). | Split by responsibility (for example payment validation, payment persistence, proof handling) and move page sections into components. Do this gradually, with tests passing each time. |
| **P3-6** | Few frontend tests; no end-to-end tests for the approval and payment journeys. | Add e2e tests (Playwright) for: create batch → approve with OTP → record payment → upload proof. Add component tests for the modals. |
| **P3-7** | No automatic secret scanning, so the leaks in Section 3 could happen again. | Add `gitleaks` to the Husky pre-commit hook and to CI. |
| **P3-8** | The web app and API read environment variables in several places with no central check. | Validate all required variables at startup (`@nestjs/config` + a schema) and list every variable in `.env.example`. |

---

## 8. New environment variables introduced by these fixes

Add these to `.env.example` with placeholder values (never real ones):

| Variable | Used for |
|---|---|
| `JWT_SECRET` | Now **required**, 32+ characters |
| `TOKEN_SIGNING_SECRET` | Already required; keep it different from `JWT_SECRET` |
| `CORS_ORIGINS` | Comma-separated list of allowed website addresses |
| `SNS_TOPIC_ARN` | Expected SNS topic for the webhook |
| `DEMO_MODE` | Must be `false` in production (API refuses to start otherwise) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH` | Bootstrap admin when `DEMO_MODE=false` |
| `ALLOWED_DEV_ORIGINS` | Dev-only Next.js allowlist (replaces hard-coded addresses) |

---

## 9. Recommended order of work

**Day 1: stop the bleeding**
1. P0-1, P0-2: revoke and rotate all secrets.
2. P0-4: stop and delete the public tunnel.
3. Agree P0-3 (history purge) with your lead and schedule it.

**Week 1: make it safe**
4. P1-1 (JWT secret), P1-3 (delete `/legacy`), P1-4 (demo mode guard).
5. P1-5 (CORS), P1-6 (rate limit + helmet), P1-7 (trust proxy).
6. P1-2 (SNS webhook).
7. P1-12 (Prisma build fix), P3-1 to P3-3 (cleanup and lockfile).
8. Decide the hosting option (P1-13) and finish P1-14, P1-15.

**Week 2: finish properly**
9. P1-8 (cookie login), P1-9 (role enum), P1-10, P1-11.
10. P2-3 (org guard), P2-4 (idempotency), P2-8 (OpenAPI).

**Before go-live**
11. P2-1, P2-2 (worker and outbox), P2-5 (RDS + S3), P2-6 (logging/alerts), P2-7 (retention).
12. P3-4 to P3-8 (types, splitting, tests, secret scanning).

---

## 10. Definition of done (final checklist)

- [ ] Leaked Gmail app password revoked; all secrets from the bundle rotated.
- [ ] `git log --all -- deploy_bundle.tar.gz scratch/` is empty (after the approved history rewrite).
- [ ] `git grep -i -E "demo123|demo-secret|smtp.gmail.com"` finds nothing outside tests.
- [ ] API refuses to start without a strong `JWT_SECRET` and with `DEMO_MODE=true` in production.
- [ ] SNS webhook rejects unsigned or fake messages.
- [ ] CORS allowlist, rate limiting and helmet are active.
- [ ] Session token is no longer in `localStorage`.
- [ ] `npm ci && npm run build` passes on a clean clone; Cloudflare/EC2 deployment succeeds.
- [ ] `/` shows the sign-in page and `/api/health` returns OK on the live domain.
- [ ] Reminders and emails survive a restart (worker + outbox).
- [ ] Payments cannot be duplicated.
- [ ] Database backups are on, and one restore has been tested.
- [ ] `gitleaks` runs on every commit.
- [ ] CI is green: lint, unit tests, e2e tests, build.

---

## 11. If you get stuck

- Fix **one item per branch** and open one pull request for each, so each change can be reviewed and rolled back separately. Never work on `main` directly.
- After each fix, run `npm run lint`, `npm test` and `npm run build` from the repo root.
- When a fix touches login, payments or approvals, add or update a test that would have caught the original problem.
- Ask early about the three decisions that are not purely technical: the **hosting option (P1-13)**, the **history rewrite (P0-3)** and the **approval-link rules (P1-10)**.
