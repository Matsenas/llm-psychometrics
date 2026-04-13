-- Drop the existing check constraint
ALTER TABLE ipip_responses DROP CONSTRAINT IF EXISTS ipip_responses_item_number_check;

-- Add new check constraint for 50 items (1-50)
ALTER TABLE ipip_responses ADD CONSTRAINT ipip_responses_item_number_check 
  CHECK (item_number >= 1 AND item_number <= 50);