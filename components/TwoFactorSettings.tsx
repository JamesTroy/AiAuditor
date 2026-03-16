'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { authClient } from '@/lib/auth-client';

const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false });

type Step = 'idle' | 'loading' | 'setup' | 'verify' | 'enabled' | 'error';

export default function TwoFactorSettings({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const [step, setStep] = useState<Step>(twoFactorEnabled ? 'enabled' : 'idle');
  const [totpURI, setTotpURI] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [disablePassword, setDisablePassword] = useState('');

  async function handleEnable() {
    setError('');
    setStep('loading');
    try {
      const { data, error: err } = await authClient.twoFactor.enable({
        password: '', // Better Auth requires password for enable in some configs
      });
      if (err) {
        setError(err.message ?? 'Failed to start 2FA setup');
        setStep('idle');
        return;
      }
      if (data?.totpURI) {
        setTotpURI(data.totpURI);
        setBackupCodes(data.backupCodes ?? []);
        setStep('setup');
      }
    } catch {
      setError('Failed to start 2FA setup');
      setStep('idle');
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { error: err } = await authClient.twoFactor.verifyTotp({
        code: otp,
      });
      if (err) {
        setError(err.message ?? 'Invalid code. Please try again.');
        return;
      }
      setStep('enabled');
      setOtp('');
      setTotpURI('');
      setBackupCodes([]);
    } catch {
      setError('Verification failed. Please try again.');
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { error: err } = await authClient.twoFactor.disable({
        password: disablePassword,
      });
      if (err) {
        setError(err.message ?? 'Failed to disable 2FA');
        return;
      }
      setStep('idle');
      setDisablePassword('');
    } catch {
      setError('Failed to disable 2FA');
    }
  }

  return (
    <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold mb-1">Two-factor authentication</h2>
      <p className="text-sm text-gray-500 dark:text-zinc-500 mb-4">
        Add an extra layer of security to your account with a TOTP authenticator app.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {step === 'idle' && (
        <div>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mb-3">
            Add an extra layer of security with an authenticator app like Google Authenticator or 1Password.
          </p>
          <button
            onClick={handleEnable}
            className="bg-violet-600 hover:bg-violet-500 disabled-muted text-white font-medium rounded-xl px-4 py-2 text-sm transition-colors"
          >
            Enable 2FA
          </button>
        </div>
      )}

      {step === 'loading' && (
        <p className="text-sm text-gray-500 dark:text-zinc-400 animate-pulse">Setting up...</p>
      )}

      {step === 'setup' && (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-700 dark:text-zinc-300 mb-2">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.):
            </p>
            <div className="bg-white p-4 rounded-lg inline-block">
              <QRCodeSVG value={totpURI} size={200} level="M" />
            </div>
            <details className="mt-2">
              <summary className="text-xs text-gray-500 dark:text-zinc-500 cursor-pointer">
                Can&apos;t scan? Copy the setup key
              </summary>
              <code className="block mt-1 text-xs bg-gray-100 dark:bg-zinc-800 p-2 rounded break-all">
                {totpURI}
              </code>
            </details>
          </div>

          {backupCodes.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                Save your backup codes
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                Store these in a safe place. You can use them to access your account if you lose your authenticator.
                These codes will not be shown again.
              </p>
              <div className="grid grid-cols-2 gap-1 mb-3">
                {backupCodes.map((code) => (
                  <code key={code} className="text-xs font-mono bg-white dark:bg-zinc-800 px-2 py-1 rounded">
                    {code}
                  </code>
                ))}
              </div>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(backupCodes.join('\n')).catch(() => {}); }}
                className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 underline"
              >
                Copy all codes
              </button>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                Enter the 6-digit code from your app
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full max-w-[200px] bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
                placeholder="000000"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={otp.length !== 6}
                className="bg-violet-600 hover:bg-violet-500 disabled-muted text-white font-medium rounded-xl px-4 py-2 text-sm transition-colors"
              >
                Verify and enable
              </button>
              <button
                type="button"
                onClick={() => { setStep('idle'); setTotpURI(''); setOtp(''); setError(''); }}
                className="text-sm text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 'enabled' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
              Two-factor authentication is enabled
            </span>
          </div>
          <form onSubmit={handleDisable} className="space-y-3">
            <div>
              <label htmlFor="disable2faPassword" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                Enter your password to disable 2FA
              </label>
              <input
                id="disable2faPassword"
                type="password"
                required
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
                placeholder="Your password"
              />
            </div>
            <button
              type="submit"
              disabled={!disablePassword}
              className="bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 disabled-muted-light text-gray-700 dark:text-zinc-300 font-medium rounded-xl px-4 py-2 text-sm transition-colors"
            >
              Disable 2FA
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
