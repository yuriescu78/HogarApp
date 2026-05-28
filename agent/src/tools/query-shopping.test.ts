import { describe, it, expect, vi } from 'vitest';
import { queryShoppingItems } from './query-shopping.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';

function makeMock(rows: unknown[]): SupabaseClient {
  const chain = {
    eq:    vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  return { from: vi.fn(() => ({ select: vi.fn(() => chain) })) } as unknown as SupabaseClient;
}

describe('queryShoppingItems', () => {
  it('returns pending items', async () => {
    const mock = makeMock([{ id: '1', name: 'leche', quantity: null, checked: false }]);
    const result = await queryShoppingItems({ include_checked: false }, mock, FAMILY_ID);
    expect(result.success).toBe(true);
    if (result.success) expect(result.items).toHaveLength(1);
  });

  it('returns empty list when nothing pending', async () => {
    const mock = makeMock([]);
    const result = await queryShoppingItems({ include_checked: false }, mock, FAMILY_ID);
    expect(result.success).toBe(true);
    if (result.success) expect(result.items).toHaveLength(0);
  });
});
