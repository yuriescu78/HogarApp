import { describe, it, expect } from 'vitest';

describe('middleware route matching', () => {
  const protectedPaths = ['/dashboard', '/dashboard/shopping', '/dashboard/calendar'];
  const publicPaths    = ['/login', '/auth/callback', '/'];

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
