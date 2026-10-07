# Payment proof upload setup

Local-only development leaves `S3_BUCKET` and `AWS_SES_FROM` blank. Email is simulated and payment proofs are stored under `api/local-storage/payment-proofs/`, which is ignored by Git. The API serves local proof files only to signed-in users with access to the payment's organization.

When `S3_BUCKET` is configured, the API stores payment proofs in S3. The dashboard still uploads through the authenticated API, so browser-side S3 CORS is not needed for this flow.

## Optional: configure S3 CORS for direct uploads

From the repository root in PowerShell, run this only for the intended local test bucket:

```powershell
aws s3api put-bucket-cors `
  --bucket thoorigai-bill-tracker-proofs-2026 `
  --cors-configuration file://infra/aws/s3-local-cors.json `
  --region ap-south-1 `
  --profile thoorigai
```

This command is only needed if a future UI uses direct browser-to-S3 uploads. It updates the bucket's CORS configuration and has not been run. Confirm the account and bucket before using it.

## Local upload flow

1. Start the local dashboard, API, and database.
2. Sign in and open Payment History for a payment.
3. Attach a PDF, JPG, or PNG file no larger than 10 MB.
4. Use **Get view link** and **Open proof** to view the file. Local files use an authenticated API download; S3 files use a fresh five-minute link.

The API checks the payment's organization, enforces the 10 MB limit, and checks file signatures for PDF, JPG, and PNG. Do not store AWS access keys in `.env`; production should use an instance or task role.
