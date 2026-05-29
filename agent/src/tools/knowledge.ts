import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateEmbedding } from '../utils/embeddings.js';
import { maskContent } from '../utils/masking.js';

// ── save_knowledge ────────────────────────────────────────────────────────────

export const saveKnowledgeSchema = z.object({
  title:    z.string().min(1),
  content:  z.string().min(1),
  category: z.string().optional(),
});

export type SaveKnowledgeInput = z.input<typeof saveKnowledgeSchema>;

export async function saveKnowledge(
  input: SaveKnowledgeInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const content_masked = maskContent(input.content);
  let   embedding: number[] | null = null;

  try {
    embedding = await generateEmbedding(`${input.title}\n${input.content}`);
  } catch {
    // Embedding generation is best-effort — save without it if API fails
  }

  const { error } = await supabase.from('knowledge_entries').insert({
    family_id:      familyId,
    title:          input.title,
    content:        input.content,
    content_masked,
    category:       input.category ?? null,
    embedding,
  });

  if (error) return { success: false, error: error.message };
  return { success: true, message: `"${input.title}" guardado en la base de conocimiento.` };
}

export const saveKnowledgeDeclaration = {
  name:        'save_knowledge',
  description: 'Guarda información en la base de conocimiento familiar (notas importantes, datos del hogar, procedimientos). NO usar para datos sensibles como DNI, IBAN o contraseñas.',
  parameters: {
    type: 'OBJECT',
    properties: {
      title:    { type: 'STRING', description: 'Título descriptivo de la información.' },
      content:  { type: 'STRING', description: 'Contenido a guardar. Sin datos sensibles (DNI, IBAN, contraseñas).' },
      category: { type: 'STRING', description: 'Categoría opcional (hogar, salud, escuela, etc.).' },
    },
    required: ['title', 'content'],
  },
};

// ── search_knowledge ──────────────────────────────────────────────────────────

export const searchKnowledgeSchema = z.object({
  query:           z.string().min(1),
  match_threshold: z.number().min(0).max(1).optional().default(0.7),
  limit:           z.number().int().min(1).max(5).optional().default(3),
});

export type SearchKnowledgeInput = z.input<typeof searchKnowledgeSchema>;

type KnowledgeResult = { title: string; content_masked: string; similarity: number };

export async function searchKnowledge(
  input: SearchKnowledgeInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; results: KnowledgeResult[] } | { success: false; error: string }> {
  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(input.query);
  } catch {
    return { success: false, error: 'No se pudo generar el embedding de búsqueda.' };
  }

  const rpcResult = await (supabase.rpc as unknown as (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
    'match_knowledge_entries',
    {
      query_embedding:  queryEmbedding,
      match_threshold:  input.match_threshold ?? 0.7,
      match_count:      input.limit ?? 3,
      p_family_id:      familyId,
    }
  );
  const { data, error } = rpcResult;

  if (error) return { success: false, error: error.message };

  const rows = (data ?? []) as Record<string, unknown>[];
  const results: KnowledgeResult[] = rows.map(r => ({
    title:          r.title          as string,
    content_masked: r.content_masked as string,
    similarity:     r.similarity     as number,
  }));

  return { success: true, results };
}

export const searchKnowledgeDeclaration = {
  name:        'search_knowledge',
  description: 'Busca en la base de conocimiento familiar usando similitud semántica.',
  parameters: {
    type: 'OBJECT',
    properties: {
      query: { type: 'STRING', description: 'Pregunta o término a buscar.' },
      limit: { type: 'NUMBER', description: 'Número máximo de resultados (1-5). Por defecto 3.' },
    },
    required: ['query'],
  },
};
