# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> JARVIS — Mayordomo digital familiar con personalidad británica. Telegram Bot + Dashboard Next.js + Agente Node.js + Supabase.

---

## Commands

All commands must be run from inside the workspace subdirectory (`cd agent/` or `cd dashboard/`).

### Agent (`agent/`)
```bash
npm install
npm run dev        # tsx watch mode
npm run build
npm start          # run compiled output
npm run typecheck
npm test           # vitest run (single pass)
npm run test:watch # vitest watch
```

### Dashboard (`dashboard/`)
```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run typecheck
npm run lint
npm test           # vitest run
```

### Supabase
```bash
supabase db push
supabase gen types typescript --local > shared/types/database.ts   # run after any schema change
supabase db reset
```

---

## Architecture

Three independently deployable pieces. There is **no shared HTTP API** — agent and dashboard both talk directly to Supabase.

**`agent/`** — Long-running Node.js 20+ TypeScript process. Grammy handles Telegram **polling in development only** (`NODE_ENV !== 'production'`). In production, Telegram updates arrive via the dashboard webhook — the agent process is not needed on Vercel.

`agent/src/agent/loop.ts` is the message handler:
```
Telegram message (text or voice)
  -> [voice] OpenAI Whisper STT -> text
  -> member auth check via family_members.telegram_id
  -> sensitive data precheck (ADR-001: block before any LLM call)
  -> runGeminiLoop (gemini-2.5-flash + tools + system prompt)
  -> tool execution -> Supabase INSERT/SELECT
  -> Gemini composes response -> ctx.reply()
```
Fallback (`agent/src/agent/fallback-parser.ts`): regex for `add_shopping_items`, `query_shopping`, `check_shopping_item` when Gemini throws. Loop catches the exception and tries fallback before replying with a generic error.

`agent/src/agent/gemini.ts` runs the Gemini tool-call loop (max 10 iterations). Each tool's Gemini `declaration` (function schema) is exported alongside its Zod `schema` and `handler` from its own file.

**`dashboard/`** — Next.js 14 App Router, Vercel deploy. Magic link auth via Supabase SSR. Server Components use service role key; Client Components use anon key.

Telegram webhook lives entirely in `dashboard/` as two API routes:
- `POST /api/telegram` — receives updates from Telegram; verifies `X-Telegram-Bot-Api-Secret-Token` header; calls `bot.handleUpdate(body)` inside Vercel's `waitUntil` so the function returns 200 immediately while the handler runs.
- `GET /api/telegram/setup?secret=<TELEGRAM_WEBHOOK_SECRET>` — registers the webhook URL with Telegram via `setWebhook`. Call once after each deploy: `curl "https://<domain>/api/telegram/setup?secret=<secret>"`

Tool logic for the webhook is duplicated in `dashboard/src/lib/jarvis/` (mirrors `agent/src/` for Vercel serverless context, which cannot import from `agent/`).

**`supabase/`** — Schema source of truth. All tables carry `family_id` for Row Level Security. Only `knowledge_entries` has `embedding vector(768)` (Gemini text-embedding-004).

**`shared/`** — TypeScript types generated from Supabase schema. Never edit by hand; regenerate with `supabase gen types`.

---

## Tool Registry Pattern

Each tool lives in `agent/src/tools/` and exports three things, then gets registered in `agent/src/tools/index.ts`:

```typescript
// myTool.ts
export const myToolSchema = z.object({ ... });
export const myToolDeclaration = { name: 'my_tool', description: '...', parameters: { ... } }; // Gemini FunctionDeclaration format
export async function myTool(input: z.infer<typeof myToolSchema>, supabase: SupabaseClient, familyId: string) {
  const { data, error } = await supabase.from('...').insert({ family_id: familyId, ... });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// index.ts entry
{ name: 'my_tool', description: '...', schema: myToolSchema, declaration: myToolDeclaration,
  handler: (input, ctx) => myTool(input, ctx.supabase, ctx.familyId), useClaudeInstead: false }
```

Currently implemented tools (25): `add_shopping_items`, `query_shopping`, `check_shopping_item`, `clear_checked_items`, `add_calendar_event`, `query_calendar`, `add_reminder`, `create_note`, `query_notes`, `add_recipe`, `suggest_menu`, `add_weekly_menu`, `save_knowledge`, `search_knowledge`, `add_chore`, `query_chores`, `log_chore`, `add_pet`, `add_pet_diary_entry`, `add_pet_reminder`, `query_pet`, `save_investment_note`, `query_investment_notes`.

`useClaudeInstead: true` routes to Claude Sonnet via `agent/src/agent/claude.ts` (implemented — used for `suggest_menu`). The dashboard mirrors this in `dashboard/src/lib/jarvis/gemini.ts`.

---

## Code Conventions

- TypeScript strict mode in both workspaces
- Zod for all tool input validation and AI response parsing
- Supabase queries: always `const { data, error } = await supabase...` — never throw raw, always check `error`
- Sensitive KB fields: write both `content` and `content_masked` (DNIs, IBANs, policies masked via `agent/src/utils/masking.ts`)
- All commands (voice + text) logged to `voice_logs` table
- **JARVIS always responds in Spanish** — never mix languages in Telegram output

---

## Data Model

Tables: `families`, `family_members`, `pets`, `shopping_lists`, `shopping_items`, `calendar_events`, `event_reminders`, `notes`, `knowledge_entries`, `kb_attachments`, `kb_renewal_alerts`, `recipes`, `weekly_menus`, `chores`, `chore_logs`, `pet_diary`, `pet_reminders`, `investment_notes`, `family_settings`, `voice_logs`.

All tables have `family_id` (FK -> `families.id`) for RLS. Only `knowledge_entries` has `embedding vector(768)`.

---

## Environment Variables

### `agent/.env`
```
TELEGRAM_BOT_TOKEN=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_TTS_CREDENTIALS=         # path to service account JSON
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=
FAMILY_ID=                      # UUID of the family row
TIMEZONE=Europe/Madrid
```

### `dashboard/.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FAMILY_ID=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=       # openssl rand -hex 32
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
CRON_SECRET=                   # openssl rand -hex 32
TIMEZONE=Europe/Madrid
```
Full reference: `dashboard/.env.example`

---

## JARVIS Personality (system prompt seed)

```
Eres JARVIS, el mayordomo digital de la familia {family_name}.
- Espanol con tono de mayordomo britanico: formal, calido, humor sutil y seco
- Adultos: "senor/senora". Ninos: por su nombre
- Conciso: "Anotado, senor. La cita queda registrada para el martes a las 10:00."
- Si no entiende: "Disculpe, podria precisar a que se refiere con...?"
- Proactivo: menciona cosas relevantes que detecte
```

---

## Current Phase

**Phase 0** (complete): Schema migrated, agent wired to Telegram + Supabase + Gemini, shopping + calendar + reminder tools live, dashboard with Next.js SSR + magic link auth, `supabase/seed.sql` exists.

**Fase 1** (complete): Notas, bitácora de voz, embeddings semánticos, recetario, menú IA (Claude Sonnet).

**Fase 2** (complete): Dashboard — bitácora, recetario, panel actualizado.

**Fase 3** (complete): Tareas domésticas, mascotas, inversiones (25 herramientas Telegram en total).

**Fase 4** (complete): Cron jobs (reminder-dispatcher + morning-briefing), Telegram migrado de polling a **webhook** en el dashboard (serverless-safe con `waitUntil`), deploy files listos (Dockerfile, fly.toml, vercel.json).

**Fase 5** (aplazada): React Native — Telegram + dashboard web son suficientes por ahora.

---

## Herramientas G Stack disponibles

### 1. Planificación y producto
- `/spec` — Convierte intención vaga en un spec preciso y ejecutable en cinco fases.
- `/plan-ceo-review` — Revisión del plan en modo CEO/founder: rethink, 10-star product, expansión de scope.
- `/plan-eng-review` — Revisión del plan como engineering manager: arquitectura, flujo de datos, edge cases.
- `/plan-design-review` — Revisión del plan con ojo de diseñador: puntúa cada dimensión 0-10 y lo arregla.
- `/plan-devex-review` — Revisión de plan centrada en developer experience: personas, friction points, momentos mágicos.
- `/plan-tune` — Ajusta la sensibilidad de preguntas y el perfil de desarrollador para los skills de gstack.
- `/autoplan` — Pipeline de revisión automática: corre CEO + design + eng + DX review en secuencia con auto-decisiones.
- `/office-hours` — Modo YC Office Hours: preguntas de forcing para startups o brainstorming para side projects.

### 2. Diseño
- `/design-consultation` — Propone un sistema de diseño completo (estética, tipografía, color, layout, motion) y genera DESIGN.md.
- `/design-shotgun` — Genera múltiples variantes de diseño, abre un board comparativo y recoge feedback estructurado.
- `/design-review` — QA visual con ojo de diseñador: detecta y arregla inconsistencias, spacing, jerarquía y AI slop.
- `/design-html` — Genera HTML/CSS de producción a partir de mockups aprobados o desde cero.
- `/ios-design-review` — Auditoría de diseño visual para apps iOS en hardware real contra Apple HIG y DESIGN.md.

### 3. Desarrollo y revisión
- `/review` — Revisión de PR pre-landing: SQL safety, LLM trust boundaries, side effects condicionales.
- `/investigate` — Debugging sistemático con investigación de causa raíz. Iron Law: no fixes sin root cause.
- `/health` — Dashboard de calidad: type checker, linter, tests, dead code — puntuación compuesta 0-10.
- `/retro` — Retrospectiva semanal de ingeniería: commit history, patrones de trabajo, tendencias.
- `/benchmark` — Detección de regresiones de rendimiento: Core Web Vitals, tiempos de carga, comparativa antes/después.
- `/benchmark-models` — Benchmark cross-model (Claude, GPT, Gemini): latencia, tokens, coste y calidad comparados.
- `/devex-review` — Auditoría live de developer experience: navega docs, prueba el getting started, mide TTHW.
- `/ios-fix` — Bug fixer autónomo para iOS: lee fuente, escribe fix, reconstruye y verifica en dispositivo real.
- `/ios-sync` — Regenera el debug bridge iOS contra los últimos templates de gstack.
- `/ios-clean` — Elimina el paquete DebugBridge SPM y todo el wiring `#if DEBUG` de la app iOS.
- `/pair-agent` — Empareja un agente remoto (OpenClaw, Codex, Cursor…) con el navegador local.

### 4. Seguridad y control
- `/cso` — Modo Chief Security Officer: secrets, supply chain, CI/CD, OWASP Top 10, STRIDE threat modeling.
- `/careful` — Guardrails de seguridad: avisa antes de `rm -rf`, `DROP TABLE`, force-push y similares.
- `/guard` — Modo seguridad máxima: combina `/careful` + `/freeze` (avisos destructivos + edits limitados a un directorio).
- `/freeze` — Restringe edits a un directorio específico durante la sesión.
- `/unfreeze` — Elimina el boundary de freeze para volver a editar en todos los directorios.

### 5. QA y navegador
- `/qa` — QA sistemático de una web app: encuentra bugs y los arregla, un commit por fix.
- `/qa-only` — QA solo de reporte: produce informe con health score, screenshots y pasos de reproducción — no toca código.
- `/browse` — Navegador headless rápido: navega URLs, interactúa con elementos, toma screenshots anotados.
- `/open-gstack-browser` — Abre GStack Browser: Chromium controlado por IA con sidebar en tiempo real y stealth anti-bot.
- `/scrape` — Extrae datos de una página web; las flows repetidas se codifican como browser-skill (~200ms).
- `/skillify` — Codifica el último flujo de `/scrape` exitoso como un browser-skill permanente en disco.
- `/setup-browser-cookies` — Importa cookies del Chromium real al navegador headless para testear páginas autenticadas.
- `/canary` — Monitoreo post-deploy: vigila errores de consola, regresiones de rendimiento y fallos de página.
- `/ios-qa` — QA en dispositivo iOS real: vision-driven loop screenshot → analiza → actúa → verifica.

### 6. Documentación y generación
- `/document-generate` — Genera documentación faltante desde cero con el framework Diataxis (tutorial/how-to/reference/explanation).
- `/document-release` — Actualiza la documentación post-ship: README, ARCHITECTURE, CONTRIBUTING y CLAUDE.md.
- `/make-pdf` — Convierte cualquier archivo markdown en un PDF de calidad de publicación con TOC, cabeceras y márgenes.

### 7. Despliegue
- `/ship` — Workflow de ship: merge base, tests, review diff, bump VERSION, CHANGELOG, commit, push, PR.
- `/land-and-deploy` — Mergea el PR, espera CI y deploy, verifica salud de producción con canary checks.
- `/setup-deploy` — Configura los ajustes de despliegue para `/land-and-deploy` (Fly.io, Vercel, Render, Netlify…).
- `/landing-report` — Dashboard read-only de la cola de ship: muestra slots VERSION ocupados y WIP de workspaces.

### 8. Contexto y mantenimiento
- `/context-save` — Guarda el estado de trabajo actual (git state, decisiones, trabajo pendiente) para recuperarlo más tarde.
- `/context-restore` — Restaura el contexto guardado por `/context-save` para retomar sin perder el hilo.
- `/learn` — Gestiona los learnings del proyecto: revisa, busca, poda y exporta lo aprendido entre sesiones.
- `/setup-gbrain` — Configura gbrain para el agente: instala CLI, inicializa brain local o Supabase, registra MCP.
- `/sync-gbrain` — Mantiene gbrain actualizado con el código del repo y refresca la guía de búsqueda en CLAUDE.md.
- `/gstack-upgrade` — Actualiza gstack a la última versión (detecta instalación global vs vendored).
