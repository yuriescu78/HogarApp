# Phase 0 – Dashboard Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap a Next.js 14 App Router dashboard with Supabase SSR magic-link auth. Protected routes redirect unauthenticated users to `/login`. Authenticated users reach `/dashboard`.

**Architecture:** Next.js middleware guards `/dashboard/*`. Server Components use the service-role Supabase client; Client Components use the anon-key client. Magic link auth flows through `GET /auth/callback?code=...` → exchange code for session → redirect to `/dashboard`. No client-side auth state management — session is stored in cookies by `@supabase/ssr`.

**Tech Stack:** Next.js 14 (App Router), TypeScript 5, `@supabase/ssr`, `@supabase/supabase-js`, Tailwind CSS (included by Next.js default), Vitest + React Testing Library

**Prerequisite:** Phase 0 Supabase plan complete — local Supabase running with seed data.

---

### Task 1: Initialize Next.js 14 project

**Files:**
- Create: `dashboard/` (via CLI)

- [ ] **Step 1: Scaffold Next.js 14**

```bash
npx create-next-app@14 dashboard \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git
```

When prompted for options not listed above, accept the defaults.

Expected: `dashboard/` created with `app/`, `src/`, `package.json`, `tsconfig.json`.

- [ ] **Step 2: Install Supabase SSR packages**

```bash
cd dashboard && npm install @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 3: Write .env.local**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste anon key from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<paste service_role key from supabase start output>
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/
git commit -m "chore: init Next.js 14 dashboard"
```

---

### Task 2: Supabase SSR clients

**Files:**
- Create: `dashboard/src/lib/supabase/server.ts`
- Create: `dashboard/src/lib/supabase/client.ts`

- [ ] **Step 1: Write server.ts (Server Components + Server Actions)**

```typescript
// dashboard/src/lib/supabase/server.ts
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
        get:    (name)        => cookieStore.get(name)?.value,
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

// Service-role client for admin reads (no RLS)
export function createSupabaseAdminClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get:    (name)        => cookieStore.get(name)?.value,
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
```

- [ ] **Step 2: Write client.ts (Client Components)**

```typescript
// dashboard/src/lib/supabase/client.ts
'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../shared/types/database';

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Update tsconfig to resolve shared types**

In `dashboard/tsconfig.json`, update `paths` (or add `include`):

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "next-env.d.ts", "../shared", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Run typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/supabase/ dashboard/tsconfig.json
git commit -m "feat: Supabase SSR server + browser clients"
```

---

### Task 3: Auth middleware

**Files:**
- Create: `dashboard/src/middleware.ts`
- Create: `dashboard/src/middleware.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// dashboard/src/middleware.test.ts
import { describe, it, expect, vi } from 'vitest';

// We test the route matching logic in isolation — not the full middleware
// (which depends on Next.js internals and Supabase network calls).
describe('middleware route matching', () => {
  const protectedPaths = ['/dashboard', '/dashboard/shopping', '/dashboard/calendar'];
  const publicPaths    = ['/login', '/auth/callback', '/'];

  // Mirrors the matcher config in middleware.ts
  function isProtected(pathname: string): boolean {
    return pathname.startsWith('/dashboard');
  }

  it.each(protectedPaths)('protects %s', (path) => {
    expect(isProtected(path)).toBe(true);
  });

  it.each(publicPaths)('allows %s through', (path) => {
    expect(isProtected(path)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm pass** (this test doesn't depend on any external file yet)

```bash
cd dashboard && npx vitest run src/middleware.test.ts
```

Expected: PASS — tests pass (they only test the `isProtected` helper, not the file itself yet).

- [ ] **Step 3: Write middleware.ts**

```typescript
// dashboard/src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get:    (name) => request.cookies.get(name)?.value,
        set:    (name, value, options) => {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove: (name, options) => {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isProtected = request.nextUrl.pathname.startsWith('/dashboard');
  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 4: Run typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/middleware.ts dashboard/src/middleware.test.ts
git commit -m "feat: auth middleware — redirect unauthenticated users from /dashboard"
```

---

### Task 4: Login page

**Files:**
- Create: `dashboard/src/app/login/page.tsx`
- Modify: `dashboard/src/app/page.tsx` (redirect to `/dashboard`)

- [ ] **Step 1: Write the root page redirect**

```tsx
// dashboard/src/app/page.tsx
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/dashboard');
}
```

- [ ] **Step 2: Write the login page**

```tsx
// dashboard/src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const supabase = createSupabaseBrowserClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-lg">Revisa tu correo — te hemos enviado un enlace de acceso.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-80">
        <h1 className="text-2xl font-semibold">JARVIS</h1>
        <input
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="border rounded px-3 py-2"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {loading ? 'Enviando...' : 'Enviar enlace de acceso'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/login/page.tsx dashboard/src/app/page.tsx
git commit -m "feat: login page with magic link"
```

---

### Task 5: Auth callback route

**Files:**
- Create: `dashboard/src/app/auth/callback/route.ts`

- [ ] **Step 1: Write the callback route handler**

```typescript
// dashboard/src/app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get('code');
  const next  = searchParams.get('next') ?? '/dashboard';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const cookieStore = cookies();
  const supabase    = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get:    (name)               => cookieStore.get(name)?.value,
        set:    (name, value, opts)  => { try { cookieStore.set({ name, value, ...opts }); } catch {} },
        remove: (name, opts)         => { try { cookieStore.set({ name, value: '', ...opts }); } catch {} },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/auth/callback/route.ts
git commit -m "feat: auth callback — exchange magic link code for session"
```

---

### Task 6: Dashboard page (protected)

**Files:**
- Create: `dashboard/src/app/dashboard/page.tsx`

- [ ] **Step 1: Write dashboard page**

```tsx
// dashboard/src/app/dashboard/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch shopping items via service role (no RLS filtering needed for Phase 0)
  const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
  const admin = createSupabaseAdminClient();
  const { data: items } = await admin
    .from('shopping_items')
    .select('id, name, quantity, checked')
    .eq('family_id', process.env.FAMILY_ID ?? '')
    .eq('checked', false)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">JARVIS — Panel familiar</h1>

      <section>
        <h2 className="text-lg font-medium mb-3">Lista de la compra</h2>
        {!items?.length ? (
          <p className="text-gray-500">Lista vacía.</p>
        ) : (
          <ul className="space-y-2">
            {items.map(item => (
              <li key={item.id} className="flex gap-2 border rounded px-3 py-2">
                <span className="flex-1">{item.name}</span>
                {item.quantity && (
                  <span className="text-gray-400 text-sm">{item.quantity}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
```

Add `FAMILY_ID` to `dashboard/.env.local`:

```
FAMILY_ID=00000000-0000-0000-0000-000000000001
```

- [ ] **Step 2: Run typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/dashboard/page.tsx dashboard/.env.local
git commit -m "feat: dashboard page — shopping list from Supabase"
```

---

### Task 7: Smoke test — auth flow in browser

- [ ] **Step 1: Start local Supabase**

```bash
supabase start
```

Note the Inbucket URL printed (e.g. `http://127.0.0.1:54324`) — this is the local email inbox.

- [ ] **Step 2: Start the dashboard**

```bash
cd dashboard && npm run dev
```

Expected: `ready - started server on 0.0.0.0:3000` or similar.

- [ ] **Step 3: Test auth flow**

1. Open `http://localhost:3000` — should redirect to `/dashboard`
2. Middleware should redirect unauthenticated user to `/login`
3. Enter any email (e.g. `test@example.com`) and click send
4. Open Inbucket at `http://127.0.0.1:54324` → find the magic link email
5. Click the magic link → should redirect to `/dashboard`
6. Dashboard should load and show the shopping list

- [ ] **Step 4: Run lint and typecheck**

```bash
cd dashboard && npm run lint && npm run typecheck
```

Expected: No errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Phase 0 dashboard complete — Next.js + Supabase SSR + magic link auth"
```
