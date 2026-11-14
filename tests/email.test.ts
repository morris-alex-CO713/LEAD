import { test } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { EmailConfigurationError, isEmailConfigured, sendEmail } from '../api/_lib/email.ts';

test('SMTP configuration, alias routing, TLS and provider failures', async () => {
  const keys = ['SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASS','EMAIL_REPLY_TO'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const original = nodemailer.createTransport;
  let options: any;
  let message: any;
  let rejected = false;
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(isEmailConfigured(), false);
    await assert.rejects(sendEmail({ from: 'sales@example.com', to: ['recipient@example.net'], subject: 'Review', text: 'Approved draft' }), EmailConfigurationError);
    Object.assign(process.env, { SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '465', SMTP_USER: 'admin@example.com', SMTP_PASS: 'test-only-placeholder' });
    (nodemailer as any).createTransport = (config: any) => {
      options = config;
      return { sendMail: async (mail: any) => { message = mail; return { accepted: rejected ? [] : mail.to, rejected: rejected ? mail.to : [], messageId: 'smtp-test-id' }; } };
    };
    const mail = { from: 'sales@example.com', to: ['recipient@example.net'], subject: 'Review', text: 'Approved draft' };
    assert.deepEqual(await sendEmail(mail), { id: 'smtp-test-id' });
    assert.equal(options.auth.user, 'admin@example.com');
    assert.equal(options.secure, true);
    assert.equal(message.from, 'sales@example.com');
    assert.equal(message.replyTo, 'sales@example.com');
    assert.equal(options.disableFileAccess, true);
    process.env.SMTP_PORT = '587';
    process.env.EMAIL_REPLY_TO = 'replies@example.com';
    await sendEmail(mail);
    assert.equal(options.secure, false);
    assert.equal(options.requireTLS, true);
    assert.equal(message.replyTo, 'replies@example.com');
    rejected = true;
    await assert.rejects(sendEmail(mail), /did not accept/);
    process.env.SMTP_PORT = 'invalid';
    await assert.rejects(sendEmail(mail), EmailConfigurationError);
  } finally {
    nodemailer.createTransport = original;
    for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  }
});
