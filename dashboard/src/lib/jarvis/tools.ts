import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const TIMEZONE = process.env.TIMEZONE ?? 'Europe/Madrid';

// ── Masking (ADR-001) ─────────────────────────────────────────────────────────
const DNI_RE  = /\b(\d{4})(\d{4}[A-Z])\b/g;
const IBAN_RE = /\b([A-Z]{2}\d{2})([\s\d]{10,30})(\d{4})\b/g;

export function maskContent(text: string): string {
  return text
    .replace(DNI_RE, '****$2')
    .replace(IBAN_RE, (_, prefix, middle, last) =>
      `${prefix} ${middle.replace(/\d/g, '*').replace(/\s+/g, ' ').trim()} ${last}`
    );
}

export function containsSensitiveData(text: string): boolean {
  DNI_RE.lastIndex  = 0;
  IBAN_RE.lastIndex = 0;
  return DNI_RE.test(text) || IBAN_RE.test(text);
}

// ── Embeddings ────────────────────────────────────────────────────────────────
const genaiEmbed = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function generateEmbedding(text: string): Promise<number[]> {
  const model  = genaiEmbed.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// ── Tool context ──────────────────────────────────────────────────────────────
export interface ToolContext {
  supabase:  SupabaseClient;
  familyId:  string;
  memberId?: string;
}

// ── Shopping ──────────────────────────────────────────────────────────────────
const addShoppingItemsSchema = z.object({
  items:     z.array(z.object({ name: z.string().min(1), quantity: z.string().optional() })).min(1),
  list_name: z.string().optional().default('Lista principal'),
});

async function addShoppingItems(input: z.infer<typeof addShoppingItemsSchema>, supabase: SupabaseClient, familyId: string) {
  const { data: existing } = await supabase.from('shopping_lists').select('id').eq('family_id', familyId).eq('name', input.list_name).single();
  let listId: string;
  if (existing) {
    listId = existing.id;
  } else {
    const { data: created, error } = await supabase.from('shopping_lists').insert({ family_id: familyId, name: input.list_name }).select('id').single();
    if (error || !created) return { success: false, error: error?.message ?? 'Could not create list' };
    listId = created.id;
  }
  const { error } = await supabase.from('shopping_items').insert(
    input.items.map(i => ({ family_id: familyId, list_id: listId, name: i.name, quantity: i.quantity ?? null }))
  );
  if (error) return { success: false, error: error.message };
  return { success: true, added: input.items.length };
}

const queryShoppingItemsSchema = z.object({
  include_checked: z.boolean().optional().default(false),
  list_name:       z.string().optional().default('Lista principal'),
});

async function queryShoppingItems(input: z.infer<typeof queryShoppingItemsSchema>, supabase: SupabaseClient, familyId: string) {
  let q = supabase.from('shopping_items').select('id, name, quantity, checked').eq('family_id', familyId);
  if (!input.include_checked) q = q.eq('checked', false);
  const { data, error } = await q.order('created_at', { ascending: true }).limit(30);
  if (error) return { success: false, error: error.message };
  return { success: true, items: data ?? [] };
}

const checkShoppingItemSchema = z.object({
  item_name: z.string().min(1),
  checked:   z.boolean().optional().default(true),
});

async function checkShoppingItem(input: z.infer<typeof checkShoppingItemSchema>, supabase: SupabaseClient, familyId: string) {
  const { data: found } = await supabase.from('shopping_items').select('id').eq('family_id', familyId).ilike('name', input.item_name).limit(1);
  if (!found?.length) return { success: false, error: `No encontré "${input.item_name}" en la lista.` };
  const { error } = await supabase.from('shopping_items').update({ checked: input.checked }).eq('id', found[0].id);
  if (error) return { success: false, error: error.message };
  return { success: true, message: `"${input.item_name}" ${input.checked ? 'marcado como comprado' : 'desmarcado'}.` };
}

const clearCheckedItemsSchema = z.object({});

async function clearCheckedItems(_input: z.infer<typeof clearCheckedItemsSchema>, supabase: SupabaseClient, familyId: string) {
  const { error, count } = await supabase.from('shopping_items').delete().eq('family_id', familyId).eq('checked', true);
  if (error) return { success: false, error: error.message };
  return { success: true, cleared: count ?? 0 };
}

// ── Calendar ──────────────────────────────────────────────────────────────────
const addCalendarEventSchema = z.object({
  title:       z.string().min(1),
  start_time:  z.string(),
  end_time:    z.string().optional(),
  all_day:     z.boolean().optional().default(false),
  description: z.string().optional(),
});

async function addCalendarEvent(input: z.infer<typeof addCalendarEventSchema>, supabase: SupabaseClient, familyId: string) {
  const { error } = await supabase.from('calendar_events').insert({
    family_id: familyId, title: input.title, start_time: input.start_time,
    end_time: input.end_time ?? null, all_day: input.all_day ?? false, description: input.description ?? null,
  });
  if (error) return { success: false, error: error.message };
  const date = new Date(input.start_time).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIMEZONE });
  return { success: true, message: `Evento "${input.title}" registrado para el ${date}.` };
}

const queryCalendarSchema = z.object({ range: z.enum(['today', 'week', 'month']).optional().default('week') });

async function queryCalendar(input: z.infer<typeof queryCalendarSchema>, supabase: SupabaseClient, familyId: string) {
  const days  = input.range === 'today' ? 1 : input.range === 'month' ? 30 : 7;
  const now   = new Date().toISOString();
  const until = new Date(Date.now() + days * 86_400_000).toISOString();
  const { data, error } = await supabase.from('calendar_events').select('id, title, start_time, end_time, all_day').eq('family_id', familyId).gte('start_time', now).lte('start_time', until).order('start_time', { ascending: true }).limit(10);
  if (error) return { success: false, error: error.message };
  return { success: true, events: data ?? [] };
}

// ── Reminders ─────────────────────────────────────────────────────────────────
const addReminderSchema = z.object({
  title: z.string().min(1), remind_at: z.string(), event_id: z.string().uuid().optional(),
});

async function addReminder(input: z.infer<typeof addReminderSchema>, supabase: SupabaseClient, familyId: string) {
  let eventId = input.event_id;
  if (!eventId) {
    const { data: ev, error: evErr } = await supabase.from('calendar_events').insert({ family_id: familyId, title: input.title, start_time: input.remind_at }).select('id').single();
    if (evErr || !ev) return { success: false, error: evErr?.message ?? 'Error creando evento' };
    eventId = ev.id;
  }
  const { error } = await supabase.from('event_reminders').insert({ family_id: familyId, event_id: eventId, remind_at: input.remind_at });
  if (error) return { success: false, error: error.message };
  const date = new Date(input.remind_at).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE });
  return { success: true, message: `Recordatorio "${input.title}" fijado para el ${date}.` };
}

// ── Notes ─────────────────────────────────────────────────────────────────────
const createNoteSchema = z.object({ content: z.string().min(1), title: z.string().optional() });

async function createNote(input: z.infer<typeof createNoteSchema>, supabase: SupabaseClient, familyId: string) {
  const { error } = await supabase.from('notes').insert({ family_id: familyId, content: input.content, title: input.title ?? null });
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Nota guardada.' };
}

const queryNotesSchema = z.object({ query: z.string().optional(), limit: z.number().int().min(1).max(10).optional().default(5) });

async function queryNotes(input: z.infer<typeof queryNotesSchema>, supabase: SupabaseClient, familyId: string) {
  let q = supabase.from('notes').select('id, title, content, created_at').eq('family_id', familyId);
  if (input.query) q = q.ilike('content', `%${input.query}%`);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(input.limit ?? 5);
  if (error) return { success: false, error: error.message };
  return { success: true, notes: data ?? [] };
}

// ── Recipes ───────────────────────────────────────────────────────────────────
const addRecipeSchema = z.object({
  name: z.string().min(1), ingredients: z.array(z.string()).default([]),
  instructions: z.string().optional(), servings: z.number().int().positive().optional(),
  prep_minutes: z.number().int().positive().optional(),
});

async function addRecipe(input: z.infer<typeof addRecipeSchema>, supabase: SupabaseClient, familyId: string) {
  const { error } = await supabase.from('recipes').insert({
    family_id: familyId, name: input.name, ingredients: input.ingredients ?? [],
    instructions: input.instructions ?? null, servings: input.servings ?? null, prep_minutes: input.prep_minutes ?? null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, message: `Receta "${input.name}" guardada.` };
}

// ── Menu ──────────────────────────────────────────────────────────────────────
const suggestMenuSchema = z.object({
  days: z.number().int().min(1).max(7).optional().default(7),
  note: z.string().optional(),
});

const addWeeklyMenuSchema = z.object({ week_start: z.string(), menu: z.record(z.unknown()) });

async function addWeeklyMenu(input: z.infer<typeof addWeeklyMenuSchema>, supabase: SupabaseClient, familyId: string) {
  const { error } = await supabase.from('weekly_menus').insert({ family_id: familyId, week_start: input.week_start, menu: input.menu });
  if (error) return { success: false, error: error.message };
  return { success: true, message: `Menú de la semana del ${input.week_start} guardado.` };
}

// ── Knowledge ─────────────────────────────────────────────────────────────────
const saveKnowledgeSchema = z.object({
  title: z.string().min(1), content: z.string().min(1), category: z.string().optional(),
});

async function saveKnowledge(input: z.infer<typeof saveKnowledgeSchema>, supabase: SupabaseClient, familyId: string) {
  const content_masked = maskContent(input.content);
  let embedding: number[] | null = null;
  try { embedding = await generateEmbedding(`${input.title}\n${input.content}`); } catch { /* best-effort */ }
  const { error } = await supabase.from('knowledge_entries').insert({
    family_id: familyId, title: input.title, content: input.content, content_masked, category: input.category ?? null, embedding,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, message: `"${input.title}" guardado en la base de conocimiento.` };
}

const searchKnowledgeSchema = z.object({
  query: z.string().min(1), match_threshold: z.number().min(0).max(1).optional().default(0.7),
  limit: z.number().int().min(1).max(5).optional().default(3),
});

async function searchKnowledge(input: z.infer<typeof searchKnowledgeSchema>, supabase: SupabaseClient, familyId: string) {
  let queryEmbedding: number[];
  try { queryEmbedding = await generateEmbedding(input.query); }
  catch { return { success: false, error: 'No se pudo generar el embedding de búsqueda.' }; }
  const rpcFn = supabase.rpc as unknown as (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpcFn('match_knowledge_entries', {
    query_embedding: queryEmbedding, match_threshold: input.match_threshold ?? 0.7,
    match_count: input.limit ?? 3, p_family_id: familyId,
  });
  if (error) return { success: false, error: error.message };
  const rows = (data ?? []) as Record<string, unknown>[];
  return { success: true, results: rows.map(r => ({ title: r.title as string, content_masked: r.content_masked as string, similarity: r.similarity as number })) };
}

// ── Chores ────────────────────────────────────────────────────────────────────
const addChoreSchema = z.object({ name: z.string().min(1), assigned_to: z.string().uuid().optional(), frequency: z.string().optional() });

async function addChore(input: z.infer<typeof addChoreSchema>, supabase: SupabaseClient, familyId: string) {
  const { error } = await supabase.from('chores').insert({ family_id: familyId, name: input.name, assigned_to: input.assigned_to ?? null, frequency: input.frequency ?? null });
  if (error) return { success: false, error: error.message };
  return { success: true, message: `Tarea "${input.name}" añadida.` };
}

const queryChoresSchema = z.object({ limit: z.number().int().min(1).max(20).optional().default(10) });

async function queryChores(input: z.infer<typeof queryChoresSchema>, supabase: SupabaseClient, familyId: string) {
  const { data, error } = await supabase.from('chores').select('id, name, frequency, assigned_to').eq('family_id', familyId).order('name', { ascending: true }).limit(input.limit ?? 10);
  if (error) return { success: false, error: error.message };
  return { success: true, chores: data ?? [] };
}

const logChoreSchema = z.object({ chore_id: z.string().uuid(), completed_by: z.string().uuid().optional() });

async function logChore(input: z.infer<typeof logChoreSchema>, supabase: SupabaseClient, familyId: string) {
  const { data: chore } = await supabase.from('chores').select('name').eq('id', input.chore_id).eq('family_id', familyId).single();
  if (!chore) return { success: false, error: 'Tarea no encontrada.' };
  const { error } = await supabase.from('chore_logs').insert({ family_id: familyId, chore_id: input.chore_id, completed_by: input.completed_by ?? null });
  if (error) return { success: false, error: error.message };
  return { success: true, message: `Tarea "${chore.name}" marcada como completada.` };
}

// ── Pets ──────────────────────────────────────────────────────────────────────
const addPetSchema = z.object({ name: z.string().min(1), species: z.string().min(1), breed: z.string().optional(), birth_date: z.string().optional() });

async function addPet(input: z.infer<typeof addPetSchema>, supabase: SupabaseClient, familyId: string) {
  const { error } = await supabase.from('pets').insert({ family_id: familyId, name: input.name, species: input.species, breed: input.breed ?? null, birth_date: input.birth_date ?? null });
  if (error) return { success: false, error: error.message };
  return { success: true, message: `Mascota "${input.name}" registrada.` };
}

const addPetDiaryEntrySchema = z.object({ pet_id: z.string().uuid(), entry: z.string().min(1), category: z.string().optional() });

async function addPetDiaryEntry(input: z.infer<typeof addPetDiaryEntrySchema>, supabase: SupabaseClient, familyId: string) {
  const { error } = await supabase.from('pet_diary').insert({ family_id: familyId, pet_id: input.pet_id, entry: input.entry, category: input.category ?? null });
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Entrada añadida al diario de la mascota.' };
}

const addPetReminderSchema = z.object({ pet_id: z.string().uuid(), title: z.string().min(1), remind_at: z.string() });

async function addPetReminder(input: z.infer<typeof addPetReminderSchema>, supabase: SupabaseClient, familyId: string) {
  const { error } = await supabase.from('pet_reminders').insert({ family_id: familyId, pet_id: input.pet_id, title: input.title, remind_at: input.remind_at });
  if (error) return { success: false, error: error.message };
  const date = new Date(input.remind_at).toLocaleString('es-ES', { day: 'numeric', month: 'long', timeZone: TIMEZONE });
  return { success: true, message: `Recordatorio "${input.title}" fijado para el ${date}.` };
}

const queryPetSchema = z.object({ name: z.string().optional(), limit: z.number().int().min(1).max(10).optional().default(5) });

async function queryPet(input: z.infer<typeof queryPetSchema>, supabase: SupabaseClient, familyId: string) {
  let petQ = supabase.from('pets').select('id, name, species, breed, birth_date').eq('family_id', familyId);
  if (input.name) petQ = petQ.ilike('name', `%${input.name}%`);
  const { data: petData } = await (petQ as unknown as { single: () => Promise<{ data: Record<string, unknown> | null }> }).single();
  if (!petData) return { success: false, error: 'No encontré ninguna mascota con ese nombre.' };
  const { data: diaryData } = await supabase.from('pet_diary').select('id, entry, category, created_at').eq('pet_id', petData.id as string).eq('family_id', familyId).order('created_at', { ascending: false }).limit(input.limit ?? 5);
  return { success: true, pet: petData, diary: diaryData ?? [] };
}

// ── Investments ───────────────────────────────────────────────────────────────
const saveInvestmentNoteSchema = z.object({ title: z.string().min(1), content: z.string().min(1) });

async function saveInvestmentNote(input: z.infer<typeof saveInvestmentNoteSchema>, supabase: SupabaseClient, familyId: string) {
  const content_masked = maskContent(input.content);
  const { error } = await supabase.from('investment_notes').insert({ family_id: familyId, title: input.title, content: input.content, content_masked });
  if (error) return { success: false, error: error.message };
  return { success: true, message: `Nota de inversión "${input.title}" guardada.` };
}

const queryInvestmentNotesSchema = z.object({ limit: z.number().int().min(1).max(10).optional().default(5) });

async function queryInvestmentNotes(input: z.infer<typeof queryInvestmentNotesSchema>, supabase: SupabaseClient, familyId: string) {
  const { data, error } = await supabase.from('investment_notes').select('id, title, content_masked, created_at').eq('family_id', familyId).order('created_at', { ascending: false }).limit(input.limit ?? 5);
  if (error) return { success: false, error: error.message };
  return { success: true, notes: data ?? [] };
}

// ── Tool registry ─────────────────────────────────────────────────────────────
type Handler = (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;

interface ToolDef {
  name:             string;
  schema:           z.ZodTypeAny;
  handler:          (input: z.infer<z.ZodTypeAny>, ctx: ToolContext) => Promise<unknown>;
  declaration:      Record<string, unknown>;
  useClaudeInstead: boolean;
}

export const tools: ToolDef[] = [
  { name: 'add_shopping_items',   schema: addShoppingItemsSchema,    handler: (i, c) => addShoppingItems(i, c.supabase, c.familyId),    useClaudeInstead: false, declaration: { name: 'add_shopping_items',   description: 'Añade uno o más artículos a la lista de la compra familiar.', parameters: { type: 'OBJECT', properties: { items: { type: 'ARRAY', description: 'Lista de artículos a añadir', items: { type: 'OBJECT', properties: { name: { type: 'STRING', description: 'Nombre del artículo' }, quantity: { type: 'STRING', description: 'Cantidad opcional, p.ej. "2 kg"' } }, required: ['name'] } }, list_name: { type: 'STRING', description: 'Nombre de la lista. Por defecto: "Lista principal"' } }, required: ['items'] } } },
  { name: 'query_shopping',       schema: queryShoppingItemsSchema,  handler: (i, c) => queryShoppingItems(i, c.supabase, c.familyId),  useClaudeInstead: false, declaration: { name: 'query_shopping',       description: 'Consulta los artículos de la lista de la compra.', parameters: { type: 'OBJECT', properties: { include_checked: { type: 'BOOLEAN', description: 'Si true, incluye artículos ya marcados como comprados. Por defecto false.' } }, required: [] } } },
  { name: 'check_shopping_item',  schema: checkShoppingItemSchema,   handler: (i, c) => checkShoppingItem(i, c.supabase, c.familyId),  useClaudeInstead: false, declaration: { name: 'check_shopping_item',  description: 'Marca o desmarca un artículo de la lista de la compra como comprado.', parameters: { type: 'OBJECT', properties: { item_name: { type: 'STRING', description: 'Nombre del artículo a marcar.' }, checked: { type: 'BOOLEAN', description: 'true para marcar comprado, false para desmarcar. Por defecto true.' } }, required: ['item_name'] } } },
  { name: 'clear_checked_items',  schema: clearCheckedItemsSchema,   handler: (i, c) => clearCheckedItems(i, c.supabase, c.familyId),  useClaudeInstead: false, declaration: { name: 'clear_checked_items',  description: 'Elimina de la lista todos los artículos ya marcados como comprados.', parameters: { type: 'OBJECT', properties: {}, required: [] } } },
  { name: 'add_calendar_event',   schema: addCalendarEventSchema,    handler: (i, c) => addCalendarEvent(i, c.supabase, c.familyId),   useClaudeInstead: false, declaration: { name: 'add_calendar_event',   description: 'Añade un evento al calendario familiar.', parameters: { type: 'OBJECT', properties: { title: { type: 'STRING', description: 'Título del evento.' }, start_time: { type: 'STRING', description: 'Fecha y hora de inicio en ISO 8601. Ejemplo: "2026-06-21T10:00:00".' }, end_time: { type: 'STRING', description: 'Fecha y hora de fin (opcional).' }, all_day: { type: 'BOOLEAN', description: 'true si es un evento de todo el día.' }, description: { type: 'STRING', description: 'Notas adicionales (opcional).' } }, required: ['title', 'start_time'] } } },
  { name: 'query_calendar',       schema: queryCalendarSchema,       handler: (i, c) => queryCalendar(i, c.supabase, c.familyId),       useClaudeInstead: false, declaration: { name: 'query_calendar',       description: 'Consulta los próximos eventos del calendario familiar.', parameters: { type: 'OBJECT', properties: { range: { type: 'STRING', description: 'Rango: "today" (hoy), "week" (7 días), "month" (30 días). Por defecto "week".' } }, required: [] } } },
  { name: 'add_reminder',         schema: addReminderSchema,         handler: (i, c) => addReminder(i, c.supabase, c.familyId),         useClaudeInstead: false, declaration: { name: 'add_reminder',         description: 'Añade un recordatorio. Puede ser independiente o vinculado a un evento del calendario.', parameters: { type: 'OBJECT', properties: { title: { type: 'STRING', description: 'Texto del recordatorio.' }, remind_at: { type: 'STRING', description: 'Fecha y hora del recordatorio en ISO 8601.' }, event_id: { type: 'STRING', description: 'UUID del evento existente al que vincularlo (opcional).' } }, required: ['title', 'remind_at'] } } },
  { name: 'create_note',          schema: createNoteSchema,          handler: (i, c) => createNote(i, c.supabase, c.familyId),          useClaudeInstead: false, declaration: { name: 'create_note',          description: 'Guarda una nota en la bitácora familiar.', parameters: { type: 'OBJECT', properties: { content: { type: 'STRING', description: 'Contenido de la nota.' }, title: { type: 'STRING', description: 'Título opcional de la nota.' } }, required: ['content'] } } },
  { name: 'query_notes',          schema: queryNotesSchema,          handler: (i, c) => queryNotes(i, c.supabase, c.familyId),          useClaudeInstead: false, declaration: { name: 'query_notes',          description: 'Busca notas en la bitácora familiar.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Texto a buscar en el contenido (opcional).' }, limit: { type: 'NUMBER', description: 'Número máximo de notas a devolver (1-10). Por defecto 5.' } }, required: [] } } },
  { name: 'add_recipe',           schema: addRecipeSchema,           handler: (i, c) => addRecipe(i, c.supabase, c.familyId),           useClaudeInstead: false, declaration: { name: 'add_recipe',           description: 'Guarda una receta en el recetario familiar.', parameters: { type: 'OBJECT', properties: { name: { type: 'STRING', description: 'Nombre de la receta.' }, ingredients: { type: 'ARRAY', description: 'Lista de ingredientes.', items: { type: 'STRING' } }, instructions: { type: 'STRING', description: 'Instrucciones de preparación.' }, servings: { type: 'NUMBER', description: 'Número de raciones.' }, prep_minutes: { type: 'NUMBER', description: 'Tiempo de preparación en minutos.' } }, required: ['name'] } } },
  { name: 'suggest_menu',         schema: suggestMenuSchema,         handler: async () => ({ suggestion: 'Handled by Claude' }),         useClaudeInstead: true,  declaration: { name: 'suggest_menu',         description: 'Sugiere un menú semanal personalizado para la familia, respetando la dieta Keto de Elena, menú infantil para los niños y dieta híbrida de Carlos. Genera sugerencias creativas y equilibradas.', parameters: { type: 'OBJECT', properties: { days: { type: 'NUMBER', description: 'Número de días para el menú (1-7). Por defecto 7.' }, note: { type: 'STRING', description: 'Nota adicional, p.ej. "sin cerdo", "fácil de preparar".' } }, required: [] } } },
  { name: 'add_weekly_menu',      schema: addWeeklyMenuSchema,       handler: (i, c) => addWeeklyMenu(i, c.supabase, c.familyId),       useClaudeInstead: false, declaration: { name: 'add_weekly_menu',      description: 'Guarda el menú semanal de la familia.', parameters: { type: 'OBJECT', properties: { week_start: { type: 'STRING', description: 'Fecha del lunes de la semana en formato YYYY-MM-DD.' }, menu: { type: 'OBJECT', description: 'Objeto con el menú por día.' } }, required: ['week_start', 'menu'] } } },
  { name: 'save_knowledge',       schema: saveKnowledgeSchema,       handler: (i, c) => saveKnowledge(i, c.supabase, c.familyId),       useClaudeInstead: false, declaration: { name: 'save_knowledge',       description: 'Guarda información en la base de conocimiento familiar (notas importantes, datos del hogar, procedimientos). NO usar para datos sensibles como DNI, IBAN o contraseñas.', parameters: { type: 'OBJECT', properties: { title: { type: 'STRING', description: 'Título descriptivo de la información.' }, content: { type: 'STRING', description: 'Contenido a guardar. Sin datos sensibles (DNI, IBAN, contraseñas).' }, category: { type: 'STRING', description: 'Categoría opcional (hogar, salud, escuela, etc.).' } }, required: ['title', 'content'] } } },
  { name: 'search_knowledge',     schema: searchKnowledgeSchema,     handler: (i, c) => searchKnowledge(i, c.supabase, c.familyId),     useClaudeInstead: false, declaration: { name: 'search_knowledge',     description: 'Busca en la base de conocimiento familiar usando similitud semántica.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Pregunta o término a buscar.' }, limit: { type: 'NUMBER', description: 'Número máximo de resultados (1-5). Por defecto 3.' } }, required: ['query'] } } },
  { name: 'add_chore',            schema: addChoreSchema,            handler: (i, c) => addChore(i, c.supabase, c.familyId),            useClaudeInstead: false, declaration: { name: 'add_chore',            description: 'Añade una tarea doméstica al listado familiar.', parameters: { type: 'OBJECT', properties: { name: { type: 'STRING', description: 'Nombre de la tarea (p.ej. "Fregar los platos").' }, frequency: { type: 'STRING', description: 'Frecuencia opcional: diario, semanal, mensual, etc.' }, assigned_to: { type: 'STRING', description: 'UUID del miembro familiar al que se asigna (opcional).' } }, required: ['name'] } } },
  { name: 'query_chores',         schema: queryChoresSchema,         handler: (i, c) => queryChores(i, c.supabase, c.familyId),         useClaudeInstead: false, declaration: { name: 'query_chores',         description: 'Consulta las tareas domésticas de la familia.', parameters: { type: 'OBJECT', properties: { limit: { type: 'NUMBER', description: 'Número máximo de tareas a devolver (1-20). Por defecto 10.' } }, required: [] } } },
  { name: 'log_chore',            schema: logChoreSchema,            handler: (i, c) => logChore(i, c.supabase, c.familyId),            useClaudeInstead: false, declaration: { name: 'log_chore',            description: 'Registra que una tarea doméstica ha sido completada.', parameters: { type: 'OBJECT', properties: { chore_id: { type: 'STRING', description: 'UUID de la tarea completada.' }, completed_by: { type: 'STRING', description: 'UUID del miembro que la completó (opcional).' } }, required: ['chore_id'] } } },
  { name: 'add_pet',              schema: addPetSchema,              handler: (i, c) => addPet(i, c.supabase, c.familyId),              useClaudeInstead: false, declaration: { name: 'add_pet',              description: 'Registra una mascota de la familia.', parameters: { type: 'OBJECT', properties: { name: { type: 'STRING', description: 'Nombre de la mascota.' }, species: { type: 'STRING', description: 'Especie: perro, gato, conejo, etc.' }, breed: { type: 'STRING', description: 'Raza (opcional).' }, birth_date: { type: 'STRING', description: 'Fecha de nacimiento en formato YYYY-MM-DD (opcional).' } }, required: ['name', 'species'] } } },
  { name: 'add_pet_diary_entry',  schema: addPetDiaryEntrySchema,    handler: (i, c) => addPetDiaryEntry(i, c.supabase, c.familyId),    useClaudeInstead: false, declaration: { name: 'add_pet_diary_entry',  description: 'Añade una entrada al diario de una mascota (visita vet, vacuna, incidencia, etc.).', parameters: { type: 'OBJECT', properties: { pet_id: { type: 'STRING', description: 'UUID de la mascota.' }, entry: { type: 'STRING', description: 'Texto de la entrada.' }, category: { type: 'STRING', description: 'Categoría opcional: salud, alimentación, comportamiento, etc.' } }, required: ['pet_id', 'entry'] } } },
  { name: 'add_pet_reminder',     schema: addPetReminderSchema,      handler: (i, c) => addPetReminder(i, c.supabase, c.familyId),      useClaudeInstead: false, declaration: { name: 'add_pet_reminder',     description: 'Añade un recordatorio para una mascota (vacuna, revisión, medicación).', parameters: { type: 'OBJECT', properties: { pet_id: { type: 'STRING', description: 'UUID de la mascota.' }, title: { type: 'STRING', description: 'Título del recordatorio.' }, remind_at: { type: 'STRING', description: 'Fecha y hora en ISO 8601.' } }, required: ['pet_id', 'title', 'remind_at'] } } },
  { name: 'query_pet',            schema: queryPetSchema,            handler: (i, c) => queryPet(i, c.supabase, c.familyId),            useClaudeInstead: false, declaration: { name: 'query_pet',            description: 'Consulta información de una mascota y sus últimas entradas del diario.', parameters: { type: 'OBJECT', properties: { name: { type: 'STRING', description: 'Nombre de la mascota a buscar.' }, limit: { type: 'NUMBER', description: 'Número máximo de entradas del diario (1-10). Por defecto 5.' } }, required: [] } } },
  { name: 'save_investment_note', schema: saveInvestmentNoteSchema,  handler: (i, c) => saveInvestmentNote(i, c.supabase, c.familyId),  useClaudeInstead: false, declaration: { name: 'save_investment_note', description: 'Guarda una nota de inversión o finanzas familiares. Los datos sensibles (IBANs, etc.) se almacenan enmascarados.', parameters: { type: 'OBJECT', properties: { title: { type: 'STRING', description: 'Título de la nota (p.ej. "Cartera Bogle").' }, content: { type: 'STRING', description: 'Contenido de la nota.' } }, required: ['title', 'content'] } } },
  { name: 'query_investment_notes', schema: queryInvestmentNotesSchema, handler: (i, c) => queryInvestmentNotes(i, c.supabase, c.familyId), useClaudeInstead: false, declaration: { name: 'query_investment_notes', description: 'Consulta las notas de inversión y finanzas familiares (muestra contenido enmascarado).', parameters: { type: 'OBJECT', properties: { limit: { type: 'NUMBER', description: 'Número máximo de notas (1-10). Por defecto 5.' } }, required: [] } } },
];

export function findTool(name: string) {
  return tools.find(t => t.name === name);
}

// Suppress unused type warning
void (0 as unknown as Handler);
