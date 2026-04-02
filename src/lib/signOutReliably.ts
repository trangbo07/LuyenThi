import { supabase } from './supabase';
import { clearSupabaseAuthStorage } from './clearSupabaseAuthStorage';

/**
 * Reliable sign-out: Supabase signOut() returns { error } (does not throw).
 * If POST /logout fails, _removeSession may not run — tokens can remain in storage.
 * Always wipe storage last; local signOut helps sync the client.
 */
export async function signOutReliably(): Promise<void> {
  const { error: errGlobal } = await supabase.auth.signOut({ scope: 'global' });
  if (errGlobal) {
    console.warn('signOut global:', errGlobal.message);
  }

  const { error: errLocal } = await supabase.auth.signOut({ scope: 'local' });
  if (errLocal) {
    console.warn('signOut local:', errLocal.message);
  }

  clearSupabaseAuthStorage();
}
