'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, authClient } from '@/lib/auth-client';
import Link from 'next/link';

export default function AcceptInvitationPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationId = searchParams.get('id');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-id' | 'needs-auth'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    if (!invitationId) {
      setStatus('no-id');
      return;
    }

    if (isPending) return;

    if (!session) {
      setStatus('needs-auth');
      return;
    }

    // Accept the invitation
    async function accept() {
      try {
        const res = await authClient.organization.acceptInvitation({
          invitationId: invitationId!,
        });
        if (res.error) {
          setErrorMessage(res.error.message ?? 'Failed to accept invitation');
          setStatus('error');
          return;
        }
        if (res.data) {
          setOrgName((res.data as unknown as { name?: string })?.name ?? 'your new team');
          // Set the org as active
          const orgId = (res.data as unknown as { id?: string })?.id;
          if (orgId) {
            await authClient.organization.setActive({ organizationId: orgId });
          }
        }
        setStatus('success');
        // Redirect to dashboard after a brief delay
        setTimeout(() => router.push('/dashboard'), 2000);
      } catch {
        setErrorMessage('Something went wrong. The invitation may have expired.');
        setStatus('error');
      }
    }

    accept();
  }, [invitationId, session, isPending, router]);

  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-20">
      <div className="max-w-md mx-auto text-center">
        {status === 'loading' && (
          <>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-violet-500 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-2">Accepting invitation...</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Please wait while we add you to the team.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-2">You&apos;re in!</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">
              You&apos;ve joined <strong className="text-gray-900 dark:text-zinc-100">{orgName}</strong>. Redirecting to your dashboard...
            </p>
            <Link href="/dashboard" className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-500 transition-colors">
              Go to dashboard &rarr;
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-2">Invitation failed</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">{errorMessage}</p>
            <Link href="/settings/team" className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-500 transition-colors">
              Go to team settings &rarr;
            </Link>
          </>
        )}

        {status === 'no-id' && (
          <>
            <h1 className="text-xl font-bold mb-2">Invalid invitation link</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">
              This link is missing the invitation ID. Please check the link from your email.
            </p>
            <Link href="/" className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-500 transition-colors">
              Go home &rarr;
            </Link>
          </>
        )}

        {status === 'needs-auth' && (
          <>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-2">Sign in to accept</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
              You need to be signed in to accept this invitation. If you don&apos;t have an account yet, create one first.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/login?redirect=${encodeURIComponent(`/team/accept-invitation?id=${invitationId}`)}`}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors focus-ring"
              >
                Sign in
              </Link>
              <Link
                href={`/signup?redirect=${encodeURIComponent(`/team/accept-invitation?id=${invitationId}`)}`}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-zinc-200 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-600 transition-colors focus-ring"
              >
                Create account
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
