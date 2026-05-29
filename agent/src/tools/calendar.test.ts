import { describe, it, expect, vi } from 'vitest';
import { addCalendarEvent, queryCalendar } from './calendar.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';

function makeInsertMock(error: string | null = null): SupabaseClient {
  return {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: error ? { message: error } : null }),
    })),
  } as unknown as SupabaseClient;
}

function makeQueryMock(rows: unknown[]): SupabaseClient {
  const chain = {
    eq:    vi.fn().mockReturnThis(),
    gte:   vi.fn().mockReturnThis(),
    lte:   vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  return {
    from: vi.fn(() => ({ select: vi.fn(() => chain) })),
  } as unknown as SupabaseClient;
}

describe('addCalendarEvent', () => {
  it('inserts event and returns success', async () => {
    const mock = makeInsertMock();
    const result = await addCalendarEvent(
      { title: 'Examen Sofía', start_time: '2026-06-21T10:00:00' },
      mock,
      FAMILY_ID
    );
    expect(result.success).toBe(true);
  });

  it('returns error on DB failure', async () => {
    const mock = makeInsertMock('DB error');
    const result = await addCalendarEvent(
      { title: 'Test', start_time: '2026-06-21T10:00:00' },
      mock,
      FAMILY_ID
    );
    expect(result.success).toBe(false);
  });
});

describe('queryCalendar', () => {
  it('returns events for week range', async () => {
    const mock = makeQueryMock([
      { id: '1', title: 'Reunión', start_time: '2026-05-30T10:00:00', end_time: null, all_day: false },
    ]);
    const result = await queryCalendar({ range: 'week' }, mock, FAMILY_ID);
    expect(result.success).toBe(true);
    if (result.success) expect(result.events).toHaveLength(1);
  });

  it('returns empty list when no events', async () => {
    const mock = makeQueryMock([]);
    const result = await queryCalendar({ range: 'today' }, mock, FAMILY_ID);
    expect(result.success).toBe(true);
    if (result.success) expect(result.events).toHaveLength(0);
  });
});
