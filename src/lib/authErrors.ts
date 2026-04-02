/** User-facing text for Supabase Auth / network failures */
export function formatAuthError(error: Error | { message?: string } | null | undefined): string {
  if (!error) return 'Something went wrong.';
  const raw = ('message' in error && error.message) ? String(error.message) : 'Something went wrong.';
  const msg = raw.toLowerCase();

  if (msg.includes('invalid api key') || msg.includes('jwt') || msg.includes('invalid jwt')) {
    return 'Supabase keys are missing or wrong. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file (local) or hosting env (production), then rebuild.';
  }
  if (msg.includes('fetch') || msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Cannot reach Supabase. Check your internet connection and that VITE_SUPABASE_URL is correct.';
  }
  // Supabase Auth: built-in email has hourly limits (signup / magic link / reset).
  if (
    msg.includes('rate limit') ||
    msg.includes('email rate') ||
    msg.includes('429') ||
    msg.includes('too many requests') ||
    msg.includes('giới hạn') ||
    msg.includes('vượt quá') ||
    (msg.includes('email') && msg.includes('limit'))
  ) {
    return 'Email sending limit reached (Supabase caps confirmation emails per hour). Wait 30–60 minutes and try again, or in Supabase turn off “Confirm email” for testing (Authentication → Providers → Email), or add custom SMTP on a paid plan for higher limits.';
  }
  if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already registered')) {
    return 'This email is already registered. Sign in instead, or use another email.';
  }
  if (msg.includes('database error saving new user')) {
    return 'Supabase could not create your profile. In the SQL Editor, run migrations for profiles and the handle_new_user trigger. Also confirm Email provider is enabled under Authentication → Providers.';
  }
  if ((msg.includes('signup') && msg.includes('disabled')) || msg.includes('signups not allowed')) {
    return 'New sign-ups are turned off. In Supabase: Authentication → Providers → Email → enable sign ups.';
  }
  if (msg.includes('password') && (msg.includes('at least') || msg.includes('least 6'))) {
    return 'Password must be at least 6 characters.';
  }
  if (msg.includes('row-level security') || msg.includes('violates row-level security')) {
    return 'Database blocked this action (RLS). Check policies on public.profiles or run the project migrations.';
  }
  if (msg.includes('email') && msg.includes('invalid')) {
    return 'Please enter a valid email address.';
  }

  return raw;
}
