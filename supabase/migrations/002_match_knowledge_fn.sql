-- supabase/migrations/002_match_knowledge_fn.sql
--
-- Función de búsqueda semántica para knowledge_entries usando pgvector.
-- Devuelve los N resultados más cercanos por similitud coseno, filtrados por family_id
-- y por umbral mínimo de similitud.

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
