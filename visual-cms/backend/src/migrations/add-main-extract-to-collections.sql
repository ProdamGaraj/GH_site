-- Migration: add mainExtract to collections
-- dot-notation paths extracted from the main collection API response.
-- Values are available in additionalSources via {{extract.name}}.

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS "mainExtract" jsonb DEFAULT NULL;
