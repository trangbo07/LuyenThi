/**
 * Remove Supabase auth data from the browser (localStorage + sessionStorage).
 * Keys are usually like sb-<project-ref>-auth-token; may include PKCE / realtime.
 */
export function clearSupabaseAuthStorage() {
  if (typeof window === 'undefined') return;

  const shouldRemove = (k: string) => {
    const lower = k.toLowerCase();
    return (
      k.startsWith('sb-') ||
      lower.includes('supabase') ||
      lower.includes('auth-token') ||
      lower.includes('pkce') ||
      lower.includes('gotrue')
    );
  };

  const wipe = (store: Storage) => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k) keys.push(k);
      }
      for (const k of keys) {
        if (shouldRemove(k)) store.removeItem(k);
      }
    } catch {
      /* ignore */
    }
  };

  wipe(localStorage);
  wipe(sessionStorage);
}
