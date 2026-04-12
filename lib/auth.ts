import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, twoFactor, organization, apiKey } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { db } from '@/lib/db';
import * as schema from '@/lib/auth-schema';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM ?? 'Claudit <noreply@claudit.consulting>';

/** Escape HTML special characters to prevent injection in email templates. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn(`[email] To: ${to} | Subject: ${subject}`);
      // eslint-disable-next-line no-console
      console.warn(`[email] (No RESEND_API_KEY — email not sent)`);
    }
    return;
  }
  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] send failed:', err instanceof Error ? err.message : err);
  }
}

// TOKEN-002: Fail fast if auth secret is missing or too short.
const authSecret = process.env.BETTER_AUTH_SECRET;
if (!authSecret || authSecret.length < 32) {
  throw new Error(
    'BETTER_AUTH_SECRET must be at least 32 characters. ' +
    'Generate one with: openssl rand -base64 32',
  );
}

export const auth = betterAuth({
  appName: 'Claudit',

  // Trusted origins for CSRF validation on OAuth callbacks and API requests.
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
    ...(process.env.NEXT_PUBLIC_APP_URL &&
    process.env.NEXT_PUBLIC_APP_URL !== process.env.BETTER_AUTH_URL
      ? [process.env.NEXT_PUBLIC_APP_URL]
      : []),
    ...(process.env.RAILWAY_PUBLIC_DOMAIN
      ? [`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`]
      : []),
  ],

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { ...schema },
  }),

  // SESS-001: Explicit session expiry — don't rely on library defaults.
  session: {
    expiresIn: 60 * 60 * 24 * 7,   // 7-day absolute expiry
    updateAge: 60 * 60 * 24,        // Renew if used within 24h (sliding window)
    cookieCache: {
      enabled: true,
      maxAge: 60,                    // CLOUD-016: Re-validate from DB every 60 seconds (reduced from 5 min for faster session revocation)
    },
  },

  emailAndPassword: {
    enabled: true,
    // AUTH-005: Server-side password length enforcement.
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // CLOUD-013: Enable email verification when Resend is configured in production.
    // In dev, allow unverified for convenience.
    requireEmailVerification: process.env.NODE_ENV === 'production'
      ? !!process.env.RESEND_API_KEY
      : false,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(
        user.email,
        'Reset your Claudit password',
        `<p>Hi ${escapeHtml(user.name ?? '')},</p>
         <p>Click the link below to reset your password:</p>
         <p><a href="${url}">Reset password</a></p>
         <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
      );
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(
        user.email,
        'Verify your email to start auditing',
        `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;">
 <p style="color:#374151;">Hi ${escapeHtml(user.name ?? 'there')},</p>
 <p style="color:#374151;">You're one step away from running your first security, performance, and accessibility audit.</p>
 <p style="margin:24px 0;text-align:center;"><a href="${url}" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Verify email and start auditing &rarr;</a></p>
 <p style="color:#6b7280;font-size:14px;">After verifying, enter any public URL to get severity-rated findings with fix suggestions — results stream in real time.</p>
</div>`,
      );
    },
  },

  socialProviders: {
    ...(process.env.GITHUB_CLIENT_ID && {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    }),
  },

  plugins: [
    nextCookies(),
    admin(),
    twoFactor({
      issuer: 'Claudit',
      otpOptions: {
        async sendOTP({ user, otp }) {
          await sendEmail(
            user.email,
            'Your Claudit verification code',
            `<p>Hi ${escapeHtml(user.name ?? '')},</p>
             <p>Your two-factor code is: <strong>${otp}</strong></p>
             <p>This code expires in 5 minutes.</p>`,
          );
        },
      },
    }),
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 5,
      membershipLimit: 20,
      creatorRole: 'owner',
      invitationExpiresIn: 60 * 60 * 48, // 48 hours
      async sendInvitationEmail(data) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
        const acceptUrl = `${appUrl}/team/accept-invitation?id=${data.id}`;
        await sendEmail(
          data.email,
          `You're invited to join ${escapeHtml(data.organization.name)} on Claudit`,
          `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;">
            <p>Hi,</p>
            <p><strong>${escapeHtml(data.inviter.user.name)}</strong> has invited you to join
            <strong>${escapeHtml(data.organization.name)}</strong> as a <strong>${escapeHtml(data.role)}</strong>.</p>
            <p style="margin:24px 0;text-align:center;">
              <a href="${acceptUrl}" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
                Accept invitation
              </a>
            </p>
            <p style="color:#6b7280;font-size:14px;">This invitation expires in 48 hours.</p>
          </div>`,
        );
      },
    }),
    apiKey({
      defaultPrefix: 'cldt_live_',
      defaultExpiresIn: null, // org keys don't expire
      enableMetadata: true,
      rateLimit: { enabled: true, window: 60, max: 100 },
    }),
  ],
});
