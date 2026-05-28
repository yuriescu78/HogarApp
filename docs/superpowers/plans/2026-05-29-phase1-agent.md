# Phase 1 – Agent: Lista de la compra completa + Agenda + Voz

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar el CRUD de lista de la compra, añadir herramientas de calendario/recordatorios, activar voz (Whisper STT) y registrar a Elena.

**Prerequisite:** Phase 0 agent completo y funcionando. Supabase local corriendo.

**Nuevas tools:** `query_shopping`, `check_shopping_item`, `clear_checked_items`, `add_calendar_event`, `query_calendar`, `add_reminder`

---

### Task 1: `query_shopping` tool (TDD)

**Files:**
- Create: `agent/src/tools/query-shopping.ts`
- Create: `agent/src/tools/query-shopping.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// agent/src/tools/query-shopping.test.ts
import { describe, it, expect, vi } from 'vitest';
import { queryShoppingItems } from './query-shopping.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';

function makeMock(rows: unknown[]): SupabaseClient {
  const chain = {
    eq:    vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  return { from: vi.fn(() => ({ select: vi.fn(() => chain) })) } as unknown as SupabaseClient;
}

describe('queryShoppingItems', () => {
  it('returns pending items', async () => {
    const mock = makeMock([{ id: '1', name: 'leche', quantity: null, checked: false }]);
    const result = await queryShoppingItems({ include_checked: false }, mock, FAMILY_ID);
    expect(result.success).toBe(true);
    if (result.success) expect(result.items).toHaveLength(1);
  });

  it('returns empty list when nothing pending', async () => {
    const mock = makeMock([]);
    const result = await queryShoppingItems({ include_checked: false }, mock, FAMILY_ID);
    expect(result.success).toBe(true);
    if (result.success) expect(result.items).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd agent && npm test -- query-shopping
```

Expected: FAIL — `Cannot find module './query-shopping.js'`

- [ ] **Step 3: Implement query-shopping.ts**

```typescript
// agent/src/tools/query-shopping.ts
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const queryShoppingItemsSchema = z.object({
  include_checked: z.boolean().optional().default(false),
  list_name:       z.string().optional().default('Lista principal'),
});

export type QueryShoppingItemsInput = z.infer<typeof queryShoppingItemsSchema>;

type QueryResult =
  | { success: true;  items: { id: string; name: string; quantity: string | null; checked: boolean }[] }
  | { success: false; error: string };

export async function queryShoppingItems(
  input: QueryShoppingItemsInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<QueryResult> {
  let query = supabase
    .from('shopping_items')
    .select('id, name, quantity, checked')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })
    .limit(30);

  if (!input.include_checked) {
    query = query.eq('checked', false);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, items: data ?? [] };
}

export const queryShoppingItemsDeclaration = {
  name:        'query_shopping',
  description: 'Consulta los artículos de la lista de la compra.',
  parameters: {
    type: 'OBJECT',
    properties: {
      include_checked: {
        type:        'BOOLEAN',
        description: 'Si true, incluye los artículos ya marcados como comprados. Por defecto false.',
      },
    },
    required: [],
  },
};
```

- [ ] **Step 4: Run test to confirm pass**

```bash
cd agent && npm test -- query-shopping
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add agent/src/tools/query-shopping.ts agent/src/tools/query-shopping.test.ts
git commit -m "feat: query_shopping tool"
```

---

### Task 2: `check_shopping_item` tool (TDD)

**Files:**
- Create: `agent/src/tools/check-shopping.ts`
- Create: `agent/src/tools/check-shopping.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// agent/src/tools/check-shopping.test.ts
import { describe, it, expect, vi } from 'vitest';
import { checkShoppingItem } from './check-shopping.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';

function makeMock(found: boolean, updateError: string | null = null): SupabaseClient {
  const updateChain = {
    eq:    vi.fn().mockReturnThis(),
    ilike: vi.fn().mockResolvedValue({ error: updateError ? { message: updateError } : null, count: found ? 1 : 0 }),
  };
  const selectChain = {
    eq:    vi.fn().mockReturnThis(),
    ilike: vi.fn().mockResolvedValue({
      data: found ? [{ id: '1' }] : [],
      error: null,
    }),
  };
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => selectChain),
      update: vi.fn(() => updateChain),
    })),
  } as unknown as SupabaseClient;
}

describe('checkShoppingItem', () => {
  it('marks item as checked', async () => {
    const mock = makeMock(true);
    const result = await checkShoppingItem({ item_name: 'leche', checked: true }, mock, FAMILY_ID);
    expect(result.success).toBe(true);
  });

  it('returns error when item not found', async () => {
    const mock = makeMock(false);
    const result = await checkShoppingItem({ item_name: 'xyz', checked: true }, mock, FAMILY_ID);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd agent && npm test -- check-shopping
```

- [ ] **Step 3: Implement check-shopping.ts**

```typescript
// agent/src/tools/check-shopping.ts
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const checkShoppingItemSchema = z.object({
  item_name: z.string().min(1),
  checked:   z.boolean().optional().default(true),
});

export type CheckShoppingItemInput = z.infer<typeof checkShoppingItemSchema>;

export async function checkShoppingItem(
  input: CheckShoppingItemInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  // Find item by name (case-insensitive)
  const { data: found } = await supabase
    .from('shopping_items')
    .select('id')
    .eq('family_id', familyId)
    .ilike('name', input.item_name)
    .eq('checked', !input.checked)
    .limit(1);

  if (!found?.length) {
    return { success: false, error: `No encontré "${input.item_name}" en la lista.` };
  }

  const { error } = await supabase
    .from('shopping_items')
    .update({ checked: input.checked })
    .eq('id', found[0].id);

  if (error) return { success: false, error: error.message };

  const action = input.checked ? 'marcado como comprado' : 'desmarcado';
  return { success: true, message: `"${input.item_name}" ${action}.` };
}

export const checkShoppingItemDeclaration = {
  name:        'check_shopping_item',
  description: 'Marca o desmarca un artículo de la lista de la compra como comprado.',
  parameters: {
    type: 'OBJECT',
    properties: {
      item_name: { type: 'STRING', description: 'Nombre del artículo a marcar.' },
      checked:   { type: 'BOOLEAN', description: 'true para marcar comprado, false para desmarcar. Por defecto true.' },
    },
    required: ['item_name'],
  },
};
```

- [ ] **Step 4: Run test to confirm pass**

```bash
cd agent && npm test -- check-shopping
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add agent/src/tools/check-shopping.ts agent/src/tools/check-shopping.test.ts
git commit -m "feat: check_shopping_item tool"
```

---

### Task 3: `clear_checked_items` tool (TDD)

**Files:**
- Create: `agent/src/tools/clear-checked.ts`
- Create: `agent/src/tools/clear-checked.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// agent/src/tools/clear-checked.test.ts
import { describe, it, expect, vi } from 'vitest';
import { clearCheckedItems } from './clear-checked.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';

function makeMock(count: number): SupabaseClient {
  const chain = { eq: vi.fn().mockReturnThis() };
  const deleteChain = { ...chain, eq: vi.fn().mockResolvedValue({ error: null, count }) };
  return { from: vi.fn(() => ({ delete: vi.fn(() => deleteChain) })) } as unknown as SupabaseClient;
}

describe('clearCheckedItems', () => {
  it('deletes checked items and returns count', async () => {
    const mock = makeMock(3);
    const result = await clearCheckedItems({}, mock, FAMILY_ID);
    expect(result.success).toBe(true);
    if (result.success) expect(result.cleared).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd agent && npm test -- clear-checked
```

- [ ] **Step 3: Implement clear-checked.ts**

```typescript
// agent/src/tools/clear-checked.ts
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const clearCheckedItemsSchema = z.object({});

export type ClearCheckedItemsInput = z.infer<typeof clearCheckedItemsSchema>;

export async function clearCheckedItems(
  _input: ClearCheckedItemsInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; cleared: number } | { success: false; error: string }> {
  const { error, count } = await supabase
    .from('shopping_items')
    .delete()
    .eq('family_id', familyId)
    .eq('checked', true);

  if (error) return { success: false, error: error.message };
  return { success: true, cleared: count ?? 0 };
}

export const clearCheckedItemsDeclaration = {
  name:        'clear_checked_items',
  description: 'Elimina de la lista todos los artículos ya marcados como comprados.',
  parameters:  { type: 'OBJECT', properties: {}, required: [] },
};
```

- [ ] **Step 4: Run test to confirm pass**

```bash
cd agent && npm test -- clear-checked
```

Expected: PASS — 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add agent/src/tools/clear-checked.ts agent/src/tools/clear-checked.test.ts
git commit -m "feat: clear_checked_items tool"
```

---

### Task 4: `add_calendar_event` tool (TDD)

**Files:**
- Create: `agent/src/tools/calendar.ts`
- Create: `agent/src/tools/calendar.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// agent/src/tools/calendar.test.ts
import { describe, it, expect, vi } from 'vitest';
import { addCalendarEvent } from './calendar.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';

function makeMock(error: string | null = null): SupabaseClient {
  return {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: error ? { message: error } : null }),
    })),
  } as unknown as SupabaseClient;
}

describe('addCalendarEvent', () => {
  it('inserts event and returns success', async () => {
    const mock = makeMock();
    const result = await addCalendarEvent(
      { title: 'Examen Sofía', start_time: '2026-06-21T10:00:00' },
      mock,
      FAMILY_ID
    );
    expect(result.success).toBe(true);
  });

  it('returns error on DB failure', async () => {
    const mock = makeMock('DB error');
    const result = await addCalendarEvent(
      { title: 'Test', start_time: '2026-06-21T10:00:00' },
      mock,
      FAMILY_ID
    );
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd agent && npm test -- calendar
```

- [ ] **Step 3: Implement calendar.ts**

```typescript
// agent/src/tools/calendar.ts
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const addCalendarEventSchema = z.object({
  title:       z.string().min(1),
  start_time:  z.string(),    // ISO 8601: "2026-06-21T10:00:00"
  end_time:    z.string().optional(),
  all_day:     z.boolean().optional().default(false),
  description: z.string().optional(),
});

export type AddCalendarEventInput = z.infer<typeof addCalendarEventSchema>;

export async function addCalendarEvent(
  input: AddCalendarEventInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const { error } = await supabase.from('calendar_events').insert({
    family_id:   familyId,
    title:       input.title,
    start_time:  input.start_time,
    end_time:    input.end_time ?? null,
    all_day:     input.all_day,
    description: input.description ?? null,
  });

  if (error) return { success: false, error: error.message };

  const date = new Date(input.start_time).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: process.env.TIMEZONE ?? 'Europe/Madrid',
  });
  return { success: true, message: `Evento "${input.title}" registrado para el ${date}.` };
}

export const addCalendarEventDeclaration = {
  name:        'add_calendar_event',
  description: 'Añade un evento al calendario familiar.',
  parameters: {
    type: 'OBJECT',
    properties: {
      title:       { type: 'STRING', description: 'Título del evento.' },
      start_time:  { type: 'STRING', description: 'Fecha y hora de inicio en formato ISO 8601. Ejemplo: "2026-06-21T10:00:00".' },
      end_time:    { type: 'STRING', description: 'Fecha y hora de fin (opcional).' },
      all_day:     { type: 'BOOLEAN', description: 'true si es un evento de todo el día.' },
      description: { type: 'STRING', description: 'Descripción o notas adicionales (opcional).' },
    },
    required: ['title', 'start_time'],
  },
};
```

- [ ] **Step 4: Run test to confirm pass**

```bash
cd agent && npm test -- calendar
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add agent/src/tools/calendar.ts agent/src/tools/calendar.test.ts
git commit -m "feat: add_calendar_event tool"
```

---

### Task 5: `query_calendar` tool

**Files:**
- Update: `agent/src/tools/calendar.ts`
- Update: `agent/src/tools/calendar.test.ts`

- [ ] **Step 1: Add query test to calendar.test.ts**

```typescript
import { addCalendarEvent, queryCalendar } from './calendar.js';

describe('queryCalendar', () => {
  it('returns events for today range', async () => {
    const chain = {
      eq:    vi.fn().mockReturnThis(),
      gte:   vi.fn().mockReturnThis(),
      lte:   vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ id: '1', title: 'Reunión', start_time: '2026-05-29T10:00:00', end_time: null, all_day: false }],
        error: null,
      }),
    };
    const mock = {
      from: vi.fn(() => ({ select: vi.fn(() => chain) })),
    } as unknown as SupabaseClient;

    const result = await queryCalendar({ range: 'today' }, mock, FAMILY_ID);
    expect(result.success).toBe(true);
    if (result.success) expect(result.events.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Add queryCalendar to calendar.ts**

```typescript
export const queryCalendarSchema = z.object({
  range: z.enum(['today', 'week', 'month']).optional().default('week'),
});

export type QueryCalendarInput = z.infer<typeof queryCalendarSchema>;

export async function queryCalendar(
  input: QueryCalendarInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<
  | { success: true; events: { id: string; title: string; start_time: string; end_time: string | null; all_day: boolean }[] }
  | { success: false; error: string }
> {
  const tz = process.env.TIMEZONE ?? 'Europe/Madrid';
  const now  = new Date().toISOString();
  const days = input.range === 'today' ? 1 : input.range === 'week' ? 7 : 30;
  const end  = new Date(Date.now() + days * 86400_000).toISOString();

  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, end_time, all_day')
    .eq('family_id', familyId)
    .gte('start_time', now)
    .lte('start_time', end)
    .order('start_time', { ascending: true })
    .limit(10);

  if (error) return { success: false, error: error.message };
  return { success: true, events: data ?? [] };
}

export const queryCalendarDeclaration = {
  name:        'query_calendar',
  description: 'Consulta los próximos eventos del calendario familiar.',
  parameters: {
    type: 'OBJECT',
    properties: {
      range: {
        type:        'STRING',
        description: 'Rango de consulta: "today" (hoy), "week" (7 días), "month" (30 días). Por defecto "week".',
      },
    },
    required: [],
  },
};
```

- [ ] **Step 3: Run all calendar tests**

```bash
cd agent && npm test -- calendar
```

Expected: PASS — 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add agent/src/tools/calendar.ts agent/src/tools/calendar.test.ts
git commit -m "feat: query_calendar tool"
```

---

### Task 6: `add_reminder` tool (TDD)

**Files:**
- Create: `agent/src/tools/reminder.ts`
- Create: `agent/src/tools/reminder.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// agent/src/tools/reminder.test.ts
import { describe, it, expect, vi } from 'vitest';
import { addReminder } from './reminder.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';

function makeMock(error: string | null = null): SupabaseClient {
  return {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: error ? { message: error } : null }),
    })),
  } as unknown as SupabaseClient;
}

describe('addReminder', () => {
  it('creates standalone reminder', async () => {
    const mock = makeMock();
    const result = await addReminder(
      { title: 'Pedir cita peluquería', remind_at: '2026-06-01T09:00:00' },
      mock,
      FAMILY_ID
    );
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd agent && npm test -- reminder
```

- [ ] **Step 3: Implement reminder.ts**

```typescript
// agent/src/tools/reminder.ts
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const addReminderSchema = z.object({
  title:     z.string().min(1),
  remind_at: z.string(),  // ISO 8601
  event_id:  z.string().uuid().optional(),
});

export type AddReminderInput = z.infer<typeof addReminderSchema>;

export async function addReminder(
  input: AddReminderInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  // If no event_id, create a synthetic calendar event first
  let eventId = input.event_id;

  if (!eventId) {
    const { data: event, error: evErr } = await supabase
      .from('calendar_events')
      .insert({
        family_id:  familyId,
        title:      input.title,
        start_time: input.remind_at,
      })
      .select('id')
      .single();

    if (evErr || !event) return { success: false, error: evErr?.message ?? 'Error creando evento' };
    eventId = event.id;
  }

  const { error } = await supabase.from('event_reminders').insert({
    family_id: familyId,
    event_id:  eventId,
    remind_at: input.remind_at,
  });

  if (error) return { success: false, error: error.message };

  const date = new Date(input.remind_at).toLocaleString('es-ES', {
    timeZone: process.env.TIMEZONE ?? 'Europe/Madrid',
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
  return { success: true, message: `Recordatorio "${input.title}" fijado para el ${date}.` };
}

export const addReminderDeclaration = {
  name:        'add_reminder',
  description: 'Añade un recordatorio al calendario familiar. Puede ir vinculado a un evento existente o ser independiente.',
  parameters: {
    type: 'OBJECT',
    properties: {
      title:     { type: 'STRING', description: 'Texto del recordatorio.' },
      remind_at: { type: 'STRING', description: 'Fecha y hora del recordatorio en ISO 8601.' },
      event_id:  { type: 'STRING', description: 'UUID del evento al que vincular el recordatorio (opcional).' },
    },
    required: ['title', 'remind_at'],
  },
};
```

- [ ] **Step 4: Run test to confirm pass**

```bash
cd agent && npm test -- reminder
```

Expected: PASS — 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add agent/src/tools/reminder.ts agent/src/tools/reminder.test.ts
git commit -m "feat: add_reminder tool"
```

---

### Task 7: Registrar tool registry con las 6 nuevas tools

**Files:**
- Update: `agent/src/tools/index.ts`

- [ ] **Step 1: Añadir todas las nuevas tools al registry**

```typescript
// agent/src/tools/index.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ZodTypeAny, z } from 'zod';
import { addShoppingItems, addShoppingItemsDeclaration, addShoppingItemsSchema } from './shopping.js';
import { queryShoppingItems, queryShoppingItemsDeclaration, queryShoppingItemsSchema } from './query-shopping.js';
import { checkShoppingItem, checkShoppingItemDeclaration, checkShoppingItemSchema } from './check-shopping.js';
import { clearCheckedItems, clearCheckedItemsDeclaration, clearCheckedItemsSchema } from './clear-checked.js';
import { addCalendarEvent, addCalendarEventDeclaration, addCalendarEventSchema } from './calendar.js';
import { queryCalendar, queryCalendarDeclaration, queryCalendarSchema } from './calendar.js';
import { addReminder, addReminderDeclaration, addReminderSchema } from './reminder.js';

export interface ToolContext {
  supabase:  SupabaseClient;
  familyId:  string;
  memberId?: string;
}

export interface ToolDefinition<S extends ZodTypeAny = ZodTypeAny> {
  name:             string;
  description:      string;
  schema:           S;
  handler:          (input: z.infer<S>, ctx: ToolContext) => Promise<unknown>;
  declaration:      Record<string, unknown>;
  useClaudeInstead: boolean;
}

export const tools: ToolDefinition[] = [
  {
    name: 'add_shopping_items', description: 'Añade artículos a la lista de la compra',
    schema: addShoppingItemsSchema,
    handler: (input, ctx) => addShoppingItems(input, ctx.supabase, ctx.familyId),
    declaration: addShoppingItemsDeclaration, useClaudeInstead: false,
  },
  {
    name: 'query_shopping', description: 'Consulta la lista de la compra',
    schema: queryShoppingItemsSchema,
    handler: (input, ctx) => queryShoppingItems(input, ctx.supabase, ctx.familyId),
    declaration: queryShoppingItemsDeclaration, useClaudeInstead: false,
  },
  {
    name: 'check_shopping_item', description: 'Marca artículo como comprado',
    schema: checkShoppingItemSchema,
    handler: (input, ctx) => checkShoppingItem(input, ctx.supabase, ctx.familyId),
    declaration: checkShoppingItemDeclaration, useClaudeInstead: false,
  },
  {
    name: 'clear_checked_items', description: 'Limpia artículos comprados de la lista',
    schema: clearCheckedItemsSchema,
    handler: (input, ctx) => clearCheckedItems(input, ctx.supabase, ctx.familyId),
    declaration: clearCheckedItemsDeclaration, useClaudeInstead: false,
  },
  {
    name: 'add_calendar_event', description: 'Añade evento al calendario',
    schema: addCalendarEventSchema,
    handler: (input, ctx) => addCalendarEvent(input, ctx.supabase, ctx.familyId),
    declaration: addCalendarEventDeclaration, useClaudeInstead: false,
  },
  {
    name: 'query_calendar', description: 'Consulta próximos eventos del calendario',
    schema: queryCalendarSchema,
    handler: (input, ctx) => queryCalendar(input, ctx.supabase, ctx.familyId),
    declaration: queryCalendarDeclaration, useClaudeInstead: false,
  },
  {
    name: 'add_reminder', description: 'Añade un recordatorio',
    schema: addReminderSchema,
    handler: (input, ctx) => addReminder(input, ctx.supabase, ctx.familyId),
    declaration: addReminderDeclaration, useClaudeInstead: false,
  },
];

export function findTool(name: string): ToolDefinition | undefined {
  return tools.find(t => t.name === name);
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd agent && npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Run all tests**

```bash
cd agent && npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add agent/src/tools/index.ts
git commit -m "feat: register 6 new tools in registry"
```

---

### Task 8: Activar voz (Whisper STT)

**Files:**
- Update: `agent/src/agent/loop.ts`

- [ ] **Step 1: Añadir rama voice a loop.ts**

Reemplazar el bloque de solo-texto por:

```typescript
import OpenAI from 'openai';
import { toFile } from 'openai';

const openai = new OpenAI();

// Dentro de createBot(), en bot.on('message', ...):

    let text: string | undefined;
    let inputType: 'text' | 'voice' = 'text';

    if (ctx.message?.text) {
      text = ctx.message.text;
    } else if (ctx.message?.voice) {
      inputType = 'voice';
      try {
        const file    = await ctx.getFile();
        const apiUrl  = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        const res     = await fetch(apiUrl);
        const buffer  = Buffer.from(await res.arrayBuffer());
        const oggFile = await toFile(buffer, 'voice.ogg', { type: 'audio/ogg' });
        const transcription = await openai.audio.transcriptions.create({
          file:  oggFile,
          model: 'whisper-1',
          language: 'es',
        });
        text = transcription.text;
      } catch (err) {
        await ctx.reply('Disculpe, no pude transcribir el audio. Por favor escríbame.');
        return;
      }
    }

    if (!text) return;
```

Requisito: `OPENAI_API_KEY` debe estar en `agent/.env`.

- [ ] **Step 2: Run typecheck**

```bash
cd agent && npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add agent/src/agent/loop.ts
git commit -m "feat: voice STT con Whisper — Phase 1"
```

---

### Task 9: Registrar telegram_id de Elena

- [ ] **Step 1: Elena envía /start a @HogarApp_papabot**

El bot responderá "Disculpe, no le reconozco" (sin DEBUG — está en producción).
Pedir a Elena que envíe cualquier mensaje y anotar el ID del log de la BD:

```sql
SELECT raw_input, created_at FROM voice_logs ORDER BY created_at DESC LIMIT 5;
```

Alternativamente, usar @myidbot o @JsonDumpBot como en el setup de Carlos.

- [ ] **Step 2: Actualizar family_members**

```sql
UPDATE family_members
SET telegram_id = <ID_ELENA>
WHERE name = 'Elena' AND family_id = '00000000-0000-0000-0000-000000000001';
```

- [ ] **Step 3: Verificar**

```bash
supabase db query "SELECT name, telegram_id, active FROM family_members ORDER BY name;"
```

Expected: Carlos y Elena con telegram_id real, Sofía con NULL.

---

### Task 10: Actualizar fallback-parser con nuevos intents

**Files:**
- Update: `agent/src/agent/fallback-parser.ts`
- Update: `agent/src/agent/fallback-parser.test.ts`

- [ ] **Step 1: Añadir casos al test**

```typescript
it('detects query_shopping intent', () => {
  expect(parseFallback('qué hay en la lista')).toMatchObject({ tool: 'query_shopping' });
});
it('detects check_shopping intent', () => {
  expect(parseFallback('tacha la leche')).toMatchObject({ tool: 'check_shopping_item' });
});
```

- [ ] **Step 2: Ampliar fallback-parser.ts**

```typescript
const QUERY_RE  = /\b(qu[eé] hay|mu[eé]strame|lista de la compra|ver la lista)\b/i;
const CHECK_RE  = /\b(tacha?|marca|he comprado)\s+(.+)/i;

export function parseFallback(text: string): FallbackResult {
  if (ADD_RE.test(text)) { /* existing */ }
  if (QUERY_RE.test(text)) return { tool: 'query_shopping' };
  const cm = CHECK_RE.exec(text);
  if (cm) return { tool: 'check_shopping_item', item_name: cm[2].trim() };
  return null;
}
```

- [ ] **Step 3: Run all tests**

```bash
cd agent && npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add agent/src/agent/fallback-parser.ts agent/src/agent/fallback-parser.test.ts
git commit -m "feat: fallback-parser con query_shopping y check_shopping_item"
```

---

### Task 11: Smoke test Phase 1

- [ ] **Step 1: Reiniciar agent**

```bash
cd agent && npm run dev
```

- [ ] **Step 2: Tests de integración manual (Telegram)**

Enviar en orden y verificar respuesta + BD:

| Mensaje | Tool esperado | Verificación |
|---|---|---|
| "Añade tomate, aceite y sal" | add_shopping_items | 3 nuevos items en BD |
| "Qué tengo en la lista" | query_shopping | JARVIS lista los items |
| "Tacha el tomate" | check_shopping_item | tomate.checked = true |
| "Limpia la lista" | clear_checked_items | tomate eliminado |
| "Añade al calendario examen de Sofía el 21 de junio a las 10" | add_calendar_event | evento en BD |
| "Qué tengo esta semana" | query_calendar | JARVIS lista el evento |
| "Recuérdame pedir cita al veterinario el 2 de junio a las 9" | add_reminder | event_reminder en BD |
| [mensaje de voz] "Añade zumo a la lista" | add_shopping_items (vía Whisper) | zumo en shopping_items |

- [ ] **Step 3: Run all tests**

```bash
cd agent && npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat: Phase 1 agent complete — shopping CRUD + calendar + reminders + voice"
```
