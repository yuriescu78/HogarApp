import { describe, it, expect, vi } from 'vitest';
import { addRecipe } from './recipes.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';

function makeMock(error: string | null = null): SupabaseClient {
  return {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: error ? { message: error } : null }),
    })),
  } as unknown as SupabaseClient;
}

describe('addRecipe', () => {
  it('inserts recipe and returns success', async () => {
    const mock = makeMock();
    const result = await addRecipe(
      {
        name:         'Ensalada Keto',
        ingredients:  ['lechuga', 'aguacate', 'salmón'],
        instructions: 'Mezclar todo.',
        servings:     2,
      },
      mock,
      FAMILY_ID
    );
    expect(result.success).toBe(true);
  });

  it('returns error on DB failure', async () => {
    const mock = makeMock('DB error');
    const result = await addRecipe({ name: 'Test', ingredients: [] }, mock, FAMILY_ID);
    expect(result.success).toBe(false);
  });
});
