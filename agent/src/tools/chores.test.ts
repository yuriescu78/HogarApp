import { describe, it, expect, vi } from 'vitest';
import { addChore, queryChores, logChore } from './chores.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';

function makeInsertMock(error: string | null = null): SupabaseClient {
  return {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: error ? { message: error } : null }),
    })),
  } as unknown as SupabaseClient;
}

function makeSelectMock(rows: unknown[]): SupabaseClient {
  const chain = {
    eq:    vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
    select: vi.fn().mockReturnThis(),
  };
  return { from: vi.fn(() => chain) } as unknown as SupabaseClient;
}

function makeLogMock(): SupabaseClient {
  const selectChain = {
    eq:     vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'chore-1', name: 'Fregar' }, error: null }),
  };
  const insertChain = { mockResolvedValue: undefined as unknown };
  const from = vi.fn((table: string) => {
    if (table === 'chores')     return { select: vi.fn(() => selectChain) };
    if (table === 'chore_logs') return { insert: vi.fn().mockResolvedValue({ error: null }) };
    return {};
  });
  return { from } as unknown as SupabaseClient;
}

describe('addChore', () => {
  it('inserts chore and returns success', async () => {
    const result = await addChore({ name: 'Fregar los platos' }, makeInsertMock(), FAMILY_ID);
    expect(result.success).toBe(true);
  });
  it('returns error on DB failure', async () => {
    const result = await addChore({ name: 'Test' }, makeInsertMock('DB error'), FAMILY_ID);
    expect(result.success).toBe(false);
  });
});

describe('queryChores', () => {
  it('returns list of chores', async () => {
    const mock = makeSelectMock([{ id: '1', name: 'Fregar', frequency: 'diario', assigned_to: null }]);
    const result = await queryChores({}, mock, FAMILY_ID);
    expect(result.success).toBe(true);
    if (result.success) expect(result.chores).toHaveLength(1);
  });
});

describe('logChore', () => {
  it('logs completion and returns success', async () => {
    const result = await logChore({ chore_id: 'chore-1' }, makeLogMock(), FAMILY_ID);
    expect(result.success).toBe(true);
  });
});
