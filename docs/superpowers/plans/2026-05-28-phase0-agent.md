# Phase 0 – Agent Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a Grammy Telegram bot to Gemini 2.5 Flash with a single working tool (`add_shopping_items`) that inserts items into Supabase end-to-end.

**Architecture:** Long-running Node.js process. Grammy receives messages → Gemini loop handles tool calling → tool handlers write to Supabase → Gemini composes Spanish reply → Grammy sends it back. Tool registry maps Zod schemas to Gemini FunctionDeclarations. Emergency regex fallback handles `add_shopping` when Gemini is unavailable. All commands are logged to `voice_logs`.

**Tech Stack:** Node.js 20, TypeScript 5, Grammy, `@google/generative-ai`, `@anthropic-ai/sdk`, `@supabase/supabase-js`, Zod, OpenAI (Whisper), node-cron, tsx (dev), Vitest

**Prerequisite:** Phase 0 Supabase plan complete — local Supabase running with seed data.

---

### Task 1: Initialize project

**Files:**
- Create: `agent/package.json`
- Create: `agent/tsconfig.json`
- Create: `agent/vitest.config.ts`
- Create: `agent/.env` (not committed — copy from `.env.example`)
- Create: `agent/.env.example`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "jarvis-agent",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.52.0",
    "@google/generative-ai": "^0.24.0",
    "@supabase/supabase-js": "^2.49.0",
    "dotenv": "^16.4.7",
    "grammy": "^1.34.0",
    "node-cron": "^3.0.3",
    "openai": "^4.96.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/node-cron": "^3.0.11",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3",
    "vitest": "^3.1.4"
  }
}
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Write vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 4: Write .env.example**

```
TELEGRAM_BOT_TOKEN=
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_TTS_CREDENTIALS=
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=
FAMILY_ID=00000000-0000-0000-0000-000000000001
TIMEZONE=Europe/Madrid
```

- [ ] **Step 5: Copy .env.example to .env and fill in real values**

```bash
cp agent/.env.example agent/.env
```

Fill in: `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`.

- [ ] **Step 6: Install dependencies**

```bash
cd agent && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 7: Commit**

```bash
git add agent/package.json agent/tsconfig.json agent/vitest.config.ts agent/.env.example
git commit -m "chore: init agent project scaffold"
```

---

### Task 2: Supabase client + masking utility

**Files:**
- Create: `agent/src/utils/supabase.ts`
- Create: `agent/src/utils/masking.ts`
- Create: `agent/src/utils/masking.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// agent/src/utils/masking.test.ts
import { describe, it, expect } from 'vitest';
import { maskContent, containsSensitiveData } from './masking.js';

describe('maskContent', () => {
  it('masks Spanish DNI (8 digits + letter)', () => {
    const result = maskContent('Mi DNI es 12345678A');
    expect(result).toBe('Mi DNI es ****5678A');
  });

  it('masks IBAN', () => {
    const result = maskContent('IBAN: ES91 2100 0418 4502 0005 1332');
    expect(result).toBe('IBAN: ES91 **** **** **** **** 1332');
  });

  it('leaves text without sensitive data unchanged', () => {
    const result = maskContent('Comprar leche');
    expect(result).toBe('Comprar leche');
  });
});

describe('containsSensitiveData', () => {
  it('detects DNI', () => {
    expect(containsSensitiveData('Mi DNI es 12345678A')).toBe(true);
  });

  it('detects IBAN', () => {
    expect(containsSensitiveData('IBAN: ES91 2100 0418 4502 0005 1332')).toBe(true);
  });

  it('returns false for normal text', () => {
    expect(containsSensitiveData('Añade leche a la lista')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd agent && npm test -- masking
```

Expected: FAIL — `Cannot find module './masking.js'`

- [ ] **Step 3: Implement masking.ts**

```typescript
// agent/src/utils/masking.ts

// Masks digits 1-4 of Spanish DNI (format: 8 digits + letter)
const DNI_RE = /\b(\d{4})(\d{4}[A-Z])\b/g;
// Masks middle groups of IBAN, leaving country code and last 4 chars
const IBAN_RE = /\b([A-Z]{2}\d{2})([\s\d]{10,30})(\d{4})\b/g;

export function maskContent(text: string): string {
  return text
    .replace(DNI_RE, '****$2')
    .replace(IBAN_RE, (_, prefix, middle, last) => `${prefix} ${middle.replace(/\d/g, '*').replace(/\s+/g, ' ').trim()} ${last}`);
}

export function containsSensitiveData(text: string): boolean {
  return DNI_RE.test(text) || IBAN_RE.test(text);
}
```

- [ ] **Step 4: Run test to confirm pass**

```bash
cd agent && npm test -- masking
```

Expected: PASS — 3 tests pass.

- [ ] **Step 5: Write Supabase client singleton**

```typescript
// agent/src/utils/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../shared/types/database.js';

// Path relative to compiled output in dist/
// At runtime: process.cwd() is agent/
function getSharedTypesPath() {
  return process.env.SUPABASE_URL!;
}

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```

Wait — the `shared/types/database.ts` is outside `agent/src/`. The import path needs care. Use a relative path from the compiled file's perspective OR configure `paths` in tsconfig. Simpler: copy or symlink types, or import by relative path.

Since `agent/` and `shared/` are siblings, from `agent/src/utils/supabase.ts` the relative path is `../../../shared/types/database.ts`. This works for `tsx` (dev) but breaks for compiled `tsc` output unless `outDir` mirrors the structure.

Simplest fix: point tsconfig `rootDir` to the monorepo root and set `include` broadly.

Update `agent/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "..",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src", "../shared"],
  "exclude": ["node_modules", "dist"]
}
```

Now write the Supabase client with the corrected path:

```typescript
// agent/src/utils/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/types/database.js';

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```

- [ ] **Step 6: Run typecheck**

```bash
cd agent && npm run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add agent/src/utils/masking.ts agent/src/utils/masking.test.ts agent/src/utils/supabase.ts agent/tsconfig.json
git commit -m "feat: masking utility + Supabase client"
```

---

### Task 3: add_shopping_items tool (TDD)

**Files:**
- Create: `agent/src/tools/shopping.ts`
- Create: `agent/src/tools/shopping.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// agent/src/tools/shopping.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addShoppingItems } from './shopping.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const FAMILY_ID = '00000000-0000-0000-0000-000000000001';
const LIST_ID   = '00000000-0000-0000-0000-000000000002';

function makeMockSupabase(overrides: Record<string, unknown> = {}): SupabaseClient {
  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: LIST_ID }, error: null }),
  };
  const insertChain = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: LIST_ID }, error: null }),
    // for items insert (no .select chain)
    then: undefined as unknown,
  };

  const from = vi.fn((table: string) => {
    if (table === 'shopping_lists') {
      return {
        select: vi.fn().mockReturnValue(selectChain),
        insert: vi.fn().mockReturnValue(insertChain),
      };
    }
    if (table === 'shopping_items') {
      return {
        insert: vi.fn().mockResolvedValue({ error: null, ...overrides }),
      };
    }
    return {};
  });

  return { from } as unknown as SupabaseClient;
}

describe('addShoppingItems', () => {
  it('inserts items and returns success with count', async () => {
    const supabase = makeMockSupabase();
    const result = await addShoppingItems(
      { items: [{ name: 'Leche' }, { name: 'Pan', quantity: '2' }] },
      supabase,
      FAMILY_ID
    );
    expect(result).toEqual({ success: true, added: 2 });
  });

  it('returns error when Supabase insert fails', async () => {
    const supabase = makeMockSupabase({ error: { message: 'DB error' } });
    const result = await addShoppingItems(
      { items: [{ name: 'Leche' }] },
      supabase,
      FAMILY_ID
    );
    expect(result).toEqual({ success: false, error: 'DB error' });
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd agent && npm test -- shopping
```

Expected: FAIL — `Cannot find module './shopping.js'`

- [ ] **Step 3: Implement shopping.ts**

```typescript
// agent/src/tools/shopping.ts
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const addShoppingItemsSchema = z.object({
  items: z.array(
    z.object({
      name:     z.string().min(1),
      quantity: z.string().optional(),
    })
  ).min(1),
  list_name: z.string().optional().default('Lista principal'),
});

export type AddShoppingItemsInput = z.infer<typeof addShoppingItemsSchema>;

export async function addShoppingItems(
  input: AddShoppingItemsInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; added: number } | { success: false; error: string }> {
  // Get or create the shopping list
  let listId: string;

  const { data: existingList, error: findError } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('family_id', familyId)
    .eq('name', input.list_name)
    .single();

  if (existingList) {
    listId = existingList.id;
  } else {
    const { data: newList, error: createError } = await supabase
      .from('shopping_lists')
      .insert({ family_id: familyId, name: input.list_name })
      .select('id')
      .single();
    if (createError || !newList) {
      return { success: false, error: createError?.message ?? 'Could not create list' };
    }
    listId = newList.id;
  }

  const rows = input.items.map(item => ({
    family_id: familyId,
    list_id:   listId,
    name:      item.name,
    quantity:  item.quantity ?? null,
  }));

  const { error } = await supabase.from('shopping_items').insert(rows);
  if (error) return { success: false, error: error.message };

  return { success: true, added: input.items.length };
}

// Gemini FunctionDeclaration for this tool
export const addShoppingItemsDeclaration = {
  name:        'add_shopping_items',
  description: 'Añade uno o más artículos a la lista de la compra familiar.',
  parameters: {
    type: 'OBJECT',
    properties: {
      items: {
        type: 'ARRAY',
        description: 'Lista de artículos a añadir',
        items: {
          type: 'OBJECT',
          properties: {
            name:     { type: 'STRING', description: 'Nombre del artículo' },
            quantity: { type: 'STRING', description: 'Cantidad opcional, p.ej. "2 kg", "1 bote"' },
          },
          required: ['name'],
        },
      },
      list_name: {
        type: 'STRING',
        description: 'Nombre de la lista. Por defecto: "Lista principal"',
      },
    },
    required: ['items'],
  },
};
```

- [ ] **Step 4: Run test to confirm pass**

```bash
cd agent && npm test -- shopping
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add agent/src/tools/shopping.ts agent/src/tools/shopping.test.ts
git commit -m "feat: add_shopping_items tool with unit tests"
```

---

### Task 4: Tool registry

**Files:**
- Create: `agent/src/tools/index.ts`

- [ ] **Step 1: Write the registry**

```typescript
// agent/src/tools/index.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ZodTypeAny, z } from 'zod';
import {
  addShoppingItems,
  addShoppingItemsDeclaration,
  addShoppingItemsSchema,
} from './shopping.js';

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
  declaration:      Record<string, unknown>;  // Gemini FunctionDeclaration shape
  useClaudeInstead: boolean;
}

export const tools: ToolDefinition[] = [
  {
    name:             'add_shopping_items',
    description:      'Añade artículos a la lista de la compra',
    schema:           addShoppingItemsSchema,
    handler:          (input, ctx) => addShoppingItems(input, ctx.supabase, ctx.familyId),
    declaration:      addShoppingItemsDeclaration,
    useClaudeInstead: false,
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

- [ ] **Step 3: Commit**

```bash
git add agent/src/tools/index.ts
git commit -m "feat: tool registry"
```

---

### Task 5: Gemini loop

**Files:**
- Create: `agent/src/agent/gemini.ts`

- [ ] **Step 1: Write gemini.ts**

```typescript
// agent/src/agent/gemini.ts
import {
  GoogleGenerativeAI,
  type Part,
  type FunctionDeclaration,
} from '@google/generative-ai';
import { tools, type ToolContext } from '../tools/index.js';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function runGeminiLoop(
  userMessage: string,
  ctx: ToolContext,
  systemPrompt: string
): Promise<string> {
  const declarations = tools
    .filter(t => !t.useClaudeInstead)
    .map(t => t.declaration as FunctionDeclaration);

  const model = genai.getGenerativeModel({
    model:             'gemini-2.5-flash',
    systemInstruction: systemPrompt,
    tools:             [{ functionDeclarations: declarations }],
  });

  const chat = model.startChat();
  let response = await chat.sendMessage(userMessage);

  // Tool-use loop — Gemini may call multiple tools in sequence
  let iterations = 0;
  while (response.response.functionCalls()?.length && iterations < 10) {
    iterations++;
    const calls = response.response.functionCalls()!;
    const resultParts: Part[] = [];

    for (const call of calls) {
      const tool = tools.find(t => t.name === call.name);
      if (!tool) {
        resultParts.push({
          functionResponse: {
            name:     call.name,
            response: { error: `Tool "${call.name}" not found` },
          },
        });
        continue;
      }

      const parsed = tool.schema.safeParse(call.args);
      if (!parsed.success) {
        resultParts.push({
          functionResponse: {
            name:     call.name,
            response: { error: parsed.error.message },
          },
        });
        continue;
      }

      const result = await tool.handler(parsed.data, ctx);
      resultParts.push({
        functionResponse: {
          name:     call.name,
          response: result as Record<string, unknown>,
        },
      });
    }

    response = await chat.sendMessage(resultParts);
  }

  return response.response.text();
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd agent && npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add agent/src/agent/gemini.ts
git commit -m "feat: Gemini 2.5 Flash tool-calling loop"
```

---

### Task 6: Emergency fallback parser

**Files:**
- Create: `agent/src/agent/fallback-parser.ts`
- Create: `agent/src/agent/fallback-parser.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// agent/src/agent/fallback-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseFallback } from './fallback-parser.js';

describe('parseFallback', () => {
  it('detects add_shopping intent', () => {
    expect(parseFallback('añade leche y pan')).toMatchObject({
      tool:  'add_shopping_items',
      items: expect.arrayContaining([
        expect.objectContaining({ name: 'leche' }),
        expect.objectContaining({ name: 'pan' }),
      ]),
    });
  });

  it('returns null for unknown input', () => {
    expect(parseFallback('cuéntame un chiste')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd agent && npm test -- fallback
```

Expected: FAIL — `Cannot find module './fallback-parser.js'`

- [ ] **Step 3: Implement fallback-parser.ts**

```typescript
// agent/src/agent/fallback-parser.ts

interface AddShoppingFallback {
  tool:  'add_shopping_items';
  items: { name: string }[];
}

type FallbackResult = AddShoppingFallback | null;

// Matches: "añade X, Y y Z" / "agrega X" / "compra X"
const ADD_RE = /\b(añade?|agrega?|compra)\s+(.+)/i;

export function parseFallback(text: string): FallbackResult {
  const m = ADD_RE.exec(text);
  if (m) {
    const itemsRaw = m[2].split(/,| y /i).map(s => s.trim()).filter(Boolean);
    return { tool: 'add_shopping_items', items: itemsRaw.map(name => ({ name })) };
  }
  return null;
}
```

- [ ] **Step 4: Run test to confirm pass**

```bash
cd agent && npm test -- fallback
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add agent/src/agent/fallback-parser.ts agent/src/agent/fallback-parser.test.ts
git commit -m "feat: emergency regex fallback parser"
```

---

### Task 7: Grammy bot entry point

**Files:**
- Create: `agent/src/agent/loop.ts`
- Create: `agent/src/index.ts`

- [ ] **Step 1: Write loop.ts (Grammy bot setup)**

```typescript
// agent/src/agent/loop.ts
import { Bot, type Context } from 'grammy';
import { supabase } from '../utils/supabase.js';
import { containsSensitiveData } from '../utils/masking.js';
import { runGeminiLoop } from './gemini.js';
import { parseFallback } from './fallback-parser.js';
import type { ToolContext } from '../tools/index.js';

const FAMILY_ID = process.env.FAMILY_ID!;
const TIMEZONE  = process.env.TIMEZONE ?? 'Europe/Madrid';

const openai = new OpenAI();

function buildSystemPrompt(familyName: string): string {
  const now = new Date().toLocaleString('es-ES', { timeZone: TIMEZONE });
  return `Eres JARVIS, el mayordomo digital de la familia ${familyName}.
- Español con tono de mayordomo británico: formal, cálido, humor sutil y seco
- Adultos: "señor/señora". Niños: por su nombre
- Conciso: respuestas breves y directas
- Si no entiendes: "Disculpe, ¿podría precisar a qué se refiere con...?"
- Proactivo: menciona cosas relevantes que detectes
- Fecha y hora actual: ${now}`;
}

async function getFamilyName(): Promise<string> {
  const { data } = await supabase
    .from('families')
    .select('name')
    .eq('id', FAMILY_ID)
    .single();
  return data?.name ?? 'García';
}

async function logCommand(
  inputType: 'text' | 'voice',
  rawInput: string,
  toolUsed: string | null,
  success: boolean
) {
  await supabase.from('voice_logs').insert({
    family_id:     FAMILY_ID,
    input_type:    inputType,
    raw_input:     rawInput,
    tool_used:     toolUsed,
    success,
  });
}

export function createBot(): Bot {
  const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

  bot.on('message', async (ctx: Context) => {
    // Phase 0: text only — voice deferred to Phase 1
    const text = ctx.message?.text;
    if (!text) return;
    const inputType = 'text' as const;

    // Validate sender belongs to this family
    const senderId = ctx.from?.id;
    if (!senderId) return;

    const { data: member } = await supabase
      .from('family_members')
      .select('id, name, active')
      .eq('family_id', FAMILY_ID)
      .eq('telegram_id', senderId)
      .eq('active', true)
      .single();

    if (!member) {
      await ctx.reply('Disculpe, no le reconozco. Este servicio es privado.');
      return;
    }

    // Precheck: block sensitive data before any LLM call (ADR-001)
    if (containsSensitiveData(text)) {
      await ctx.reply(
        'Disculpe, no puedo procesar datos sensibles en este momento. ' +
        'Esta función estará disponible cuando la infraestructura local esté configurada.'
      );
      await logCommand(inputType, null, 'unsupported_sensitive_data', false);
      return;
    }

    const toolCtx: ToolContext = { supabase, familyId: FAMILY_ID, memberId: member.id };
    const familyName = await getFamilyName();

    try {
      const reply = await runGeminiLoop(text, toolCtx, buildSystemPrompt(familyName));
      await ctx.reply(reply);
      await logCommand(inputType, text, null, true);
    } catch (err) {
      // Gemini unavailable — try regex fallback
      const fallback = parseFallback(text);
      if (fallback?.tool === 'add_shopping_items') {
        const { addShoppingItems } = await import('../tools/shopping.js');
        const result = await addShoppingItems(
          { items: fallback.items },
          supabase,
          FAMILY_ID
        );
        const reply = result.success
          ? `Anotado, señor. ${result.added} artículo(s) añadido(s) a la lista.`
          : `Disculpe, no pude añadir los artículos: ${result.error}`;
        await ctx.reply(reply);
        await logCommand(inputType, text, 'add_shopping_items_fallback', result.success);
      } else {
        await ctx.reply('Disculpe, estoy teniendo dificultades técnicas en este momento.');
        await logCommand(inputType, text, null, false);
      }
    }
  });

  return bot;
}
```

- [ ] **Step 2: Write index.ts (entry point)**

```typescript
// agent/src/index.ts
import 'dotenv/config';
import { createBot } from './agent/loop.js';

const required = [
  'TELEGRAM_BOT_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'FAMILY_ID',
] as const;

for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

const bot = createBot();

bot.start({
  onStart: () => console.log('JARVIS online'),
});

process.once('SIGINT',  () => bot.stop());
process.once('SIGTERM', () => bot.stop());
```

- [ ] **Step 3: Run typecheck**

```bash
cd agent && npm run typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add agent/src/agent/loop.ts agent/src/index.ts
git commit -m "feat: Grammy bot entry point with Gemini loop + voice support"
```

---

### Task 8: Smoke test — end-to-end via Telegram

This task requires real credentials in `agent/.env`.

- [ ] **Step 1: Start local Supabase (if not running)**

```bash
supabase start
```

- [ ] **Step 2: Start the agent in dev mode**

```bash
cd agent && npm run dev
```

Expected: `JARVIS online` printed, no errors.

- [ ] **Step 2.5: Registrar tu telegram_id en la seed**

Antes de enviar el primer mensaje, registra tu Telegram ID real en la base de datos.
Obtén tu ID enviando `/start` a `@userinfobot` en Telegram.

```sql
-- Ejecutar en supabase db psql o en el Studio local
UPDATE family_members
SET telegram_id = <TU_TELEGRAM_ID>
WHERE name = 'Carlos' AND family_id = '00000000-0000-0000-0000-000000000001';
```

Repite para el telegram_id de tu pareja (nombre 'Elena' en el seed).

- [ ] **Step 3: Send a test message in Telegram**

Open the bot in Telegram and send:
```
Añade leche, pan y huevos a la lista
```

Expected: JARVIS replies in Spanish, e.g.:
```
Anotado, señor. He añadido 3 artículos a la lista: leche, pan y huevos.
```

- [ ] **Step 3.5: Verificar rechazo de miembro inactivo**

  Desactiva temporalmente tu propio miembro y confirma que el bot rechaza el mensaje:

  ```sql
  UPDATE family_members SET active = FALSE
  WHERE name = 'Carlos' AND family_id = '00000000-0000-0000-0000-000000000001';
  ```

  Envía cualquier mensaje al bot desde tu Telegram.

  Expected: JARVIS responde "Disculpe, no le reconozco. Este servicio es privado."
  y NO inserta nada en `shopping_items` ni llama a Gemini.

  Restaura el acceso después:

  ```sql
  UPDATE family_members SET active = TRUE
  WHERE name = 'Carlos' AND family_id = '00000000-0000-0000-0000-000000000001';
  ```

- [ ] **Step 4: Verify Supabase insert**

```bash
supabase db psql -c "SELECT name, quantity FROM shopping_items;"
```

Expected: Rows for leche, pan, huevos.

- [ ] **Step 5: Run all tests**

```bash
cd agent && npm test
```

Expected: All tests pass.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: Phase 0 agent complete — Grammy + Gemini + add_shopping_items end-to-end"
```
