'use client';

import { useActionState, useState } from 'react';
import { signIn, signUp, type AuthState } from './actions';
import { LayoutGrid } from 'lucide-react';

const initialState: AuthState = { error: null };

export default function LoginPage() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const action = mode === 'sign-in' ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0073ea] text-white">
            <LayoutGrid size={20} />
          </div>
          <span className="text-lg font-semibold text-gray-900">work-boards</span>
        </div>

        <h1 className="mb-1 text-xl font-semibold text-gray-900">
          {mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          {mode === 'sign-in' ? 'Sign in to continue to your workspaces.' : 'Get started in a few seconds.'}
        </p>

        <form action={formAction} className="space-y-3">
          {mode === 'sign-up' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
              <input
                name="fullName"
                type="text"
                required
                placeholder="Jane Doe"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0073ea] focus:ring-1 focus:ring-[#0073ea]"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
            <input
              name="email"
              type="email"
              required
              placeholder="you@company.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0073ea] focus:ring-1 focus:ring-[#0073ea]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0073ea] focus:ring-1 focus:ring-[#0073ea]"
            />
          </div>

          {state.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{state.error}</p>
          )}
          {!state.error && state.message && (
            <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">{state.message}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-[#0073ea] py-2 text-sm font-medium text-white transition hover:bg-[#0060c2] disabled:opacity-60"
          >
            {pending ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
          className="mt-4 w-full text-center text-xs text-gray-500 hover:text-gray-700"
        >
          {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
