import nodemailer from 'nodemailer';

export class EmailConfigurationError extends Error {}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendEmail(message: { from: string; to: string[]; subject: string; text: string; html?: string }) {
  if (!isEmailConfigured()) throw new EmailConfigurationError('Mailbox SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.');
  const port = Number(process.env.SMTP_PORT || 465);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new EmailConfigurationError('SMTP_PORT must be a valid port number.');
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  const result = await transport.sendMail({ ...message, replyTo: process.env.EMAIL_REPLY_TO || message.from });
  if (!result.accepted?.length || result.rejected?.length) throw new Error('The mailbox provider did not accept all email recipients.');
  return { id: result.messageId };
}
