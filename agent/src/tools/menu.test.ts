import { describe, it, expect, vi } from 'vitest';
import { addWeeklyMenu } from './menu.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';

function makeMock(error: string | null = null): SupabaseClient {
  return {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: error ? { message: error } : null }),
    })),
  } as unknown as SupabaseClient;
}

describe('addWeeklyMenu', () => {
  it('inserts weekly menu and returns success', async () => {
    const mock = makeMock();
    const result = await addWeeklyMenu(
      {
        week_start: '2026-06-02',
        menu: {
          lunes:  { ninos: 'macarrones', adultos: 'ensalada keto' },
          martes: { ninos: 'arroz',      adultos: 'pollo asado' },
        },
      },
      mock,
      FAMILY_ID
    );
    expect(result.success).toBe(true);
  });

  it('returns error on DB failure', async () => {
    const mock = makeMock('DB error');
    const result = await addWeeklyMenu({ week_start: '2026-06-02', menu: {} }, mock, FAMILY_ID);
    expect(result.success).toBe(false);
  });
});
