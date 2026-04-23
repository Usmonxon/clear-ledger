import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Send, Copy, Unlink, RefreshCw, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const BOT_USERNAME = "finco_updbot";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function TelegramTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: link, isLoading } = useQuery({
    queryKey: ["telegram_link", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_links")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: (q) => (q.state.data && !q.state.data.linked_at ? 4000 : false),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const code = generateCode();
      const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      if (link) {
        const { error } = await supabase
          .from("telegram_links")
          .update({ link_code: code, link_code_expires_at: expires })
          .eq("id", link.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("telegram_links").insert({
          user_id: user!.id,
          link_code: code,
          link_code_expires_at: expires,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["telegram_link"] }),
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async (patch: { notify_on_new_tx?: boolean; daily_digest?: boolean }) => {
      const { error } = await supabase.from("telegram_links").update(patch).eq("id", link!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["telegram_link"] }),
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("telegram_links")
        .update({ chat_id: null, linked_at: null, link_code: null, link_code_expires_at: null })
        .eq("id", link!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["telegram_link"] });
      toast({ title: "Telegram отвязан" });
    },
  });

  if (isLoading) return <p className="text-xs text-muted-foreground">Загрузка...</p>;

  const isLinked = !!link?.linked_at && !!link?.chat_id;
  const hasCode = !isLinked && link?.link_code;
  const deepLink = link?.link_code ? `https://t.me/${BOT_USERNAME}?start=${link.link_code}` : "";

  const copyCode = () => {
    if (!link?.link_code) return;
    navigator.clipboard.writeText(`/start ${link.link_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted/50 rounded-md text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Что умеет бот @{BOT_USERNAME}:</p>
        <p>📊 Отчёты по балансам, дневные и месячные сводки</p>
        <p>📦 Резервная копия всех данных в Excel по запросу</p>
        <p>🔔 Уведомления о новых операциях и утренний дайджест</p>
      </div>

      {isLinked ? (
        <>
          <div className="border rounded-md bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-income" />
                <div>
                  <p className="text-sm font-medium">Telegram подключён</p>
                  <p className="text-[10px] text-muted-foreground">
                    chat_id: <span className="font-mono">{link.chat_id}</span>
                    {link.linked_at && ` · ${new Date(link.linked_at).toLocaleDateString("ru-RU")}`}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="bg-income-muted text-income border-income/20 text-[10px]">
                Активен
              </Badge>
            </div>
          </div>

          <div className="border rounded-md bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Уведомления о новых операциях</p>
                <p className="text-[10px] text-muted-foreground">Сообщение в Telegram сразу после добавления операции</p>
              </div>
              <Switch
                checked={!!link.notify_on_new_tx}
                onCheckedChange={(v) => toggleMutation.mutate({ notify_on_new_tx: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Утренний дайджест</p>
                <p className="text-[10px] text-muted-foreground">Сводка за вчера каждое утро</p>
              </div>
              <Switch
                checked={!!link.daily_digest}
                onCheckedChange={(v) => toggleMutation.mutate({ daily_digest: v })}
              />
            </div>
          </div>

          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => unlinkMutation.mutate()}>
            <Unlink className="h-3.5 w-3.5 mr-1" />
            Отвязать Telegram
          </Button>
        </>
      ) : hasCode ? (
        <div className="border rounded-md bg-card p-4 space-y-3">
          <p className="text-sm font-medium">Шаг 1. Откройте бота в Telegram</p>
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs underline text-primary"
          >
            <Send className="h-3.5 w-3.5" />
            t.me/{BOT_USERNAME}?start={link!.link_code}
          </a>

          <div className="pt-2">
            <p className="text-sm font-medium mb-1">Шаг 2. Или отправьте боту команду</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-2 py-1.5 bg-muted rounded text-xs font-mono">/start {link!.link_code}</code>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={copyCode}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Код действует 30 минут. Эта страница автоматически обновится после привязки.
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Сгенерировать новый код
          </Button>
        </div>
      ) : (
        <Button onClick={() => generateMutation.mutate()} size="sm" className="h-8 text-xs" disabled={generateMutation.isPending}>
          <Send className="h-3.5 w-3.5 mr-1" />
          Подключить Telegram
        </Button>
      )}
    </div>
  );
}
