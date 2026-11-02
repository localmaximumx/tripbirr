import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';
import type { DriverProfileRecord } from '../../database/schema';

export interface SignUpParams {
  email?: string;
  password?: string;
  pin?: string;
  fullName: string;
  phone: string;
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
 * Check if the device has an active internet connection.
 */
export function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

/**
 * Normalize an Ethiopian phone number to standard format.
 * E.g. "091 234 8747", "912348747", "+251912348747" -> "251912348747"
 */
export function normalizeEthiopianPhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('251') && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `251${digits.slice(1)}`;
  }
  if (digits.startsWith('9') && digits.length === 9) {
    return `251${digits}`;
  }
  return digits || '251900000000';
}

/**
 * Generate a deterministic cloud auth email for a driver's phone number.
 */
export function getDriverAuthEmail(phone: string): string {
  const normalized = normalizeEthiopianPhone(phone);
  return `driver_${normalized}@tripbirr.et`;
}

/**
 * Ensure passwords/PINs meet cloud length requirements (at least 6 characters).
 */
export function formatCloudAuthPassword(pinOrPassword: string): string {
  const trimmed = (pinOrPassword || '').trim();
  if (trimmed.length >= 6) {
    return trimmed;
  }
  return `PIN_${trimmed}_TB2026!`;
}

/**
 * Register a new driver in the cloud database.
 * Requires active internet connection so profile info is automatically created in database.
 * Default vehicle, plate, target, and route are attached if not provided.
 */
export async function signUpDriver(params: SignUpParams): Promise<AuthResult> {
  if (!isOnline()) {
    return {
      success: false,
      error: 'Internet connection is required to create a new driver account. Please turn on mobile data or Wi-Fi.',
    };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Cloud service is currently unavailable.' };
  }

  const cleanPhone = normalizeEthiopianPhone(params.phone);
  const authEmail = params.email?.trim() || getDriverAuthEmail(cleanPhone);
  const secret = formatCloudAuthPassword(params.password || params.pin || '1234');

  const defaultVehicleType = params.vehicleType || 'MINIBUS_TAXI';
  const defaultPlate = params.vehiclePlate?.trim() || 'Code 3 - A58291 AA';
  const defaultRoute = params.primaryCorridor?.trim() || 'Bole ↔ Megenagna / Piassa';
  const defaultTarget = params.dailyTargetMinorUnits || 150000;

  try {
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: secret,
      options: {
        data: {
          full_name: params.fullName.trim(),
          phone: cleanPhone,
          vehicle_type: defaultVehicleType,
          vehicle_plate: defaultPlate,
          primary_corridor: defaultRoute,
          daily_target_minor_units: defaultTarget,
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const user = data.user;
    let session = data.session;

    // If session wasn't returned directly on signup (e.g. email confirmation setting),
    // immediately sign in the newly registered user to get session and render app
    if (!session && user) {
      const signInRes = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: secret,
      });
      if (signInRes.data.session) {
        session = signInRes.data.session;
      }
    }

    // Ensure database profile row exists
    if (user) {
      const firstName = params.fullName.trim().split(/\s+/)[0] || 'Driver';
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: params.fullName.trim(),
        sms_greeting_name: firstName,
        phone: cleanPhone,
        vehicle_type: defaultVehicleType,
        vehicle_plate: defaultPlate,
        primary_corridor: defaultRoute,
        daily_target_minor_units: defaultTarget,
        updated_at: new Date().toISOString(),
      });
    }

    return {
      success: true,
      user,
      session,
      needsEmailConfirmation: false,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error creating cloud account.' };
  }
}

/**
 * Sign in an existing driver.
 * Checks the database for matching driver credentials (Name, Phone, or Email with PIN).
 */
export async function signInDriver(
  identifier: string,
  pinOrPassword: string
): Promise<AuthResult> {
  const trimmedId = (identifier || '').trim();
  const secret = formatCloudAuthPassword(pinOrPassword);

  if (!isSupabaseConfigured() || !isOnline()) {
    return {
      success: false,
      error: 'Device is offline. Please connect to internet to sign in to your cloud account.',
    };
  }

  try {
    // 1. If identifier contains '@', sign in directly as email
    if (trimmedId.includes('@')) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedId,
        password: pinOrPassword.length >= 6 ? pinOrPassword : secret,
      });
      if (!error && data.session) {
        return { success: true, user: data.user, session: data.session };
      }
    }

    // 2. Try normalized phone number
    const normalizedPhone = normalizeEthiopianPhone(trimmedId);
    const phoneEmail = getDriverAuthEmail(normalizedPhone);

    const { data: phoneAuthData, error: phoneAuthError } = await supabase.auth.signInWithPassword({
      email: phoneEmail,
      password: secret,
    });

    if (!phoneAuthError && phoneAuthData.session) {
      return { success: true, user: phoneAuthData.user, session: phoneAuthData.session };
    }

    // 3. Check database profiles by name or phone
    const { data: matchedProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .or(`phone.eq.${normalizedPhone},full_name.ilike.%${trimmedId}%`)
      .limit(1);

    if (matchedProfiles && matchedProfiles.length > 0) {
      const matched = matchedProfiles[0];
      const matchedEmail = matched.phone
        ? getDriverAuthEmail(matched.phone)
        : `driver_${matched.id}@tripbirr.et`;

      const { data: matchedAuthData, error: matchedAuthError } = await supabase.auth.signInWithPassword({
        email: matchedEmail,
        password: secret,
      });

      if (!matchedAuthError && matchedAuthData.session) {
        return { success: true, user: matchedAuthData.user, session: matchedAuthData.session };
      }
    }

    return {
      success: false,
      error: 'Incorrect Name or PIN. Please check your credentials or create an account.',
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error signing in.' };
  }
}

/**
 * Sign out current driver from cloud session.
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
 * Request password reset instructions for account recovery.
 */
export async function resetPasswordForEmail(email: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Cloud service is currently unavailable.' };
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
 * Get current session from persistent storage or Auth.
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
 * Subscribe to cloud authentication state changes.
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
