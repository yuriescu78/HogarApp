import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── add_pet ───────────────────────────────────────────────────────────────────

export const addPetSchema = z.object({
  name:       z.string().min(1),
  species:    z.string().min(1),
  breed:      z.string().optional(),
  birth_date: z.string().optional(),
});

export type AddPetInput = z.input<typeof addPetSchema>;

export async function addPet(
  input: AddPetInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const { error } = await supabase.from('pets').insert({
    family_id:  familyId,
    name:       input.name,
    species:    input.species,
    breed:      input.breed ?? null,
    birth_date: input.birth_date ?? null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, message: `Mascota "${input.name}" registrada.` };
}

export const addPetDeclaration = {
  name:        'add_pet',
  description: 'Registra una mascota de la familia.',
  parameters: {
    type: 'OBJECT',
    properties: {
      name:       { type: 'STRING', description: 'Nombre de la mascota.' },
      species:    { type: 'STRING', description: 'Especie: perro, gato, conejo, etc.' },
      breed:      { type: 'STRING', description: 'Raza (opcional).' },
      birth_date: { type: 'STRING', description: 'Fecha de nacimiento en formato YYYY-MM-DD (opcional).' },
    },
    required: ['name', 'species'],
  },
};

// ── add_pet_diary_entry ───────────────────────────────────────────────────────

export const addPetDiaryEntrySchema = z.object({
  pet_id:   z.string().uuid(),
  entry:    z.string().min(1),
  category: z.string().optional(),
});

export type AddPetDiaryEntryInput = z.input<typeof addPetDiaryEntrySchema>;

export async function addPetDiaryEntry(
  input: AddPetDiaryEntryInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const { error } = await supabase.from('pet_diary').insert({
    family_id: familyId,
    pet_id:    input.pet_id,
    entry:     input.entry,
    category:  input.category ?? null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Entrada añadida al diario de la mascota.' };
}

export const addPetDiaryEntryDeclaration = {
  name:        'add_pet_diary_entry',
  description: 'Añade una entrada al diario de una mascota (visita vet, vacuna, incidencia, etc.).',
  parameters: {
    type: 'OBJECT',
    properties: {
      pet_id:   { type: 'STRING', description: 'UUID de la mascota.' },
      entry:    { type: 'STRING', description: 'Texto de la entrada.' },
      category: { type: 'STRING', description: 'Categoría opcional: salud, alimentación, comportamiento, etc.' },
    },
    required: ['pet_id', 'entry'],
  },
};

// ── add_pet_reminder ──────────────────────────────────────────────────────────

export const addPetReminderSchema = z.object({
  pet_id:    z.string().uuid(),
  title:     z.string().min(1),
  remind_at: z.string(),
});

export type AddPetReminderInput = z.input<typeof addPetReminderSchema>;

export async function addPetReminder(
  input: AddPetReminderInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const { error } = await supabase.from('pet_reminders').insert({
    family_id: familyId,
    pet_id:    input.pet_id,
    title:     input.title,
    remind_at: input.remind_at,
  });
  if (error) return { success: false, error: error.message };

  const date = new Date(input.remind_at).toLocaleString('es-ES', {
    day: 'numeric', month: 'long',
    timeZone: process.env.TIMEZONE ?? 'Europe/Madrid',
  });
  return { success: true, message: `Recordatorio "${input.title}" fijado para el ${date}.` };
}

export const addPetReminderDeclaration = {
  name:        'add_pet_reminder',
  description: 'Añade un recordatorio para una mascota (vacuna, revisión, medicación).',
  parameters: {
    type: 'OBJECT',
    properties: {
      pet_id:    { type: 'STRING', description: 'UUID de la mascota.' },
      title:     { type: 'STRING', description: 'Título del recordatorio.' },
      remind_at: { type: 'STRING', description: 'Fecha y hora en ISO 8601.' },
    },
    required: ['pet_id', 'title', 'remind_at'],
  },
};

// ── query_pet ─────────────────────────────────────────────────────────────────

export const queryPetSchema = z.object({
  name:  z.string().optional(),
  limit: z.number().int().min(1).max(10).optional().default(5),
});

export type QueryPetInput = z.input<typeof queryPetSchema>;

type PetInfo = { id: string; name: string; species: string; breed: string | null; birth_date: string | null };
type DiaryEntry = { id: string; entry: string; category: string | null; created_at: string };

export async function queryPet(
  input: QueryPetInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<
  | { success: true; pet: PetInfo; diary: DiaryEntry[] }
  | { success: false; error: string }
> {
  let petQuery = supabase
    .from('pets')
    .select('id, name, species, breed, birth_date')
    .eq('family_id', familyId);

  if (input.name) {
    petQuery = petQuery.ilike('name', `%${input.name}%`);
  }

  const { data: petData } = await (petQuery as unknown as { single: () => Promise<{ data: PetInfo | null; error: unknown }> }).single();

  if (!petData) return { success: false, error: `No encontré ninguna mascota con ese nombre.` };

  const { data: diaryData } = await supabase
    .from('pet_diary')
    .select('id, entry, category, created_at')
    .eq('pet_id', petData.id)
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 5);

  return { success: true, pet: petData, diary: (diaryData ?? []) as DiaryEntry[] };
}

export const queryPetDeclaration = {
  name:        'query_pet',
  description: 'Consulta información de una mascota y sus últimas entradas del diario.',
  parameters: {
    type: 'OBJECT',
    properties: {
      name:  { type: 'STRING', description: 'Nombre de la mascota a buscar.' },
      limit: { type: 'NUMBER', description: 'Número máximo de entradas del diario (1-10). Por defecto 5.' },
    },
    required: [],
  },
};
