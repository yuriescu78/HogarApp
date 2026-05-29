import { describe, it, expect, vi } from 'vitest';
import { saveInvestmentNote, queryInvestmentNotes } from './investments.js';
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
  };
  return { from: vi.fn(() => ({ select: vi.fn(() => chain) })) } as unknown as SupabaseClient;
}

describe('saveInvestmentNote', () => {
  it('saves note and returns success', async () => {
    const result = await saveInvestmentNote(
      { title: 'Fondos indexados', content: 'Cartera Bogle: 70% MSCI World, 30% emergentes.' },
      makeInsertMock(), FAMILY_ID
    );
    expect(result.success).toBe(true);
  });
  it('returns error on DB failure', async () => {
    const result = await saveInvestmentNote(
      { title: 'Test', content: 'x' },
      makeInsertMock('DB error'), FAMILY_ID
    );
    expect(result.success).toBe(false);
  });
});

describe('queryInvestmentNotes', () => {
  it('returns notes list', async () => {
    const mock = makeSelectMock([{ id: '1', title: 'Fondos', content_masked: 'Cartera Bogle…', created_at: '2026-05-01' }]);
    const result = await queryInvestmentNotes({}, mock, FAMILY_ID);
    expect(result.success).toBe(true);
    if (result.success) expect(result.notes).toHaveLength(1);
  });
});
