-- Run this script in your Supabase SQL Editor to migrate existing questions

-- 1. Add the new options array column
ALTER TABLE questions ADD COLUMN IF NOT EXISTS options text[] NOT NULL DEFAULT '{}';

-- 2. Migrate existing data from option_a, option_b, option_c, option_d into the new array
-- We use array_remove to ignore any potential nulls if your schema was ever altered,
-- but the array construction pulls in the 4 static options.
UPDATE questions 
SET options = ARRAY[option_a, option_b, option_c, option_d];

-- 3. Drop the old columns
ALTER TABLE questions 
  DROP COLUMN IF EXISTS option_a,
  DROP COLUMN IF EXISTS option_b,
  DROP COLUMN IF EXISTS option_c,
  DROP COLUMN IF EXISTS option_d;
