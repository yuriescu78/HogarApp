# Phase 0 – Supabase Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the full Supabase schema (20 tables + pgvector + RLS scaffolding) and a seed file with an example Spanish family.

**Architecture:** Single migration file enables pgvector and creates all tables with `family_id UUID REFERENCES families(id)` for Row Level Security. Service role bypasses RLS — used by both agent and dashboard server components in Phase 0. Seed creates one demo family so the agent and dashboard have real data to query.

**Tech Stack:** PostgreSQL 15 (Supabase), pgvector extension, Supabase CLI

---

### Task 1: Initialize Supabase project

**Files:**
- Create: `supabase/config.toml` (via CLI)

- [ ] **Step 1: Run supabase init**

```bash
supabase init
```

Expected: `supabase/config.toml` created, `supabase/migrations/` directory created.

- [ ] **Step 2: Verify local Supabase can start**

```bash
supabase start
```

Expected: Output shows all services running. Note the `API URL`, `anon key`, and `service_role key` printed — copy to `agent/.env` and `dashboard/.env.local`.

- [ ] **Step 3: Commit**

```bash
git init
git add supabase/config.toml
git commit -m "chore: init supabase project"
```

---

### Task 2: Write migration 001_initial_schema.sql

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/001_initial_schema.sql

-- Enable pgvector for knowledge_entries embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ──────────────────────────────────────────────
-- Core: families + members
-- ──────────────────────────────────────────────

CREATE TABLE families (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE family_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('adult', 'child')),
  telegram_id BIGINT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE family_settings (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE UNIQUE,
  settings  JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- Shopping
-- ──────────────────────────────────────────────

CREATE TABLE shopping_lists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'Lista principal',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shopping_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  list_id    UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  quantity   TEXT,
  checked    BOOLEAN DEFAULT FALSE,
  added_by   UUID REFERENCES family_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- Calendar
-- ──────────────────────────────────────────────

CREATE TABLE calendar_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ,
  all_day         BOOLEAN DEFAULT FALSE,
  google_event_id TEXT,
  created_by      UUID REFERENCES family_members(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_reminders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  remind_at  TIMESTAMPTZ NOT NULL,
  sent       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- Notes + Knowledge Base
-- ──────────────────────────────────────────────

CREATE TABLE notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title      TEXT,
  content    TEXT NOT NULL,
  created_by UUID REFERENCES family_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE knowledge_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id      UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  content        TEXT NOT NULL,
  content_masked TEXT NOT NULL,
  category       TEXT,
  embedding      vector(768),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kb_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  entry_id     UUID NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kb_renewal_alerts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  entry_id   UUID NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  renews_at  DATE NOT NULL,
  reminded   BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- Menus + Recipes
-- ──────────────────────────────────────────────

CREATE TABLE recipes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  ingredients   JSONB,
  instructions  TEXT,
  servings      INTEGER,
  prep_minutes  INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE weekly_menus (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  menu       JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- Chores
-- ──────────────────────────────────────────────

CREATE TABLE chores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  assigned_to UUID REFERENCES family_members(id),
  frequency   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chore_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  chore_id     UUID NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  completed_by UUID REFERENCES family_members(id),
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- Pets
-- ──────────────────────────────────────────────

CREATE TABLE pets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  species    TEXT NOT NULL,
  breed      TEXT,
  birth_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pet_diary (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  pet_id     UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  entry      TEXT NOT NULL,
  category   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pet_reminders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  pet_id     UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  remind_at  TIMESTAMPTZ NOT NULL,
  sent       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- Investments
-- ──────────────────────────────────────────────

CREATE TABLE investment_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id      UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  content        TEXT NOT NULL,
  content_masked TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- Logging
-- ──────────────────────────────────────────────

CREATE TABLE voice_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id      UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  member_id      UUID REFERENCES family_members(id),
  input_type     TEXT NOT NULL CHECK (input_type IN ('text', 'voice')),
  raw_input      TEXT,
  parsed_intent  TEXT,
  tool_used      TEXT,
  success        BOOLEAN,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- RLS: enable on all tables (service role bypasses; policies added in later phases)
-- ──────────────────────────────────────────────

ALTER TABLE families          ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reminders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_attachments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_renewal_alerts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_menus       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chores             ENABLE ROW LEVEL SECURITY;
ALTER TABLE chore_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_diary          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_reminders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_logs         ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Apply migration**

```bash
supabase db reset
```

Expected: `Finished supabase db reset.` — no errors.

- [ ] **Step 3: Spot-check tables exist**

```bash
supabase db diff --schema public
```

Expected: Shows all 20 tables. If there are errors, fix the SQL and re-run `supabase db reset`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_initial_schema.sql
git commit -m "feat: initial schema — 20 tables + pgvector + RLS enabled"
```

---

### Task 3: Write seed.sql

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Write seed file**

```sql
-- supabase/seed.sql
-- Demo family: Los García

INSERT INTO families (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'García');

INSERT INTO family_members (family_id, name, role, telegram_id) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Carlos', 'adult', NULL),
  ('00000000-0000-0000-0000-000000000001', 'Elena',  'adult', NULL),
  ('00000000-0000-0000-0000-000000000001', 'Sofía',  'child', NULL);

INSERT INTO family_settings (family_id, settings)
VALUES ('00000000-0000-0000-0000-000000000001', '{"timezone": "Europe/Madrid", "language": "es"}');

INSERT INTO shopping_lists (id, family_id, name)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Lista principal');
```

- [ ] **Step 2: Apply seed**

```bash
supabase db reset
```

Expected: `Finished supabase db reset.` The seed runs automatically after migrations.

- [ ] **Step 3: Verify seed data**

```bash
supabase db psql -c "SELECT name FROM families;"
```

Expected:
```
  name
--------
 García
```

- [ ] **Step 4: Set FAMILY_ID in agent/.env**

Add this line to `agent/.env` (create the file if it doesn't exist):
```
FAMILY_ID=00000000-0000-0000-0000-000000000001
```

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql agent/.env.example
git commit -m "feat: seed demo family García"
```

---

### Task 4: Generate TypeScript types

**Files:**
- Create: `shared/types/database.ts`

- [ ] **Step 1: Create shared directory**

```bash
mkdir -p shared/types
```

- [ ] **Step 2: Generate types**

```bash
supabase gen types typescript --local > shared/types/database.ts
```

Expected: `shared/types/database.ts` created with `Database` interface containing all 20 tables.

- [ ] **Step 3: Spot-check generated file**

Open `shared/types/database.ts` and verify it contains:
```typescript
export type Database = {
  public: {
    Tables: {
      families: { ... }
      shopping_items: { ... }
      // ... all 20 tables
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add shared/types/database.ts
git commit -m "chore: generate TypeScript types from Supabase schema"
```
