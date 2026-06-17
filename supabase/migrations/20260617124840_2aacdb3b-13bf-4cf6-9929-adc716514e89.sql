ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS agent_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category text;