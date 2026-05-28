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
