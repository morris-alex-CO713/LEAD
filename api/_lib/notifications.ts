export interface DailyReportMessage {
  date: string;
  scanned: number;
  newLeads: number;
  highPriority: number;
  failedSearches: number;
  topLead?: { name: string; leadScore: number; category?: string };
  dashboardUrl?: string;
}

export interface DeliveryResult {
  channel: 'email' | 'whatsapp' | 'telegram';
  sent: boolean;
  skipped?: boolean;
  detail?: string;
}

export function formatDailyReport(report: DailyReportMessage): string {
  const lines = [
    `Daily Prospect Report - ${report.date}`,
    `Businesses scanned: ${report.scanned}`,
    `New leads: ${report.newLeads}`,
    `High-priority leads: ${report.highPriority}`,
  ];
  if (report.topLead) lines.push(`Best opportunity: ${report.topLead.name} (${report.topLead.leadScore}/100)`);
  if (report.failedSearches > 0) lines.push(`Searches needing attention: ${report.failedSearches}`);
  if (report.dashboardUrl) lines.push(`Dashboard: ${report.dashboardUrl}`);
  return lines.join('\n');
}

export async function sendReportEmail(report: DailyReportMessage): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_EMAIL_FROM;
  const to = process.env.REPORT_EMAIL_TO;
  if (!apiKey || !from || !to) {
    return { channel: 'email', sent: false, skipped: true, detail: 'Email environment variables are incomplete.' };
  }
  const text = formatDailyReport(report);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: to.split(',').map(value => value.trim()).filter(Boolean),
      subject: `Daily Prospect Report - ${report.date}`,
      text,
      html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
    }),
  });
  if (!response.ok) throw new Error(`Email delivery failed (${response.status}): ${await response.text()}`);
  return { channel: 'email', sent: true };
}

export async function sendReportWhatsApp(report: DailyReportMessage): Promise<DeliveryResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = process.env.WHATSAPP_REPORT_TO;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'daily_lead_report';
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US';
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || 'v23.0';
  if (!token || !phoneNumberId || !to) {
    return { channel: 'whatsapp', sent: false, skipped: true, detail: 'WhatsApp environment variables are incomplete.' };
  }
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [{ type: 'body', parameters: [{ type: 'text', text: formatDailyReport(report) }] }],
      },
    }),
  });
  if (!response.ok) throw new Error(`WhatsApp delivery failed (${response.status}): ${await response.text()}`);
  return { channel: 'whatsapp', sent: true };
}

export async function sendReportTelegram(report: DailyReportMessage): Promise<DeliveryResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { channel: 'telegram', sent: false, skipped: true, detail: 'Telegram environment variables are incomplete.' };
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatDailyReport(report),
      reply_markup: report.dashboardUrl ? { inline_keyboard: [[{ text: 'Open review queue', url: report.dashboardUrl }]] } : undefined,
    }),
  });
  if (!response.ok) throw new Error(`Telegram delivery failed (${response.status}): ${await response.text()}`);
  return { channel: 'telegram', sent: true };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char] as string));
}
