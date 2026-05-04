import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export const AUTH_SESSION_SET_EVENT = "finco:auth-session-set";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    const handleSessionSet = (event: Event) => {
      const session = (event as CustomEvent<{ session?: Session | null }>).detail?.session;
      if (session?.user) {
        setUser(session.user);
        setLoading(false);
        return;
      }
      void syncSession();
    };

    // Set up listener BEFORE getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    window.addEventListener(AUTH_SESSION_SET_EVENT, handleSessionSet);

    void syncSession();

    return () => {
      window.removeEventListener(AUTH_SESSION_SET_EVENT, handleSessionSet);
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
