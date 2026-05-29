import { describe, it, expect, vi } from 'vitest';
import { addPet, addPetDiaryEntry, addPetReminder, queryPet } from './pets.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';
const PET_ID    = '00000000-0000-0000-0000-000000000002';

function makeInsertMock(error: string | null = null): SupabaseClient {
  return {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: error ? { message: error } : null }),
    })),
  } as unknown as SupabaseClient;
}

function makeQueryMock(): SupabaseClient {
  const petChain = {
    eq:     vi.fn().mockReturnThis(),
    ilike:  vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: PET_ID, name: 'Luna', species: 'perro', breed: 'Labrador', birth_date: null }, error: null }),
  };
  const diaryChain = {
    eq:    vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [{ id: '1', entry: 'Vacuna antirrábica', category: 'salud', created_at: '2026-05-01' }], error: null }),
  };
  return {
    from: vi.fn((table: string) => {
      if (table === 'pets')      return { select: vi.fn(() => petChain) };
      if (table === 'pet_diary') return { select: vi.fn(() => diaryChain) };
      return {};
    }),
  } as unknown as SupabaseClient;
}

describe('addPet', () => {
  it('inserts pet and returns success', async () => {
    const result = await addPet({ name: 'Luna', species: 'perro', breed: 'Labrador' }, makeInsertMock(), FAMILY_ID);
    expect(result.success).toBe(true);
  });
});

describe('addPetDiaryEntry', () => {
  it('inserts diary entry', async () => {
    const result = await addPetDiaryEntry({ pet_id: PET_ID, entry: 'Vacuna antirrábica', category: 'salud' }, makeInsertMock(), FAMILY_ID);
    expect(result.success).toBe(true);
  });
});

describe('addPetReminder', () => {
  it('inserts reminder', async () => {
    const result = await addPetReminder({ pet_id: PET_ID, title: 'Revisión anual', remind_at: '2026-09-01T10:00:00' }, makeInsertMock(), FAMILY_ID);
    expect(result.success).toBe(true);
  });
});

describe('queryPet', () => {
  it('returns pet info and recent diary', async () => {
    const result = await queryPet({ name: 'Luna' }, makeQueryMock(), FAMILY_ID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.pet.name).toBe('Luna');
      expect(result.diary).toHaveLength(1);
    }
  });
});
