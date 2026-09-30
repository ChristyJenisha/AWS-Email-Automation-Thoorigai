# AWS SES setup checklist for reminder emails

This checklist covers the remaining production setup required before the reminder pipeline can send real email from AWS SES instead of the local fallback.

## 1. Confirm the AWS identity and region

- Choose the target AWS region, such as `ap-south-1`.
- Confirm the AWS account and the correct environment (dev, staging, or prod).
- Ensure the application runtime has a valid AWS role or profile with SES send permissions.

Recommended production pattern:
- Use an EC2 instance role, ECS task role, or container-managed IAM role.
- Avoid storing static AWS access keys in the app or in committed files.

## 2. Verify the SES sender identity

In AWS SES:
- Verify the sending email address or domain used in `AWS_SES_FROM`.
- If using a domain, verify the domain and configure the required SPF/DKIM records.
- For sandbox mode, verify recipient addresses before sending to unverified inboxes.

Set the app environment variable:
- `AWS_SES_FROM=notifications@your-domain.example`
- `AWS_REGION=ap-south-1`

## 3. Required IAM permissions

The runtime identity should allow these SES actions:
- `ses:SendEmail`
- `ses:SendRawEmail`

If the project later adds bounce or complaint tracking, it may also need SES event handling permissions and S3 write access for logs.

## 4. Local development behavior

The app is intentionally safe for local development:
- If `AWS_SES_FROM` is empty, the service logs the message instead of failing.
- This keeps local Docker and test runs working without AWS configuration.

This is the current local behavior in [api/src/email/email.service.ts](../api/src/email/email.service.ts).

## 5. Production configuration checklist

Before enabling real email:
- [ ] AWS region is set and matches SES identity
- [ ] `AWS_SES_FROM` is verified in SES
- [ ] IAM role or profile has SES send permissions
- [ ] App environment is set in the target runtime
- [ ] Email templates are reviewed for business wording and sender details
- [ ] Bounce/complaint monitoring is enabled if needed
- [ ] A real test email is sent to a verified inbox

## 6. Smoke test to run after setup

Use a valid SES-verified recipient and trigger a reminder event through the reminder workflow. Confirm:
- the reminder record is created,
- the notification is updated to sent,
- the AWS SES API call succeeds,
- the test recipient receives the email.

## 7. Operational notes

- Keep SES email sending separate from S3 storage credentials.
- Use least-privilege IAM policies and rotate credentials if they are ever used.
- Confirm your SES account is out of the sandbox before sending to production recipients.
- Log delivery failures and monitor sender reputation in production.

## 8. Current status

The reminder system and email service code are already implemented. The remaining work is purely environment and AWS identity verification before production use.
