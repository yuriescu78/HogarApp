import { describe, it, expect, vi } from 'vitest';
import { createNote, queryNotes } from './notes.js';
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
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  return {
    from: vi.fn(() => ({ select: vi.fn(() => chain) })),
  } as unknown as SupabaseClient;
}

describe('createNote', () => {
  it('inserts note and returns success', async () => {
    const mock = makeInsertMock();
    const result = await createNote({ content: 'Reunión importante mañana' }, mock, FAMILY_ID);
    expect(result.success).toBe(true);
  });

  it('returns error on DB failure', async () => {
    const mock = makeInsertMock('DB error');
    const result = await createNote({ content: 'Test' }, mock, FAMILY_ID);
    expect(result.success).toBe(false);
  });
});

describe('queryNotes', () => {
  it('returns matching notes', async () => {
    const mock = makeSelectMock([
      { id: '1', title: null, content: 'Reunión importante', created_at: '2026-05-29' },
    ]);
    const result = await queryNotes({ query: 'reunión' }, mock, FAMILY_ID);
    expect(result.success).toBe(true);
    if (result.success) expect(result.notes).toHaveLength(1);
  });

  it('returns recent notes when no query', async () => {
    const mock = makeSelectMock([
      { id: '1', title: 'Nota', content: 'Contenido', created_at: '2026-05-29' },
    ]);
    const result = await queryNotes({}, mock, FAMILY_ID);
    expect(result.success).toBe(true);
  });
});
