import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '../types/database.types';

export type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: 'admin' | 'user' | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);
