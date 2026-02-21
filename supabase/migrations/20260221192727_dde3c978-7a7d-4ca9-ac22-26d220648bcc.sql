
-- Create exchange_rates table
CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month text NOT NULL,
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, from_currency, to_currency)
);

-- Enable RLS
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own exchange rates"
ON public.exchange_rates FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exchange rates"
ON public.exchange_rates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exchange rates"
ON public.exchange_rates FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own exchange rates"
ON public.exchange_rates FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_exchange_rates_updated_at
BEFORE UPDATE ON public.exchange_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add cross-currency transfer fields to transactions
ALTER TABLE public.transactions
  ADD COLUMN target_currency text,
  ADD COLUMN target_amount numeric;
