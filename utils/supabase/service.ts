import { createClient } from '@supabase/supabase-js';

// Service-role client: bypasses Row Level Security entirely. Server-only —
// never import this from a Client Component or anything shipped to the
// browser. Used by the two code paths in this app that need to read/write
// data on behalf of someone who isn't an authenticated workspace member:
// guest share links (app/share/[token]/page.tsx) and looking up a
// notification recipient's email server-side (app/api/notify-email).
export function createServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
