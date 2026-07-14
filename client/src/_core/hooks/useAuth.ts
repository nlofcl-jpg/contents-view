import { getLoginUrl } from "@/const";
import {
  isSupabaseConfigured,
  normalizeSupabaseUser,
  supabase,
  type AppAuthUser,
} from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const [user, setUser] = useState<AppAuthUser | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<Error | null>(null);

  const logout = useCallback(async () => {
    if (!supabase) {
      setUser(null);
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      throw signOutError;
    }
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setUser(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    const { data, error: sessionError } = await supabase.auth.getSession();
    setLoading(false);

    if (sessionError) {
      setError(sessionError);
      setUser(null);
      return null;
    }

    const nextUser = data.session?.user
      ? normalizeSupabaseUser(data.session.user)
      : null;
    setError(null);
    setUser(nextUser);
    return nextUser;
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!isMounted) return;
        if (sessionError) {
          setError(sessionError);
          setUser(null);
        } else {
          setError(null);
          setUser(
            data.session?.user
              ? normalizeSupabaseUser(data.session.user)
              : null,
          );
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setError(null);
        setUser(session?.user ? normalizeSupabaseUser(session.user) : null);
        setLoading(false);
      },
    );

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const state = useMemo(() => {
    localStorage.setItem(
      "contents-view-user-info",
      JSON.stringify(user)
    );
    return {
      user,
      loading,
      error,
      isAuthenticated: Boolean(user),
    };
  }, [error, loading, user]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (loading) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    loading,
    state.user,
  ]);

  return {
    ...state,
    refresh,
    logout,
  };
}
