import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  // Create the success response first so we can set cookies directly on it.
  // Setting cookies via cookies() from next/headers does NOT propagate to a
  // NextResponse.redirect — the browser never sees the session cookies and the
  // middleware finds no session, sending the user back to /login in a loop.
  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get:    (name)              => request.cookies.get(name)?.value,
        set:    (name, value, opts) => {
          request.cookies.set({ name, value, ...opts });
          response.cookies.set({ name, value, ...opts });
        },
        remove: (name, opts)        => {
          request.cookies.set({ name, value: '', ...opts });
          response.cookies.delete({ name, ...opts });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return response;
}
