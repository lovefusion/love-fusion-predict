-- Love Fusion update 7: run this ONCE in Neon SQL Editor BEFORE uploading the code.
-- It adds one empty column. Nothing else changes and no data is touched.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS eliminated_at timestamptz;
