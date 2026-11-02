import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';

const defaultUrl = 'https://pxvhyixdgwatokkvmxqj.supabase.co';
const defaultKey = 'sb_publishable_XeHR2_qoi5aJwkegJay9lg_BqKcdw1e';

const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL);

const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY);

export const SUPABASE_URL = envUrl || defaultUrl;
export const SUPABASE_ANON_KEY = envKey || defaultKey;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
