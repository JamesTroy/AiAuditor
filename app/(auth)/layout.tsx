export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">AI Audit</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
            AI-powered code audits
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
