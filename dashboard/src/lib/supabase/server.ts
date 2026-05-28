import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '../../../../shared/types/database';

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get:    (name)               => cookieStore.get(name)?.value,
        set:    (name, value, options) => {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove: (name, options) => {
          try { cookieStore.set({ name, value: '', ...options }); } catch {}
        },
      },
    }
  );
}

export function createSupabaseAdminClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get:    (name)               => cookieStore.get(name)?.value,
        set:    (name, value, options) => {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove: (name, options) => {
          try { cookieStore.set({ name, value: '', ...options }); } catch {}
        },
      },
      auth: { persistSession: false },
    }
  );
}
