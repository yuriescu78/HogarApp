import { describe, it, expect, vi } from 'vitest';
import { checkShoppingItem } from './check-shopping.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';

function makeMock(found: boolean): SupabaseClient {
  const selectChain = {
    eq:    vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: found ? [{ id: 'abc-123' }] : [],
      error: null,
    }),
  };
  const updateChain = {
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => selectChain),
      update: vi.fn(() => updateChain),
    })),
  } as unknown as SupabaseClient;
}

describe('checkShoppingItem', () => {
  it('marks item as checked when found', async () => {
    const mock = makeMock(true);
    const result = await checkShoppingItem({ item_name: 'leche', checked: true }, mock, FAMILY_ID);
    expect(result.success).toBe(true);
  });

  it('returns error when item not found', async () => {
    const mock = makeMock(false);
    const result = await checkShoppingItem({ item_name: 'xyz', checked: true }, mock, FAMILY_ID);
    expect(result.success).toBe(false);
  });
});
