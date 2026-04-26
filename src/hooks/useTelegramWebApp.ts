import { useEffect, useState } from "react";

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramUser; start_param?: string };
  themeParams: Record<string, string>;
  colorScheme: "light" | "dark";
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  HapticFeedback?: { impactOccurred: (s: string) => void };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** Returns the WebApp instance only if we're actually running inside Telegram (initData present). */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  const wa = window.Telegram?.WebApp;
  if (!wa || !wa.initData) return null;
  return wa;
}

/** Returns the WebApp instance even if initData is empty (still in a Telegram-like host). */
export function getTelegramWebAppRaw(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

export function useTelegramWebApp() {
  const [webApp] = useState<TelegramWebApp | null>(() => getTelegramWebApp());

  useEffect(() => {
    if (!webApp) return;
    try {
      webApp.ready();
      webApp.expand();
      webApp.setHeaderColor("#09090b");
      webApp.setBackgroundColor("#09090b");
    } catch (e) {
      console.error("Telegram WebApp init error", e);
    }
  }, [webApp]);

  return { webApp, isTelegram: !!webApp };
}
