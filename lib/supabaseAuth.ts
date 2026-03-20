import { supabase } from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  role: 'user' | 'superadmin';
  plan: 'unsubscribed' | 'starter' | 'professional';
  credits: number;
  signup_bonus_remaining: number;
  org: {
    id: string;
    name: string;
    plan: 'studio' | 'enterprise';
    credits: number;
    seat_limit: number;
    role: 'owner' | 'admin' | 'member';
  } | null;
}

// Owner account — always superadmin regardless of what the DB row says
const OWNER_EMAIL = 'matija.lekovic@gmail.com';

/** Fetch full user profile from public.users + org membership */
export async function fetchAppUser(userId: string): Promise<AppUser | null> {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !user) return null;

  // Check org membership
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role, organizations(*)')
    .eq('user_id', userId)
    .maybeSingle();

  const org = membership?.organizations as any;

  // Hardcoded owner privileges — client-side guarantee regardless of DB state
  const isOwner = user.email === OWNER_EMAIL;

  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email.split('@')[0],
    avatar_url: user.avatar_url || '',
    role: (isOwner ? 'superadmin' : user.role) as AppUser['role'],
    plan: (isOwner ? 'professional' : user.plan) as AppUser['plan'],
    credits: isOwner ? Math.max(user.credits, 10000) : user.credits,
    signup_bonus_remaining: user.signup_bonus_remaining,
    org: org
      ? {
          id: org.id,
          name: org.name,
          plan: org.plan,
          credits: org.credits,
          seat_limit: org.seat_limit,
          role: membership!.role as 'owner' | 'admin' | 'member',
        }
      : null,
  };
}

/** Sign in with Google OAuth */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw new Error(error.message);
}

/** Sign in with email + password */
export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

/** Sign up with email + password */
export async function signUpWithEmail(email: string, password: string, name: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) throw new Error(error.message);
}

/** Send password reset email */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}?reset=true`,
  });
  if (error) throw new Error(error.message);
}

/** Update password (called after reset link) */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

/** Sign out */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Get current Supabase session */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Get current Supabase JWT (access token) to send to the Worker */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token ?? null;
}

export type { Session, User };
