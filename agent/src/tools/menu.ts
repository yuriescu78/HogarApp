import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── suggest_menu (Claude Sonnet) ──────────────────────────────────────────────

export const suggestMenuSchema = z.object({
  days: z.number().int().min(1).max(7).optional().default(7),
  note: z.string().optional(),
});

export type SuggestMenuInput = z.input<typeof suggestMenuSchema>;

export const suggestMenuDeclaration = {
  name:        'suggest_menu',
  description: 'Sugiere un menú semanal personalizado para la familia, respetando la dieta Keto de Elena, menú infantil para los niños y dieta híbrida de Carlos. Genera sugerencias creativas y equilibradas.',
  parameters: {
    type: 'OBJECT',
    properties: {
      days: { type: 'NUMBER', description: 'Número de días para el menú (1-7). Por defecto 7.' },
      note: { type: 'STRING', description: 'Nota adicional, p.ej. "sin cerdo", "fácil de preparar".' },
    },
    required: [],
  },
};

// ── add_weekly_menu ────────────────────────────────────────────────────────────

export const addWeeklyMenuSchema = z.object({
  week_start: z.string(),
  menu:       z.record(z.unknown()),
});

export type AddWeeklyMenuInput = z.input<typeof addWeeklyMenuSchema>;

export async function addWeeklyMenu(
  input: AddWeeklyMenuInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const { error } = await supabase.from('weekly_menus').insert({
    family_id:  familyId,
    week_start: input.week_start,
    menu:       input.menu,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, message: `Menú de la semana del ${input.week_start} guardado.` };
}

export const addWeeklyMenuDeclaration = {
  name:        'add_weekly_menu',
  description: 'Guarda el menú semanal de la familia.',
  parameters: {
    type: 'OBJECT',
    properties: {
      week_start: { type: 'STRING', description: 'Fecha del lunes de la semana en formato YYYY-MM-DD.' },
      menu:       { type: 'OBJECT', description: 'Objeto con el menú por día. Ej: {"lunes": {"ninos": "macarrones", "adultos": "ensalada keto"}}' },
    },
    required: ['week_start', 'menu'],
  },
};
