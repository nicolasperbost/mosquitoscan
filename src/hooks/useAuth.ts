import { useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

/**
 * Thin wrapper around Supabase Auth. Deliberately minimal: email/password
 * only for now (no OAuth providers configured), since the goal here is a
 * working foundation for per-account cloud sync, not a full auth UX.
 *
 * NOTE: I have not been able to confirm whether email confirmation is
 * required on this Supabase project (a dashboard setting, not something
 * visible from code) — if it's enabled, signUp() will succeed but the user
 * won't be able to sign in until they click a confirmation email. Worth
 * checking in Supabase dashboard → Authentication → Providers → Email
 * before relying on immediate sign-in-after-signup working smoothly.
 */
export function useAuth(): AuthState & {
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
} {
  const [state, setState] = useState<AuthState>({ user: null, session: null, loading: true });

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState({ user: data.session?.user ?? null, session: data.session, loading: false });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState({ user: session?.user ?? null, session, loading: false });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { ...state, signUp, signIn, signOut };
}
