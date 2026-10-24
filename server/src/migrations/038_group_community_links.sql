ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS community_links JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE bible_study_groups
  ADD COLUMN IF NOT EXISTS community_links JSONB NOT NULL DEFAULT '[]'::jsonb;
