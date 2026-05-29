import { describe, it, expect, vi } from 'vitest';
import { addReminder } from './reminder.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';

function makeMock(): SupabaseClient {
  const insertChain = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'evt-1' }, error: null }),
  };
  const reminderInsert = vi.fn().mockResolvedValue({ error: null });

  let callCount = 0;
  return {
    from: vi.fn((table: string) => {
      if (table === 'calendar_events') {
        return { insert: vi.fn(() => insertChain) };
      }
      return { insert: reminderInsert };
    }),
  } as unknown as SupabaseClient;
}

function makeErrorMock(): SupabaseClient {
  return {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      })),
    })),
  } as unknown as SupabaseClient;
}

describe('addReminder', () => {
  it('creates standalone reminder via synthetic event', async () => {
    const mock = makeMock();
    const result = await addReminder(
      { title: 'Pedir cita peluquería', remind_at: '2026-06-01T09:00:00' },
      mock,
      FAMILY_ID
    );
    expect(result.success).toBe(true);
  });

  it('returns error when event creation fails', async () => {
    const mock = makeErrorMock();
    const result = await addReminder(
      { title: 'Test', remind_at: '2026-06-01T09:00:00' },
      mock,
      FAMILY_ID
    );
    expect(result.success).toBe(false);
  });
});
