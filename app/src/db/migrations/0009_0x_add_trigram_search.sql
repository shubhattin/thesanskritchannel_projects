-- Custom SQL migration file, put your code below! --
-- enable trigram support (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint

-- create a GIN trigram index on the "text" column for fast substring / similarity search
CREATE INDEX IF NOT EXISTS texts_text_search_trgm_idx
ON "texts"
USING GIN ("text_search" gin_trgm_ops);
--> statement-breakpoint
