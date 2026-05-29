import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { maskContent } from '../utils/masking.js';

// ── save_investment_note ──────────────────────────────────────────────────────

export const saveInvestmentNoteSchema = z.object({
  title:   z.string().min(1),
  content: z.string().min(1),
});

export type SaveInvestmentNoteInput = z.input<typeof saveInvestmentNoteSchema>;

export async function saveInvestmentNote(
  input: SaveInvestmentNoteInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const content_masked = maskContent(input.content);

  const { error } = await supabase.from('investment_notes').insert({
    family_id:      familyId,
    title:          input.title,
    content:        input.content,
    content_masked,
  });

  if (error) return { success: false, error: error.message };
  return { success: true, message: `Nota de inversión "${input.title}" guardada.` };
}

export const saveInvestmentNoteDeclaration = {
  name:        'save_investment_note',
  description: 'Guarda una nota de inversión o finanzas familiares. Los datos sensibles (IBANs, etc.) se almacenan enmascarados.',
  parameters: {
    type: 'OBJECT',
    properties: {
      title:   { type: 'STRING', description: 'Título de la nota (p.ej. "Cartera Bogle").' },
      content: { type: 'STRING', description: 'Contenido de la nota.' },
    },
    required: ['title', 'content'],
  },
};

// ── query_investment_notes ────────────────────────────────────────────────────

export const queryInvestmentNotesSchema = z.object({
  limit: z.number().int().min(1).max(10).optional().default(5),
});

export type QueryInvestmentNotesInput = z.input<typeof queryInvestmentNotesSchema>;

type InvestmentNote = { id: string; title: string; content_masked: string; created_at: string };

export async function queryInvestmentNotes(
  input: QueryInvestmentNotesInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; notes: InvestmentNote[] } | { success: false; error: string }> {
  const { data, error } = await supabase
    .from('investment_notes')
    .select('id, title, content_masked, created_at')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 5);

  if (error) return { success: false, error: error.message };
  return { success: true, notes: (data ?? []) as InvestmentNote[] };
}

export const queryInvestmentNotesDeclaration = {
  name:        'query_investment_notes',
  description: 'Consulta las notas de inversión y finanzas familiares (muestra contenido enmascarado).',
  parameters: {
    type: 'OBJECT',
    properties: {
      limit: { type: 'NUMBER', description: 'Número máximo de notas (1-10). Por defecto 5.' },
    },
    required: [],
  },
};
