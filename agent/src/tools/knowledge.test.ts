import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';

vi.mock('../utils/embeddings.js', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
}));

describe('saveKnowledge', () => {
  it('saves entry and returns success', async () => {
    const mock = {
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      })),
    } as unknown as SupabaseClient;

    const { saveKnowledge } = await import('./knowledge.js');
    const result = await saveKnowledge(
      { title: 'Cómo abrir la caldera', content: 'Girar la llave azul a la derecha.' },
      mock,
      FAMILY_ID
    );
    expect(result.success).toBe(true);
  });
});

describe('searchKnowledge', () => {
  it('returns search results', async () => {
    const mock = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ title: 'Caldera', content_masked: 'Girar la llave...', similarity: 0.92 }],
        error: null,
      }),
    } as unknown as SupabaseClient;

    const { searchKnowledge } = await import('./knowledge.js');
    const result = await searchKnowledge({ query: 'cómo abrir la caldera' }, mock, FAMILY_ID);
    expect(result.success).toBe(true);
    if (result.success) expect(result.results).toHaveLength(1);
  });
});
