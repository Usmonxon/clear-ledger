import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface AuthProps {
  telegram?: { name: string; status: "idle" | "trying" | "linked" | "not-linked" | "error" };
}

export default function Auth({ telegram }: AuthProps = {}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email },
          },
        });
        if (error) throw error;
        // Update company_name in profile after signup
        if (companyName) {
          // Profile is created by trigger; we'll update it after session is established
        }
        toast({
          title: "Проверьте почту",
          description: "Мы отправили ссылку для подтверждения на ваш email.",
        });
      }
    } catch (err: unknown) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "Произошла ошибка",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="h-8 w-8 rounded bg-income flex items-center justify-center">
            <span className="text-income-foreground font-bold text-sm">F</span>
          </div>
          <div>
            <h1 className="text-base font-semibold">FinanceERP</h1>
            <p className="text-[10px] text-muted-foreground">Управление финансами</p>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6 space-y-4">
          {telegram && (
            <div className="rounded-md border border-income/30 bg-income/10 p-3 text-xs">
              <div className="font-semibold text-foreground mb-1">
                Привет{telegram.name ? `, ${telegram.name}` : ""}! 👋
              </div>
              <div className="text-muted-foreground">
                {telegram.status === "not-linked" || telegram.status === "error"
                  ? "Этот Telegram ещё не связан с аккаунтом Finco. Войдите ниже один раз — в следующий раз вход будет автоматическим."
                  : "Подключаем ваш Telegram к Finco..."}
              </div>
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold">
              {mode === "login" ? "Вход в систему" : "Регистрация"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mode === "login"
                ? "Введите данные вашего аккаунта"
                : "Создайте новый аккаунт"}
            </p>
          </div>


          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Имя</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ваше имя"
                    className="h-9 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Компания</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Название компании"
                    className="h-9 text-sm mt-1"
                  />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="h-9 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Пароль</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="h-9 text-sm mt-1"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-9 text-sm bg-income hover:bg-income/90 text-income-foreground"
            >
              {loading ? "Загрузка..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
            </Button>
          </form>

          <div className="text-center text-xs text-muted-foreground">
            {mode === "login" ? (
              <>
                Нет аккаунта?{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="text-foreground underline underline-offset-2 hover:text-income transition-colors"
                >
                  Зарегистрироваться
                </button>
              </>
            ) : (
              <>
                Уже есть аккаунт?{" "}
                <button
                  onClick={() => setMode("login")}
                  className="text-foreground underline underline-offset-2 hover:text-income transition-colors"
                >
                  Войти
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
