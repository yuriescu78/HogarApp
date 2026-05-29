# Phase 2 – Agent: Bitácora + Menús + Embeddings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir notas/bitácora familiar, recetas, menú semanal con sugerencias IA, y búsqueda semántica con embeddings Gemini text-embedding-004.

**Prerequisite:** Phase 1 agent completo. Supabase local corriendo. `shared/types/database.ts` actualizado.

**Nuevas tools:** `create_note`, `query_notes`, `add_recipe`, `suggest_menu` (Claude), `add_weekly_menu`, `search_knowledge`

**Regla ADR-001:** Solo datos Tipo A en `knowledge_entries` y `notes`. Nunca guardar DNI, IBAN, pólizas ni contraseñas.

---

### Task 1: `create_note` tool (TDD)

**Files:**
- Create: `agent/src/tools/notes.ts`
- Create: `agent/src/tools/notes.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// agent/src/tools/notes.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createNote, queryNotes } from './notes.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';

function makeInsertMock(error: string | null = null): SupabaseClient {
  return {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: error ? { message: error } : null }),
    })),
  } as unknown as SupabaseClient;
}

function makeSelectMock(rows: unknown[]): SupabaseClient {
  const chain = {
    eq:       vi.fn().mockReturnThis(),
    ilike:    vi.fn().mockReturnThis(),
    order:    vi.fn().mockReturnThis(),
    limit:    vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  return {
    from: vi.fn(() => ({ select: vi.fn(() => chain) })),
  } as unknown as SupabaseClient;
}

describe('createNote', () => {
  it('inserts note and returns success', async () => {
    const mock = makeInsertMock();
    const result = await createNote({ content: 'Reunión importante mañana' }, mock, FAMILY_ID);
    expect(result.success).toBe(true);
  });

  it('returns error on DB failure', async () => {
    const mock = makeInsertMock('DB error');
    const result = await createNote({ content: 'Test' }, mock, FAMILY_ID);
    expect(result.success).toBe(false);
  });
});

describe('queryNotes', () => {
  it('returns matching notes', async () => {
    const mock = makeSelectMock([{ id: '1', title: null, content: 'Reunión importante', created_at: '2026-05-29' }]);
    const result = await queryNotes({ query: 'reunión' }, mock, FAMILY_ID);
    expect(result.success).toBe(true);
    if (result.success) expect(result.notes).toHaveLength(1);
  });

  it('returns recent notes when no query', async () => {
    const mock = makeSelectMock([{ id: '1', title: 'Nota', content: 'Contenido', created_at: '2026-05-29' }]);
    const result = await queryNotes({}, mock, FAMILY_ID);
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd agent && npm test -- notes
```

- [ ] **Step 3: Implement notes.ts**

```typescript
// agent/src/tools/notes.ts
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
      query: { type: 'STRING', description: 'Texto a buscar en el contenido de las notas (opcional). Sin query devuelve las más recientes.' },
      limit: { type: 'NUMBER', description: 'Número máximo de notas a devolver (1-10). Por defecto 5.' },
    },
    required: [],
  },
};
```

- [ ] **Step 4: Run test to confirm pass**

```bash
cd agent && npm test -- notes
```

Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add agent/src/tools/notes.ts agent/src/tools/notes.test.ts
git commit -m "feat: create_note + query_notes tools"
```

---

### Task 2: `add_recipe` tool (TDD)

**Files:**
- Create: `agent/src/tools/recipes.ts`
- Create: `agent/src/tools/recipes.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// agent/src/tools/recipes.test.ts
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
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd agent && npm test -- recipes
```

- [ ] **Step 3: Implement recipes.ts**

```typescript
// agent/src/tools/recipes.ts
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const addRecipeSchema = z.object({
  name:         z.string().min(1),
  ingredients:  z.array(z.string()).default([]),
  instructions: z.string().optional(),
  servings:     z.number().int().positive().optional(),
  prep_minutes: z.number().int().positive().optional(),
});

export type AddRecipeInput = z.input<typeof addRecipeSchema>;

export async function addRecipe(
  input: AddRecipeInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const { error } = await supabase.from('recipes').insert({
    family_id:    familyId,
    name:         input.name,
    ingredients:  input.ingredients ?? [],
    instructions: input.instructions ?? null,
    servings:     input.servings ?? null,
    prep_minutes: input.prep_minutes ?? null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, message: `Receta "${input.name}" guardada.` };
}

export const addRecipeDeclaration = {
  name:        'add_recipe',
  description: 'Guarda una receta en el recetario familiar.',
  parameters: {
    type: 'OBJECT',
    properties: {
      name:         { type: 'STRING', description: 'Nombre de la receta.' },
      ingredients:  { type: 'ARRAY',  description: 'Lista de ingredientes.', items: { type: 'STRING' } },
      instructions: { type: 'STRING', description: 'Instrucciones de preparación.' },
      servings:     { type: 'NUMBER', description: 'Número de raciones.' },
      prep_minutes: { type: 'NUMBER', description: 'Tiempo de preparación en minutos.' },
    },
    required: ['name'],
  },
};
```

- [ ] **Step 4: Run test to confirm pass**

```bash
cd agent && npm test -- recipes
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add agent/src/tools/recipes.ts agent/src/tools/recipes.test.ts
git commit -m "feat: add_recipe tool"
```

---

### Task 3: `suggest_menu` tool (Claude Sonnet — useClaudeInstead: true)

**Files:**
- Create: `agent/src/tools/menu.ts`
- Create: `agent/src/tools/menu.test.ts`
- Create: `agent/src/agent/claude.ts`

**Architecture:** `suggest_menu` usa `useClaudeInstead: true`. El loop Gemini detecta esto y redirige al cliente Claude Sonnet, que recibe contexto de dietas y recetas disponibles para generar una sugerencia de menú.

- [ ] **Step 1: Write the failing test**

```typescript
// agent/src/tools/menu.test.ts
import { describe, it, expect, vi } from 'vitest';
import { addWeeklyMenu } from './menu.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';

function makeMock(error: string | null = null): SupabaseClient {
  return {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: error ? { message: error } : null }),
    })),
  } as unknown as SupabaseClient;
}

describe('addWeeklyMenu', () => {
  it('inserts weekly menu and returns success', async () => {
    const mock = makeMock();
    const result = await addWeeklyMenu(
      {
        week_start: '2026-06-02',
        menu: {
          lunes:   { ninos: 'macarrones', adultos: 'ensalada keto' },
          martes:  { ninos: 'arroz', adultos: 'pollo asado' },
        },
      },
      mock,
      FAMILY_ID
    );
    expect(result.success).toBe(true);
  });

  it('returns error on DB failure', async () => {
    const mock = makeMock('DB error');
    const result = await addWeeklyMenu({ week_start: '2026-06-02', menu: {} }, mock, FAMILY_ID);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd agent && npm test -- menu
```

- [ ] **Step 3: Implement menu.ts**

```typescript
// agent/src/tools/menu.ts
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
```

- [ ] **Step 4: Create claude.ts for suggest_menu**

```typescript
// agent/src/agent/claude.ts
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

const anthropic = new Anthropic();

export async function runClaudeForMenu(
  input: { days?: number; note?: string },
  supabase: SupabaseClient,
  familyId: string
): Promise<string> {
  // Load family context: members + available recipes
  const [{ data: members }, { data: recipes }] = await Promise.all([
    supabase.from('family_members').select('name, role').eq('family_id', familyId),
    supabase.from('recipes').select('name, ingredients, servings').eq('family_id', familyId).limit(20),
  ]);

  const familyInfo = members?.map(m => m.name).join(', ') ?? 'familia';
  const recipeList = recipes?.length
    ? recipes.map(r => `- ${r.name} (${(r.ingredients as string[]).slice(0, 3).join(', ')})`).join('\n')
    : 'Sin recetas guardadas aún.';

  const days = input.days ?? 7;
  const extraNote = input.note ? `\nNota adicional: ${input.note}` : '';

  const message = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role:    'user',
        content: `Eres JARVIS, el mayordomo digital de la familia. Sugiere un menú para ${days} días.

Miembros: ${familyInfo}
Restricciones dietéticas:
- Elena: dieta Keto estricta (sin cereales, sin azúcar, alta en grasas saludables)
- Los niños: menú infantil equilibrado y variado
- Carlos: dieta híbrida (flexible, puede comer de todo con moderación)

Recetas disponibles en el recetario familiar:
${recipeList}${extraNote}

Responde SOLO con el menú en español, formato conciso por día. Ejemplo:
Lunes — Niños: macarrones | Elena: ensalada de salmón con aguacate | Carlos: pasta con atún`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : 'No pude generar el menú en este momento.';
}
```

- [ ] **Step 5: Update gemini.ts loop to handle useClaudeInstead**

In `agent/src/agent/gemini.ts`, after tool execution, detect `useClaudeInstead`:

```typescript
// In the tool execution loop, replace the handler call with:
const tool = tools.find(t => t.name === call.name);

if (tool?.useClaudeInstead) {
  const { runClaudeForMenu } = await import('./claude.js');
  const result = await runClaudeForMenu(call.args as Record<string, unknown>, ctx.supabase, ctx.familyId);
  resultParts.push({
    functionResponse: { name: call.name, response: { suggestion: result } },
  });
  continue;
}
```

- [ ] **Step 6: Run all tests**

```bash
cd agent && npm test -- menu
```

Expected: PASS — 2 tests pass.

- [ ] **Step 7: Commit**

```bash
git add agent/src/tools/menu.ts agent/src/tools/menu.test.ts agent/src/agent/claude.ts agent/src/agent/gemini.ts
git commit -m "feat: suggest_menu (Claude Sonnet) + add_weekly_menu tool"
```

---

### Task 4: Embeddings utility + `search_knowledge` tool

**Files:**
- Create: `agent/src/utils/embeddings.ts`
- Create: `agent/src/utils/embeddings.test.ts`
- Create: `agent/src/tools/knowledge.ts`
- Create: `agent/src/tools/knowledge.test.ts`

**Architecture:** Al guardar una nota o receta, se genera un embedding con Gemini `text-embedding-004` (768 dimensiones) y se guarda en `knowledge_entries`. La búsqueda calcula similitud coseno contra los embeddings almacenados.

- [ ] **Step 1: Implement embeddings.ts**

```typescript
// agent/src/utils/embeddings.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateEmbedding(text: string): Promise<number[]> {
  const model  = genai.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}
```

- [ ] **Step 2: Write embeddings test**

```typescript
// agent/src/utils/embeddings.test.ts
import { describe, it, expect, vi } from 'vitest';

// Unit test: verify the function calls the API and returns a number array
// Integration test (manual): requires GEMINI_API_KEY

describe('generateEmbedding', () => {
  it('returns a 768-dimension vector shape', async () => {
    // Mock the GoogleGenerativeAI module
    vi.mock('@google/generative-ai', () => ({
      GoogleGenerativeAI: vi.fn(() => ({
        getGenerativeModel: vi.fn(() => ({
          embedContent: vi.fn().mockResolvedValue({
            embedding: { values: new Array(768).fill(0.1) },
          }),
        })),
      })),
    }));

    const { generateEmbedding } = await import('./embeddings.js');
    const result = await generateEmbedding('test text');
    expect(result).toHaveLength(768);
    expect(typeof result[0]).toBe('number');
  });
});
```

- [ ] **Step 3: Implement knowledge.ts**

```typescript
// agent/src/tools/knowledge.ts
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateEmbedding } from '../utils/embeddings.js';
import { maskContent } from '../utils/masking.js';

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
  query:          z.string().min(1),
  match_threshold: z.number().min(0).max(1).optional().default(0.7),
  limit:          z.number().int().min(1).max(5).optional().default(3),
});

export type SearchKnowledgeInput = z.input<typeof searchKnowledgeSchema>;

export async function searchKnowledge(
  input: SearchKnowledgeInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<
  | { success: true;  results: { title: string; content_masked: string; similarity: number }[] }
  | { success: false; error: string }
> {
  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(input.query);
  } catch (e) {
    return { success: false, error: 'No se pudo generar el embedding de búsqueda.' };
  }

  // Use Supabase pgvector match function
  const { data, error } = await (supabase.rpc as Function)('match_knowledge_entries', {
    query_embedding:  queryEmbedding,
    match_threshold:  input.match_threshold ?? 0.7,
    match_count:      input.limit ?? 3,
    p_family_id:      familyId,
  });

  if (error) return { success: false, error: error.message };

  const results = (data ?? []).map((r: Record<string, unknown>) => ({
    title:          r.title as string,
    content_masked: r.content_masked as string,
    similarity:     r.similarity as number,
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
```

- [ ] **Step 4: Create pgvector match function in Supabase**

Create migration: `supabase/migrations/002_match_knowledge_fn.sql`

```sql
-- supabase/migrations/002_match_knowledge_fn.sql
CREATE OR REPLACE FUNCTION match_knowledge_entries(
  query_embedding vector(768),
  match_threshold float,
  match_count     int,
  p_family_id     uuid
)
RETURNS TABLE (
  id             uuid,
  title          text,
  content_masked text,
  similarity     float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ke.id,
    ke.title,
    ke.content_masked,
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM knowledge_entries ke
  WHERE
    ke.family_id = p_family_id
    AND ke.embedding IS NOT NULL
    AND 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

Apply:

```bash
supabase db reset
supabase gen types typescript --local > shared/types/database.ts
```

- [ ] **Step 5: Write knowledge tests**

```typescript
// agent/src/tools/knowledge.test.ts
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
```

- [ ] **Step 6: Run tests**

```bash
cd agent && npm test -- knowledge embeddings
```

Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add agent/src/utils/embeddings.ts agent/src/utils/embeddings.test.ts \
        agent/src/tools/knowledge.ts agent/src/tools/knowledge.test.ts \
        supabase/migrations/002_match_knowledge_fn.sql
git commit -m "feat: embeddings + save_knowledge + search_knowledge tools"
```

---

### Task 5: Actualizar registry con nuevas tools

**Files:**
- Update: `agent/src/tools/index.ts`

- [ ] **Step 1: Añadir al registry**

```typescript
import { createNote, createNoteDeclaration, createNoteSchema } from './notes.js';
import { queryNotes, queryNotesDeclaration, queryNotesSchema } from './notes.js';
import { addRecipe, addRecipeDeclaration, addRecipeSchema } from './recipes.js';
import { suggestMenuDeclaration, suggestMenuSchema } from './menu.js';
import { addWeeklyMenu, addWeeklyMenuDeclaration, addWeeklyMenuSchema } from './menu.js';
import { saveKnowledge, saveKnowledgeDeclaration, saveKnowledgeSchema } from './knowledge.js';
import { searchKnowledge, searchKnowledgeDeclaration, searchKnowledgeSchema } from './knowledge.js';

// En el array tools, añadir:
{
  name: 'create_note', description: 'Guarda una nota en la bitácora',
  schema: createNoteSchema,
  handler: (input, ctx) => createNote(input, ctx.supabase, ctx.familyId),
  declaration: createNoteDeclaration, useClaudeInstead: false,
},
{
  name: 'query_notes', description: 'Busca notas en la bitácora',
  schema: queryNotesSchema,
  handler: (input, ctx) => queryNotes(input, ctx.supabase, ctx.familyId),
  declaration: queryNotesDeclaration, useClaudeInstead: false,
},
{
  name: 'add_recipe', description: 'Guarda una receta',
  schema: addRecipeSchema,
  handler: (input, ctx) => addRecipe(input, ctx.supabase, ctx.familyId),
  declaration: addRecipeDeclaration, useClaudeInstead: false,
},
{
  name: 'suggest_menu', description: 'Sugiere menú semanal personalizado',
  schema: suggestMenuSchema,
  handler: async (_input, _ctx) => ({ suggestion: 'Handled by Claude' }),
  declaration: suggestMenuDeclaration, useClaudeInstead: true,
},
{
  name: 'add_weekly_menu', description: 'Guarda el menú semanal',
  schema: addWeeklyMenuSchema,
  handler: (input, ctx) => addWeeklyMenu(input, ctx.supabase, ctx.familyId),
  declaration: addWeeklyMenuDeclaration, useClaudeInstead: false,
},
{
  name: 'save_knowledge', description: 'Guarda en la base de conocimiento',
  schema: saveKnowledgeSchema,
  handler: (input, ctx) => saveKnowledge(input, ctx.supabase, ctx.familyId),
  declaration: saveKnowledgeDeclaration, useClaudeInstead: false,
},
{
  name: 'search_knowledge', description: 'Búsqueda semántica en conocimiento',
  schema: searchKnowledgeSchema,
  handler: (input, ctx) => searchKnowledge(input, ctx.supabase, ctx.familyId),
  declaration: searchKnowledgeDeclaration, useClaudeInstead: false,
},
```

- [ ] **Step 2: Run typecheck + all tests**

```bash
cd agent && npm run typecheck && npm test
```

- [ ] **Step 3: Commit**

```bash
git add agent/src/tools/index.ts
git commit -m "feat: registry Phase 2 — 14 tools totales"
```

---

### Task 6: Smoke test Phase 2

- [ ] **Step 1: Aplicar migración embeddings**

```bash
supabase db reset
supabase gen types typescript --local > shared/types/database.ts
```

- [ ] **Step 2: Reiniciar agent**

```bash
cd agent && npm run dev
```

- [ ] **Step 3: Tests manuales (Telegram)**

| Mensaje | Tool | Verificación |
|---|---|---|
| "Anota: la llave del gas está en el cajón de la cocina" | create_note | nota en BD |
| "Qué notas tengo sobre la cocina" | query_notes | nota encontrada |
| "Guarda la receta de tortilla: huevos, patatas, aceite. Batir y cuajar." | add_recipe | receta en BD |
| "Sugiere un menú para esta semana" | suggest_menu → Claude | menú multi-dieta generado |
| "Guarda en el conocimiento: el número de la comunidad es 91-123-4567" | save_knowledge | entrada con embedding en BD |
| "Qué sabes sobre la comunidad" | search_knowledge | resultado semántico devuelto |

- [ ] **Step 4: Run all tests**

```bash
cd agent && npm test
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Phase 2 agent complete — notas + recetas + menú IA + embeddings"
```
