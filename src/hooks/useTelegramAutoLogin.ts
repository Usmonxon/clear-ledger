import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramWebApp } from "@/hooks/useTelegramWebApp";

type Status = "idle" | "trying" | "linked" | "not-linked" | "error";

/**
 * If running inside Telegram and no Supabase user is signed in,
 * try auto-login using verified initData.
 * Returns the current attempt status so the Auth screen can show context.
 */
export function useTelegramAutoLogin(hasUser: boolean) {
  const [status, setStatus] = useState<Status>("idle");
  const [tgName, setTgName] = useState<string>("");
  const triedRef = useRef(false);

  useEffect(() => {
    if (hasUser || triedRef.current) return;
    const wa = getTelegramWebApp();
    if (!wa) return;
    triedRef.current = true;

    const initData = wa.initData;
    const u = wa.initDataUnsafe?.user;
    if (u) setTgName(u.first_name || u.username || "");

    setStatus("trying");
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("telegram-webapp-auth", {
          body: { initData },
        });
        if (error) throw error;
        if (data?.linked && data.access_token && data.refresh_token) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });
          if (setErr) throw setErr;
          setStatus("linked");
        } else {
          setStatus("not-linked");
        }
      } catch (e) {
        console.error("Telegram auto-login failed", e);
        setStatus("error");
      }
    })();
  }, [hasUser]);

  return { status, tgName, isTelegram: !!getTelegramWebApp() };
}
