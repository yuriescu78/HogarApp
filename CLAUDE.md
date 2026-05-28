# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> JARVIS — Mayordomo digital familiar con personalidad británica. Telegram Bot + Dashboard Next.js + Agente Node.js + Supabase.

**This is a greenfield project — no code exists yet. Always begin with `supabase/migrations/001_initial_schema.sql`.**

---

## Commands

All commands must be run from inside the workspace subdirectory (`cd agent/` or `cd dashboard/`).

### Agent (`agent/`)
```bash
npm install
npm run dev        # watch mode
npm run build
npm start          # run compiled output
npm run typecheck
```

### Dashboard (`dashboard/`)
```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run typecheck
npm run lint
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

**`agent/`** — Long-running Node.js 20+ TypeScript process. Grammy handles Telegram webhooks/polling; node-cron handles scheduled jobs. Core loop at `agent/src/agent/loop.ts`:
```
Telegram message (text or audio)
  -> [audio] Whisper STT -> text
  -> Gemini 2.5 Flash + system prompt + 25 tools + family context
  -> tool execution -> Supabase INSERT/SELECT
  -> Gemini composes response
  -> Telegram reply (text + optional Google Cloud TTS audio)
```
Emergency fallback (`agent/src/agent/fallback-parser.ts`): regex covers `add_shopping`, `query_today`, `check_item`, `create_note`, `query_calendar` when Gemini is unavailable.

**`dashboard/`** — Next.js 14 App Router, Vercel deploy. Magic link auth via Supabase SSR. Server Components use service role key; Client Components use anon key.

**`supabase/`** — Schema source of truth. All tables carry `family_id` for Row Level Security. Only `knowledge_entries` has `embedding vector(768)` (Gemini text-embedding-004).

**`shared/`** — TypeScript types generated from Supabase schema. Never edit by hand; regenerate with `supabase gen types`.

---

## Tool Registry Pattern

Each tool lives in `agent/src/tools/` and is registered in `agent/src/tools/index.ts`:

```typescript
export const myToolSchema = z.object({ ... });
export async function myTool(input: z.infer<typeof myToolSchema>, ctx: ToolContext) {
  const { data, error } = await ctx.supabase.from('...').insert({ family_id: ctx.familyId, ... });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// Registry entry
{ name: 'my_tool', description: '...', schema: myToolSchema, handler: myTool, useClaudeInstead: false }
```

`useClaudeInstead: true` routes the tool to `agent/src/agent/claude.ts` (Claude Sonnet) instead of Gemini. Reserved for long-reasoning tasks — currently only `suggest_menu`.

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
```

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

**Phase 0** (not started): `supabase/migrations/001_initial_schema.sql` -> `agent/` wired to Telegram + Supabase + Gemini -> `add_shopping_items` tool end-to-end -> `dashboard/` with Next.js + Supabase SSR + magic link auth -> `supabase/seed.sql` with example family.

Subsequent phases: Lista compra + Agenda + Voz (Fase 1) | Bitacora + Menus + embeddings (Fase 2) | Tareas + Mascotas + Inversiones (Fase 3) | Rutinas + deploy (Fase 4) | React Native si Telegram se queda corto (Fase 5).

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
