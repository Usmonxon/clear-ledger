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

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  const wa = window.Telegram?.WebApp;
  // initData is empty when the SDK script loads outside Telegram
  if (!wa || !wa.initData) return null;
  return wa;
}

export function useTelegramWebApp() {
  const [webApp] = useState<TelegramWebApp | null>(() => getTelegramWebApp());

  useEffect(() => {
    if (!webApp) return;
    try {
      webApp.ready();
      webApp.expand();
      // Match app's dark theme
      webApp.setHeaderColor("#09090b");
      webApp.setBackgroundColor("#09090b");
    } catch (e) {
      console.error("Telegram WebApp init error", e);
    }
  }, [webApp]);

  return { webApp, isTelegram: !!webApp };
}
