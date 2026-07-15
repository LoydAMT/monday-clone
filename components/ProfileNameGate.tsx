'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfileName } from '@/lib/mutations';

export function ProfileNameGate({ email }: { email: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await updateProfileName(trimmed);
      setDone(true);
      // The sidebar/board data (members, comment authors, etc.) was fetched
      // server-side before this name existed — refresh so it shows up
      // everywhere immediately instead of only after a manual reload.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-base font-semibold text-gray-900">What&apos;s your name?</h2>
        <p className="mb-4 text-xs text-gray-500">
          Signed in as {email}. Add your name so teammates know who&apos;s who on comments and activity.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0073ea] focus:ring-1 focus:ring-[#0073ea]"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-[#0073ea] py-2 text-sm font-medium text-white hover:bg-[#0060c2] disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
