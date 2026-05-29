import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── add_chore ─────────────────────────────────────────────────────────────────

export const addChoreSchema = z.object({
  name:        z.string().min(1),
  assigned_to: z.string().uuid().optional(),
  frequency:   z.string().optional(),
});

export type AddChoreInput = z.input<typeof addChoreSchema>;

export async function addChore(
  input: AddChoreInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const { error } = await supabase.from('chores').insert({
    family_id:   familyId,
    name:        input.name,
    assigned_to: input.assigned_to ?? null,
    frequency:   input.frequency ?? null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, message: `Tarea "${input.name}" añadida.` };
}

export const addChoreDeclaration = {
  name:        'add_chore',
  description: 'Añade una tarea doméstica al listado familiar.',
  parameters: {
    type: 'OBJECT',
    properties: {
      name:        { type: 'STRING', description: 'Nombre de la tarea (p.ej. "Fregar los platos").' },
      frequency:   { type: 'STRING', description: 'Frecuencia opcional: diario, semanal, mensual, etc.' },
      assigned_to: { type: 'STRING', description: 'UUID del miembro familiar al que se asigna (opcional).' },
    },
    required: ['name'],
  },
};

// ── query_chores ──────────────────────────────────────────────────────────────

export const queryChoresSchema = z.object({
  limit: z.number().int().min(1).max(20).optional().default(10),
});

export type QueryChoresInput = z.input<typeof queryChoresSchema>;

type Chore = { id: string; name: string; frequency: string | null; assigned_to: string | null };

export async function queryChores(
  input: QueryChoresInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; chores: Chore[] } | { success: false; error: string }> {
  const { data, error } = await supabase
    .from('chores')
    .select('id, name, frequency, assigned_to')
    .eq('family_id', familyId)
    .order('name', { ascending: true })
    .limit(input.limit ?? 10);

  if (error) return { success: false, error: error.message };
  return { success: true, chores: (data ?? []) as Chore[] };
}

export const queryChoresDeclaration = {
  name:        'query_chores',
  description: 'Consulta las tareas domésticas de la familia.',
  parameters: {
    type: 'OBJECT',
    properties: {
      limit: { type: 'NUMBER', description: 'Número máximo de tareas a devolver (1-20). Por defecto 10.' },
    },
    required: [],
  },
};

// ── log_chore ─────────────────────────────────────────────────────────────────

export const logChoreSchema = z.object({
  chore_id:     z.string().uuid(),
  completed_by: z.string().uuid().optional(),
});

export type LogChoreInput = z.input<typeof logChoreSchema>;

export async function logChore(
  input: LogChoreInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const { data: chore } = await supabase
    .from('chores')
    .select('name')
    .eq('id', input.chore_id)
    .eq('family_id', familyId)
    .single();

  if (!chore) return { success: false, error: 'Tarea no encontrada.' };

  const { error } = await supabase.from('chore_logs').insert({
    family_id:    familyId,
    chore_id:     input.chore_id,
    completed_by: input.completed_by ?? null,
  });

  if (error) return { success: false, error: error.message };
  return { success: true, message: `Tarea "${chore.name}" marcada como completada.` };
}

export const logChoreDeclaration = {
  name:        'log_chore',
  description: 'Registra que una tarea doméstica ha sido completada.',
  parameters: {
    type: 'OBJECT',
    properties: {
      chore_id:     { type: 'STRING', description: 'UUID de la tarea completada.' },
      completed_by: { type: 'STRING', description: 'UUID del miembro que la completó (opcional).' },
    },
    required: ['chore_id'],
  },
};
