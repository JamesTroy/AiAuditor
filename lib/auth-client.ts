import { createAuthClient } from 'better-auth/react';
import { adminClient, twoFactorClient, organizationClient, apiKeyClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  plugins: [
    adminClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = '/two-factor';
      },
    }),
    organizationClient(),
    apiKeyClient(),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
