import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const createNoteSchema = z.object({
  content: z.string().min(1),
  title:   z.string().optional(),
});

export type CreateNoteInput = z.input<typeof createNoteSchema>;

export async function createNote(
  input: CreateNoteInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const { error } = await supabase.from('notes').insert({
    family_id: familyId,
    content:   input.content,
    title:     input.title ?? null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Nota guardada.' };
}

export const createNoteDeclaration = {
  name:        'create_note',
  description: 'Guarda una nota en la bitácora familiar.',
  parameters: {
    type: 'OBJECT',
    properties: {
      content: { type: 'STRING', description: 'Contenido de la nota.' },
      title:   { type: 'STRING', description: 'Título opcional de la nota.' },
    },
    required: ['content'],
  },
};

// ── query_notes ───────────────────────────────────────────────────────────────

export const queryNotesSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().min(1).max(10).optional().default(5),
});

export type QueryNotesInput = z.input<typeof queryNotesSchema>;

type Note = { id: string; title: string | null; content: string; created_at: string };

export async function queryNotes(
  input: QueryNotesInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; notes: Note[] } | { success: false; error: string }> {
  let q = supabase
    .from('notes')
    .select('id, title, content, created_at')
    .eq('family_id', familyId);

  if (input.query) {
    q = q.ilike('content', `%${input.query}%`);
  }

  const { data, error } = await q
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 5);

  if (error) return { success: false, error: error.message };
  return { success: true, notes: (data ?? []) as Note[] };
}

export const queryNotesDeclaration = {
  name:        'query_notes',
  description: 'Busca notas en la bitácora familiar.',
  parameters: {
    type: 'OBJECT',
    properties: {
      query: { type: 'STRING', description: 'Texto a buscar en el contenido (opcional). Sin query devuelve las más recientes.' },
      limit: { type: 'NUMBER', description: 'Número máximo de notas a devolver (1-10). Por defecto 5.' },
    },
    required: [],
  },
};
