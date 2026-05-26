import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? 'Claudit <noreply@claudit.consulting>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://claudit.consulting';

export interface ScoreDropEmailOptions {
  to: string;
  scheduleName: string;
  repoUrl: string;
  previousScore: number | null;
  currentScore: number;
  threshold: number;
  critical: string[];
  high: string[];
  summary: string;
}

export async function sendScoreDropEmail(opts: ScoreDropEmailOptions): Promise<void> {
  if (!resend) {
    console.warn(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', event: 'score_drop_email_skipped', reason: 'no_resend_key' }));
    return;
  }

  const drop = opts.previousScore !== null ? opts.previousScore - opts.currentScore : null;
  const dropLine = drop !== null
    ? `Score dropped ${drop} point${drop !== 1 ? 's' : ''} (${opts.previousScore} → ${opts.currentScore}).`
    : `Score is ${opts.currentScore}/100.`;

  const criticalHtml = opts.critical.length
    ? `<ul style="margin:8px 0;padding-left:20px;color:#b91c1c">${opts.critical.map((i) => `<li>${i}</li>`).join('')}</ul>`
    : '';
  const highHtml = opts.high.length
    ? `<ul style="margin:8px 0;padding-left:20px;color:#c2410c">${opts.high.slice(0, 5).map((i) => `<li>${i}</li>`).join('')}</ul>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <h2 style="color:#b91c1c;margin-bottom:4px">⚠ Audit Score Alert: ${opts.scheduleName}</h2>
  <p style="color:#555;margin-top:4px">${opts.repoUrl}</p>
  <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin:16px 0">
    <p style="margin:0;font-size:18px;font-weight:600">${dropLine}</p>
    <p style="margin:6px 0 0;color:#555">Current score: <strong>${opts.currentScore}/100</strong> — Threshold: ${opts.threshold}/100</p>
  </div>
  ${opts.summary ? `<p style="color:#444">${opts.summary}</p>` : ''}
  ${criticalHtml ? `<h3 style="color:#b91c1c;margin-bottom:2px">Critical issues</h3>${criticalHtml}` : ''}
  ${highHtml ? `<h3 style="color:#c2410c;margin-bottom:2px">High severity issues</h3>${highHtml}` : ''}
  <p style="margin-top:24px">
    <a href="${APP_URL}/dashboard" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">View Dashboard</a>
  </p>
  <p style="color:#999;font-size:12px;margin-top:32px">
    You're receiving this because you set up a scheduled audit on <a href="${APP_URL}" style="color:#999">claudit.consulting</a>.
    Manage your alerts in <a href="${APP_URL}/settings" style="color:#999">Settings</a>.
  </p>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `[Claudit] Score alert: ${opts.scheduleName} — ${opts.currentScore}/100`,
    html,
  });
}
