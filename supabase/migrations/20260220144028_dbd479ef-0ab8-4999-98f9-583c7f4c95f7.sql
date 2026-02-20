
-- 1. ACCOUNTS table (replaces hardcoded WALLETS)
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'UZS',
  initial_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. CATEGORIES table (replaces hardcoded CASHFLOW_CATEGORIES)
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- 3. WORKSPACE_MEMBERS table (access sharing)
CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  member_email text NOT NULL,
  member_id uuid,
  access_type text NOT NULL DEFAULT 'limited' CHECK (access_type IN ('full', 'limited')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, member_email)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their workspace members" ON public.workspace_members FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Members can view their own invites" ON public.workspace_members FOR SELECT USING (auth.uid() = member_id);

-- 4. Add attachment_url column to transactions for receipt photos
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS attachment_url text;

-- 5. Add from_account / to_account for internal transfers
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS from_account text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS to_account text;

-- 6. Storage bucket for transaction attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Users can upload attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Attachments are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'attachments');
CREATE POLICY "Users can delete own attachments" ON storage.objects FOR DELETE USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
