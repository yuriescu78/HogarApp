import { describe, it, expect, vi } from 'vitest';
import { addShoppingItems } from './shopping.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';
const LIST_ID   = '00000000-0000-0000-0000-000000000002';

function makeMockSupabase(overrides: Record<string, unknown> = {}): SupabaseClient {
  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: LIST_ID }, error: null }),
  };
  const insertChain = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: LIST_ID }, error: null }),
  };

  const from = vi.fn((table: string) => {
    if (table === 'shopping_lists') {
      return {
        select: vi.fn().mockReturnValue(selectChain),
        insert: vi.fn().mockReturnValue(insertChain),
      };
    }
    if (table === 'shopping_items') {
      return {
        insert: vi.fn().mockResolvedValue({ error: null, ...overrides }),
      };
    }
    return {};
  });

  return { from } as unknown as SupabaseClient;
}

describe('addShoppingItems', () => {
  it('inserts items and returns success with count', async () => {
    const supabase = makeMockSupabase();
    const result = await addShoppingItems(
      { items: [{ name: 'Leche' }, { name: 'Pan', quantity: '2' }], list_name: 'Lista principal' },
      supabase,
      FAMILY_ID
    );
    expect(result).toEqual({ success: true, added: 2 });
  });

  it('returns error when Supabase insert fails', async () => {
    const supabase = makeMockSupabase({ error: { message: 'DB error' } });
    const result = await addShoppingItems(
      { items: [{ name: 'Leche' }], list_name: 'Lista principal' },
      supabase,
      FAMILY_ID
    );
    expect(result).toEqual({ success: false, error: 'DB error' });
  });
});
