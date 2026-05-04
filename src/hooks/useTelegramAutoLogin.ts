import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramWebApp, getTelegramWebAppRaw } from "@/hooks/useTelegramWebApp";
import { AUTH_SESSION_SET_EVENT } from "@/hooks/useAuth";

type Status = "idle" | "trying" | "linked" | "not-linked" | "error";

/**
 * If running inside Telegram and no Supabase user is signed in,
 * try auto-login using verified initData.
 *
 * The Telegram SDK script may not have populated `initData` on the very first
 * render — we poll briefly (up to ~3s) before giving up.
 */
export function useTelegramAutoLogin(hasUser: boolean) {
  const [status, setStatus] = useState<Status>("idle");
  const [tgName, setTgName] = useState<string>("");
  const [isTelegram, setIsTelegram] = useState<boolean>(() => !!getTelegramWebAppRaw());
  const triedRef = useRef(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (hasUser || triedRef.current || inFlightRef.current) return;

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // ~3s @100ms

    const tick = async () => {
      if (cancelled) return;
      attempts++;
      const wa = getTelegramWebApp();
      const waRaw = getTelegramWebAppRaw();

      if (waRaw) setIsTelegram(true);

      if (!wa) {
        if (attempts >= MAX_ATTEMPTS) {
          // Not in Telegram, or initData never arrived — fall through to normal Auth screen
          console.log("[tg-autologin] no initData after polling");
          return;
        }
        setTimeout(tick, 100);
        return;
      }

      triedRef.current = true;
      inFlightRef.current = true;
      const u = wa.initDataUnsafe?.user;
      if (u) setTgName(u.first_name || u.username || "");
      setStatus("trying");

      try {
        console.log("[tg-autologin] invoking telegram-webapp-auth");
        const { data, error } = await supabase.functions.invoke("telegram-webapp-auth", {
          body: { initData: wa.initData },
        });
        if (cancelled) return;
        if (error) {
          console.error("[tg-autologin] function error", error);
          setStatus("error");
          return;
        }
        if (data?.linked && data.access_token && data.refresh_token) {
          console.log("[tg-autologin] linked, setting session");
          const { error: setErr } = await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });
          const { data: { session } } = await supabase.auth.getSession();
          if (setErr) {
            console.error("[tg-autologin] setSession failed", setErr);
            setStatus("error");
            return;
          }
          window.dispatchEvent(new CustomEvent(AUTH_SESSION_SET_EVENT, { detail: { session } }));
          setStatus("linked");
        } else {
          console.log("[tg-autologin] not linked", data);
          setStatus("not-linked");
        }
      } catch (e) {
        console.error("[tg-autologin] unexpected error", e);
        if (!cancelled) setStatus("error");
      } finally {
        inFlightRef.current = false;
      }
    };

    tick();
    return () => { cancelled = true; };
  }, [hasUser]);

  return { status, tgName, isTelegram };
}
