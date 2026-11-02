import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import type { DriverProfileRecord } from '../../database/schema';

export interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  vehicleType?: DriverProfileRecord['vehicle_type'];
  vehiclePlate?: string;
  primaryCorridor?: string;
  dailyTargetMinorUnits?: number;
}

export interface AuthResult {
  success: boolean;
  user?: User | null;
  session?: Session | null;
  error?: string | null;
  needsEmailConfirmation?: boolean;
}

/**
 * Register a new driver with email and password in Supabase Auth.
 * Driver metadata is attached to the auth user and automatically
 * initializes the cloud profiles & user_settings tables via Postgres triggers.
 */
export async function signUpWithEmail(params: SignUpParams): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase client is not configured.' };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: params.email.trim(),
      password: params.password,
      options: {
        data: {
          full_name: params.fullName.trim(),
          phone: params.phone?.trim() || '',
          vehicle_type: params.vehicleType || 'MINIBUS_TAXI',
          vehicle_plate: params.vehiclePlate?.trim() || '',
          primary_corridor: params.primaryCorridor?.trim() || '',
          daily_target_minor_units: params.dailyTargetMinorUnits || 200000,
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Check if email confirmation is required or if session was immediately created
    const hasSession = Boolean(data.session);
    const user = data.user;

    // If user is logged in, ensure profile row exists with driver details
    if (user && hasSession) {
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: params.fullName.trim(),
        sms_greeting_name: params.fullName.trim().split(/\s+/)[0] || 'Driver',
        phone: params.phone?.trim() || null,
        vehicle_type: params.vehicleType || 'MINIBUS_TAXI',
        vehicle_plate: params.vehiclePlate?.trim() || null,
        primary_corridor: params.primaryCorridor?.trim() || null,
        daily_target_minor_units: params.dailyTargetMinorUnits || 200000,
        updated_at: new Date().toISOString(),
      });
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
      needsEmailConfirmation: !hasSession,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'An unexpected error occurred during signup.' };
  }
}

/**
 * Sign in an existing driver with email and password.
 */
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase client is not configured.' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'An unexpected error occurred during signin.' };
  }
}

/**
 * Sign out current driver from Supabase.
 */
export async function signOutUser(): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error signing out.' };
  }
}

/**
 * Request password reset email for driver account recovery.
 */
export async function resetPasswordForEmail(email: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase client is not configured.' };
  }

  try {
    const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error requesting password reset.' };
  }
}

/**
 * Get current session from persistent storage or Supabase Auth.
 */
export async function getCurrentSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
}

/**
 * Get current authenticated user.
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Subscribe to Supabase authentication state changes.
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null, user: User | null) => void
) {
  if (!isSupabaseConfigured()) {
    return { unsubscribe: () => {} };
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session, session?.user ?? null);
  });

  return {
    unsubscribe: () => subscription.unsubscribe(),
  };
}
