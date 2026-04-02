import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from '../types/database.types';

export function displayNameFromUser(user: User): string {
  const meta = user.user_metadata?.full_name;
  if (typeof meta === 'string' && meta.trim()) return meta.trim();
  if (user.email) return user.email.split('@')[0] || 'User';
  return 'User';
}

/** Upsert `profiles` for the signed-in user (auth.uid() must equal userId). Role defaults to `user`. */
export async function upsertProfileForUserId(
  userId: string,
  fullName: string,
  role: 'user' | 'admin' = 'user'
) {
  return supabase.from('profiles').upsert(
    { id: userId, full_name: fullName.trim() || 'User', role },
    { onConflict: 'id' }
  );
}

/**
 * Fetch profile or insert one (id = auth.users id, role = user) if missing.
 * Call only when there is a valid session so RLS allows insert.
 */
export async function loadOrCreateProfile(user: User): Promise<Profile | null> {
  const { data: existing, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .eq('id', user.id)
    .maybeSingle();

  if (fetchErr) {
    console.warn('loadOrCreateProfile fetch:', fetchErr);
    return null;
  }
  if (existing) return existing as Profile;

  const full_name = displayNameFromUser(user);
  const { data: inserted, error: insertErr } = await supabase
    .from('profiles')
    .insert({ id: user.id, full_name, role: 'user' })
    .select('id, full_name, role, created_at')
    .single();

  if (!insertErr && inserted) return inserted as Profile;

  if (insertErr) {
    console.warn('loadOrCreateProfile insert:', insertErr);
    const { data: retry } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .eq('id', user.id)
      .maybeSingle();
    if (retry) return retry as Profile;
  }
  return null;
}
