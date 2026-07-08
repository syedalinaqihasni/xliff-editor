/*
# Create XLIFF Translation Tables

1. New Tables
- `xliff_files` - Stores uploaded XLIFF files with metadata
  - `id` (uuid, primary key)
  - `name` (text, not null) - File name
  - `source_language` (text, not null) - Source language code (e.g., 'en')
  - `target_language` (text, not null) - Target language code (e.g., 'es')
  - `content` (jsonb, not null) - Parsed XLIFF document structure
  - `unit_count` (integer, default 0) - Total translation units
  - `translated_count` (integer, default 0) - Number of translated units
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

- `translation_units` - Individual translation units extracted from files
  - `id` (uuid, primary key)
  - `xliff_file_id` (uuid, foreign key to xliff_files)
  - `unit_id` (text, not null) - Original XLIFF unit ID
  - `resname` (text) - Resource name
  - `source` (text, not null) - Source text
  - `target` (text) - Translated text
  - `state` (text, default 'new') - Translation state
  - `note` (text) - Translator notes
  - `approved` (boolean, default false) - Approval status
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

- `translation_memory` - Translation memory for AI suggestions
  - `id` (uuid, primary key)
  - `source_language` (text, not null)
  - `target_language` (text, not null)
  - `source` (text, not null) - Source text
  - `target` (text, not null) - Translated text
  - `context` (text) - Optional context
  - `usage_count` (integer, default 1) - How often this translation has been used
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

2. Security
- Enable RLS on all tables.
- Allow anon + authenticated CRUD because this is a single-tenant app without sign-in.
*/

CREATE TABLE IF NOT EXISTS xliff_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_language text NOT NULL,
  target_language text NOT NULL,
  content jsonb NOT NULL,
  unit_count integer NOT NULL DEFAULT 0,
  translated_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE xliff_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_xliff_files" ON xliff_files;
CREATE POLICY "anon_select_xliff_files" ON xliff_files FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_xliff_files" ON xliff_files;
CREATE POLICY "anon_insert_xliff_files" ON xliff_files FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_xliff_files" ON xliff_files;
CREATE POLICY "anon_update_xliff_files" ON xliff_files FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_xliff_files" ON xliff_files;
CREATE POLICY "anon_delete_xliff_files" ON xliff_files FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS translation_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  xliff_file_id uuid NOT NULL REFERENCES xliff_files(id) ON DELETE CASCADE,
  unit_id text NOT NULL,
  resname text,
  source text NOT NULL,
  target text,
  state text NOT NULL DEFAULT 'new',
  note text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE translation_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_translation_units" ON translation_units;
CREATE POLICY "anon_select_translation_units" ON translation_units FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_translation_units" ON translation_units;
CREATE POLICY "anon_insert_translation_units" ON translation_units FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_translation_units" ON translation_units;
CREATE POLICY "anon_update_translation_units" ON translation_units FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_translation_units" ON translation_units;
CREATE POLICY "anon_delete_translation_units" ON translation_units FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS translation_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_language text NOT NULL,
  target_language text NOT NULL,
  source text NOT NULL,
  target text NOT NULL,
  context text,
  usage_count integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE translation_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_translation_memory" ON translation_memory;
CREATE POLICY "anon_select_translation_memory" ON translation_memory FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_translation_memory" ON translation_memory;
CREATE POLICY "anon_insert_translation_memory" ON translation_memory FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_translation_memory" ON translation_memory;
CREATE POLICY "anon_update_translation_memory" ON translation_memory FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_translation_memory" ON translation_memory;
CREATE POLICY "anon_delete_translation_memory" ON translation_memory FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_translation_units_xliff_file_id ON translation_units(xliff_file_id);
CREATE INDEX IF NOT EXISTS idx_translation_units_state ON translation_units(state);
CREATE INDEX IF NOT EXISTS idx_translation_memory_source ON translation_memory(source_language, target_language, source);
CREATE INDEX IF NOT EXISTS idx_translation_memory_languages ON translation_memory(source_language, target_language);
