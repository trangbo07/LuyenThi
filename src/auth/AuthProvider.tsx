import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { signOutReliably } from '../lib/signOutReliably';
import type { Profile } from '../types/database.types';
import { AuthContext } from './auth-context';
import type { AuthState } from './auth-context';

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .eq('id', userId)
    .single();

  if (error) return null;
  return (data as Profile) || null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) {
      setProfile(null);
      return;
    }
    const p = await fetchProfile(u.id);
    setProfile(p);
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        const p = await fetchProfile(data.session.user.id);
        if (!mounted) return;
        setProfile(p);
      } else {
        setProfile(null);
      }
      setLoading(false);
    })();

    // Avoid async callback: Supabase awaits callback; defer profile fetch to prevent lock issues.
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (event === 'SIGNED_OUT' || !nextSession?.user) {
        setProfile(null);
        return;
      }
      const uid = nextSession.user.id;
      void fetchProfile(uid).then((p) => {
        if (!mounted) return;
        setProfile(p);
      });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await signOutReliably();
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthState>(() => {
    return {
      session,
      user,
      profile,
      role: profile?.role ?? null,
      loading,
      signOut,
      refreshProfile
    };
  }, [session, user, profile, loading, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
