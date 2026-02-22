
-- Change exchange_rates from month-based to date-based
-- Drop the unique constraint on month, add one on date
ALTER TABLE public.exchange_rates DROP CONSTRAINT IF EXISTS exchange_rates_user_id_month_from_currency_to_currency_key;
ALTER TABLE public.exchange_rates ADD COLUMN effective_date date;

-- Migrate existing data: convert month '2025-01' to '2025-01-01'
UPDATE public.exchange_rates SET effective_date = (month || '-01')::date WHERE effective_date IS NULL;

-- Make effective_date NOT NULL
ALTER TABLE public.exchange_rates ALTER COLUMN effective_date SET NOT NULL;

-- Drop old month column
ALTER TABLE public.exchange_rates DROP COLUMN month;

-- Add unique constraint on date-based key
ALTER TABLE public.exchange_rates ADD CONSTRAINT exchange_rates_user_date_pair_key UNIQUE (user_id, effective_date, from_currency, to_currency);
