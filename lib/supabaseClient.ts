import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string;
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          avatar_url: string | null;
          role: 'user' | 'superadmin';
          plan: 'unsubscribed' | 'starter' | 'professional';
          credits: number;
          signup_bonus_remaining: number;
          stripe_customer_id: string | null;
          suspended_at: string | null;
          created_at: string;
          last_active_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['users']['Row']>;
        Update: Partial<Database['public']['Tables']['users']['Row']>;
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          plan: 'studio' | 'enterprise';
          credits: number;
          seat_limit: number;
          extra_credits_purchased: number;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          created_at: string;
        };
      };
      organization_members: {
        Row: {
          org_id: string;
          user_id: string;
          role: 'owner' | 'admin' | 'member';
          joined_at: string;
        };
      };
      org_invites: {
        Row: {
          id: string;
          org_id: string;
          email: string;
          role: 'admin' | 'member';
          token: string;
          invited_by: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
      };
      usage_log: {
        Row: {
          id: string;
          user_id: string;
          org_id: string | null;
          mode: string;
          credits_used: number;
          used_bonus: boolean;
          output_url: string | null;
          created_at: string;
        };
      };
      video_charges: {
        Row: {
          id: string;
          user_id: string;
          org_id: string | null;
          model: string;
          duration_seconds: number;
          amount_cents: number;
          stripe_payment_intent_id: string | null;
          status: 'pending' | 'succeeded' | 'failed';
          created_at: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          entity_type: 'user' | 'org';
          entity_id: string;
          stripe_subscription_id: string;
          plan: string;
          status: string;
          credits_per_period: number;
          current_period_start: string;
          current_period_end: string;
          created_at: string;
          updated_at: string;
        };
      };
      credit_adjustments: {
        Row: {
          id: string;
          entity_type: 'user' | 'org';
          entity_id: string;
          amount: number;
          reason: string;
          performed_by: string;
          created_at: string;
        };
      };
    };
  };
};
