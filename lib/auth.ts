import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, twoFactor } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { db } from '@/lib/db';
import * as schema from '@/lib/auth-schema';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM ?? 'Claudit <noreply@claudit.consulting>';

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
      maxAge: 5 * 60,               // Re-validate from DB every 5 minutes
    },
  },

  emailAndPassword: {
    enabled: true,
    // AUTH-005: Server-side password length enforcement.
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: false, // AUTH-004: Enable when Resend is confirmed in prod
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(
        user.email,
        'Reset your Claudit password',
        `<p>Hi ${user.name},</p>
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
        'Verify your Claudit email',
        `<p>Hi ${user.name},</p>
         <p>Click below to verify your email address:</p>
         <p><a href="${url}">Verify email</a></p>`,
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
            `<p>Hi ${user.name},</p>
             <p>Your two-factor code is: <strong>${otp}</strong></p>
             <p>This code expires in 5 minutes.</p>`,
          );
        },
      },
    }),
  ],
});
