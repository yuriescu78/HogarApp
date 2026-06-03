-- Add token usage tracking columns to voice_logs
ALTER TABLE voice_logs
  ADD COLUMN IF NOT EXISTS tokens_input  INTEGER,
  ADD COLUMN IF NOT EXISTS tokens_output INTEGER,
  ADD COLUMN IF NOT EXISTS model         TEXT,
  ADD COLUMN IF NOT EXISTS cost_usd      NUMERIC(10,6);
