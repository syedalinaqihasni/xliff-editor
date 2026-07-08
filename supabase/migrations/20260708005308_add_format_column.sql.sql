/*
# Add format column to xliff_files table

1. Modified Tables
- `xliff_files` - Add `format` column to track the file format (xliff, po, pot, mo)
  - `format` (text, default 'xliff') - File format type

2. Security
- No changes to RLS policies needed.
*/

ALTER TABLE xliff_files
ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'xliff';

CREATE INDEX IF NOT EXISTS idx_xliff_files_format ON xliff_files(format);