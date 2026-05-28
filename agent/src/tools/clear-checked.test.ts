import { describe, it, expect, vi } from 'vitest';
import { clearCheckedItems } from './clear-checked.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';

function makeMock(count: number): SupabaseClient {
  const chain = {
    eq: vi.fn().mockReturnThis(),
    // last eq resolves
  };
  const lastEq = vi.fn().mockResolvedValue({ error: null, count });
  const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
  return {
    from: vi.fn(() => ({ delete: vi.fn(() => ({ eq: firstEq })) })),
  } as unknown as SupabaseClient;
}

describe('clearCheckedItems', () => {
  it('deletes checked items and returns count', async () => {
    const mock = makeMock(3);
    const result = await clearCheckedItems({}, mock, FAMILY_ID);
    expect(result.success).toBe(true);
    if (result.success) expect(result.cleared).toBe(3);
  });

  it('returns 0 when nothing to clear', async () => {
    const mock = makeMock(0);
    const result = await clearCheckedItems({}, mock, FAMILY_ID);
    expect(result.success).toBe(true);
    if (result.success) expect(result.cleared).toBe(0);
  });
});
