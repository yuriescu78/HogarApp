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
