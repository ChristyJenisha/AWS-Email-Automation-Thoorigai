import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import nodemailer, { type Transporter } from 'nodemailer';

export type SendReminderEmailInput = {
  to: string;
  subject: string;
  body: string;
  html?: string;
  sensitive?: boolean;
};

export type SendEmailResult = {
  status: 'sent' | 'simulated';
  provider: 'ses' | 'smtp' | 'local-dev';
  messageId?: string;
  to: string;
  subject: string;
};

export type ApprovalEmailTemplateInput = {
  headline: string;
  recipientName?: string;
  leadMessage: string;
  batchId?: string;
  batchName?: string;
  batchLabel?: string;
  stageOrder?: number;
  totalAmount?: number | string;
  otpCode?: string;
  otpExpiresMinutes?: number;
  ctaUrl?: string;
  ctaText?: string;
  subNotice?: string;
};

export function buildApprovalEmailHtml(input: ApprovalEmailTemplateInput): string {
  const brandName = 'Thoorigai Ledger';
  const ctaBtn = input.ctaUrl
    ? `
      <div style="text-align: center; margin: 24px 0 16px 0;">
        <a href="${input.ctaUrl}" style="background-color: #0f766e; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 26px; border-radius: 6px; display: inline-block;">
          ${input.ctaText || 'Review & Approve Batch'}
        </a>
      </div>
      <p style="font-size: 11px; color: #64748b; text-align: center; margin: 0 0 16px 0; word-break: break-all;">
        Or open directly: <a href="${input.ctaUrl}" style="color: #0f766e;">${input.ctaUrl}</a>
      </p>
    `
    : '';

  const otpBox = input.otpCode
    ? `
      <div style="background-color: #f8fafc; border: 2px dashed #0f766e; border-radius: 8px; padding: 20px 16px; text-align: center; margin: 24px 0;">
        <div style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px;">
          SINGLE-USE VERIFICATION CODE
        </div>
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; margin: 6px 0;">
          ${input.otpCode}
        </div>
        <div style="font-size: 12px; color: #64748b; margin-top: 6px;">
          Enter this code manually on the approval page (valid for ${input.otpExpiresMinutes ?? 30} minutes)
        </div>
      </div>
    `
    : '';

  const metaItems: string[] = [];
  const batchDisplay = input.batchName || (input.batchId ? input.batchId.slice(0, 12) : undefined);
  const batchLabel = input.batchLabel || (input.batchName ? 'Batch Name:' : 'Batch Reference:');
  if (batchDisplay) metaItems.push(`<tr><td style="padding: 6px 0; color: #64748b; font-size: 13px;">${batchLabel}</td><td style="padding: 6px 0; color: #0f172a; font-weight: 600; font-size: 13px; text-align: right;">${batchDisplay}</td></tr>`);
  if (input.stageOrder) metaItems.push(`<tr><td style="padding: 6px 0; color: #64748b; font-size: 13px;">Workflow Stage:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 600; font-size: 13px; text-align: right;">Stage ${input.stageOrder}</td></tr>`);
  if (input.totalAmount) metaItems.push(`<tr><td style="padding: 6px 0; color: #64748b; font-size: 13px;">Amount:</td><td style="padding: 6px 0; color: #0f766e; font-weight: 700; font-size: 13px; text-align: right;">₹${input.totalAmount}</td></tr>`);

  const metaTable = metaItems.length > 0
    ? `
      <div style="background-color: #f1f5f9; border-radius: 6px; padding: 12px 16px; margin: 18px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          ${metaItems.join('')}
        </table>
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${input.headline}</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
    <div style="background-color: #0f766e; padding: 18px 24px; text-align: left;">
      <span style="font-size: 17px; font-weight: 700; color: #ffffff; letter-spacing: 0.3px;">${brandName}</span>
      <span style="display: block; font-size: 12px; color: #99f6e4; margin-top: 2px;">Workflow Notifications</span>
    </div>

    <div style="padding: 24px 24px;">
      <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #0f172a; font-weight: 700;">
        ${input.headline}
      </h2>
      <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: #334155;">
        ${input.leadMessage}
      </p>

      ${metaTable}
      ${otpBox}
      ${ctaBtn}

      ${input.subNotice ? `<p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 14px 0 0 0;">${input.subNotice}</p>` : ''}
    </div>

    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.6;">
      <strong>${brandName}</strong> &bull; Workflow Notification<br/>
      This message was sent to you as an authorized reviewer in Thoorigai Ledger.<br/>
      If you have questions, please reach out to your administrator.
    </div>
  </div>
</body>
</html>
  `.trim();
}

@Injectable()
export class EmailService {
  private readonly sesClient: SESClient | null = null;
  private readonly sesFrom: string | undefined;
  private readonly smtpTransporter: Transporter | null = null;
  private readonly smtpFrom: string | undefined;

  constructor() {
    this.sesFrom = process.env.AWS_SES_FROM?.trim();
    const region = process.env.AWS_REGION || 'ap-south-1';
    this.sesClient = this.sesFrom ? new SESClient({ region }) : null;

    // Check for SMTP configuration (e.g. Gmail SMTP or custom SMTP)
    const smtpHost = process.env.SMTP_HOST?.trim() || (process.env.GMAIL_USER ? 'smtp.gmail.com' : undefined);
    const smtpUser = process.env.SMTP_USER?.trim() || process.env.GMAIL_USER?.trim();
    const rawPass = process.env.SMTP_PASS?.trim() || process.env.GMAIL_APP_PASSWORD?.trim();
    const smtpPass = rawPass ? rawPass.replace(/^["']|["']$/g, '').replace(/\s+/g, '') : undefined;
    const rawFrom = process.env.SMTP_FROM?.trim() || process.env.EMAIL_FROM?.trim() || smtpUser;
    this.smtpFrom = rawFrom ? (rawFrom.includes('<') ? rawFrom : `"Thoorigai Infotech" <${rawFrom}>`) : undefined;

    if (smtpHost && smtpUser && smtpPass) {
      const port = Number(process.env.SMTP_PORT ?? (smtpHost === 'smtp.gmail.com' ? 587 : 587));
      const secure = process.env.SMTP_SECURE === 'true' || port === 465;
      this.smtpTransporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      console.log(`[EMAIL_SERVICE] Configured SMTP transporter (${smtpHost}:${port}) for ${smtpUser}`);
    }
  }

  async sendReminderEmail(input: SendReminderEmailInput): Promise<SendEmailResult> {
    const to = input.to.trim();
    const subject = input.subject.trim() || 'Workflow reminder';
    const body = input.body.trim() || 'This is a workflow reminder.';

    // 1. Try SMTP if configured (e.g. Gmail or custom relay)
    if (this.smtpTransporter && this.smtpFrom) {
      try {
        const info = await this.smtpTransporter.sendMail({
          from: this.smtpFrom,
          to,
          subject,
          text: body,
          html: input.html || `<div style="font-family: sans-serif; line-height: 1.5; color: #1e293b;">
            <p>${body.replace(/\n/g, '<br/>')}</p>
          </div>`,
        });
        console.log(`[EMAIL_SENT_SMTP] To: ${to} (MessageId: ${info.messageId})`);
        return { status: 'sent', provider: 'smtp', messageId: info.messageId, to, subject };
      } catch (smtpError) {
        console.warn('[EMAIL_WARN] SMTP email sending failed:', (smtpError as Error).message);
      }
    }

    // 2. Try AWS SES if configured
    if (this.sesClient && this.sesFrom) {
      try {
        const rawEmail = this.sesFrom.replace(/.*<([^>]+)>.*/, '$1').trim();
        const formattedSource = this.sesFrom.includes('<')
          ? this.sesFrom
          : `"Thoorigai Ledger" <${rawEmail}>`;

        const result = await this.sesClient.send(
          new SendEmailCommand({
            Source: formattedSource,
            Destination: { ToAddresses: [to] },
            ReplyToAddresses: [rawEmail],
            Message: {
              Subject: { Data: subject, Charset: 'UTF-8' },
              Body: {
                Text: { Data: body, Charset: 'UTF-8' },
                ...(input.html ? { Html: { Data: input.html, Charset: 'UTF-8' } } : {}),
              },
            },
          }),
        );
        console.log(`[EMAIL_SENT_SES] To: ${to} (MessageId: ${result.MessageId})`);
        return { status: 'sent', provider: 'ses', messageId: result.MessageId, to, subject };
      } catch (sesError) {
        console.warn('[EMAIL_WARN] SES email sending failed, falling back to local simulation:', (sesError as Error).message);
      }
    }

    // 3. Fallback to local simulation mode for local dev/testing
    if (process.env.NODE_ENV === 'production' && !this.smtpTransporter && !this.sesClient) {
      throw new ServiceUnavailableException('Email delivery is unavailable right now');
    }

    console.log(`[EMAIL_SIMULATED] To: ${to}\nSubject: ${subject}${input.sensitive ? '\nBody: [hidden sensitive OTP]' : `\n${body}`}`);
    return { status: 'simulated', provider: 'local-dev', to, subject };
  }
}
