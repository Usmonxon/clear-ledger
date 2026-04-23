
-- Telegram bot integration tables

-- Per-user link between Finco user and Telegram chat
CREATE TABLE public.telegram_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  chat_id BIGINT UNIQUE,
  link_code TEXT UNIQUE,
  link_code_expires_at TIMESTAMPTZ,
  linked_at TIMESTAMPTZ,
  notify_on_new_tx BOOLEAN NOT NULL DEFAULT true,
  daily_digest BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_links_chat_id ON public.telegram_links (chat_id);
CREATE INDEX idx_telegram_links_link_code ON public.telegram_links (link_code);

ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own telegram link"
ON public.telegram_links FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own telegram link"
ON public.telegram_links FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own telegram link"
ON public.telegram_links FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own telegram link"
ON public.telegram_links FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_telegram_links_updated_at
BEFORE UPDATE ON public.telegram_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Singleton offset tracker for getUpdates polling (service-role only)
CREATE TABLE public.telegram_bot_state (
  id INT PRIMARY KEY CHECK (id = 1),
  update_offset BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0);

ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;
-- No policies = no client access; only service role can read/write

-- Raw incoming updates (for debugging, auto-cleanup)
CREATE TABLE public.telegram_messages (
  update_id BIGINT PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  text TEXT,
  raw_update JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_messages_chat_id ON public.telegram_messages (chat_id);
CREATE INDEX idx_telegram_messages_created_at ON public.telegram_messages (created_at);

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;
-- No policies = service-role only
