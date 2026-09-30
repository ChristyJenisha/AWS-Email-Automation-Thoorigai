import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export type SendReminderEmailInput = {
  to: string;
  subject: string;
  body: string;
};

@Injectable()
export class EmailService {
  private readonly client: SESClient | null;
  private readonly defaultFrom: string | undefined;

  constructor() {
    this.defaultFrom = process.env.AWS_SES_FROM?.trim();
    const region = process.env.AWS_REGION || 'ap-south-1';
    this.client = this.defaultFrom ? new SESClient({ region }) : null;
  }

  async sendReminderEmail(input: SendReminderEmailInput): Promise<{ status: 'sent' | 'simulated'; provider: 'ses' | 'local-dev'; messageId?: string; to: string; subject: string }> {
    const to = input.to.trim();
    const subject = input.subject.trim() || 'Workflow reminder';
    const body = input.body.trim() || 'This is a workflow reminder.';

    if (!this.client || !this.defaultFrom) {
      console.log(`[EMAIL_SIMULATED] To: ${to}\nSubject: ${subject}\n${body}`);
      return { status: 'simulated', provider: 'local-dev', to, subject };
    }

    try {
      const result = await this.client.send(
        new SendEmailCommand({
          Source: this.defaultFrom,
          Destination: { ToAddresses: [to] },
          Message: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Text: { Data: body, Charset: 'UTF-8' } },
          },
        }),
      );

      return { status: 'sent', provider: 'ses', messageId: result.MessageId, to, subject };
    } catch (error) {
      console.error('SES email sending failed', error);
      throw new ServiceUnavailableException('Email delivery is unavailable right now');
    }
  }
}
