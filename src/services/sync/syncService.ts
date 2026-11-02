import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient';
import type { Database } from '../../types/database.types';
import type {
  TripRecord,
  TransactionRecord,
  SmsProcessingRecord,
  DriverProfileRecord,
  AppSettings,
} from '../../database/schema';
import type { DatabaseState } from '../../database/database';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncResult {
  success: boolean;
  syncedTripsCount: number;
  syncedTransactionsCount: number;
  syncedClassificationsCount: number;
  errors: string[];
  lastSyncedAt?: string;
}

/**
 * Check if browser/device currently has internet connectivity.
 */
export function isNetworkAvailable(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

/**
 * Push pending local records (trips, transactions, audit classifications, profile, settings)
 * up to Supabase with user_id attached.
 */
export async function syncPush(
  userId: string,
  localState: DatabaseState
): Promise<{
  syncedTripIds: string[];
  syncedTransactionIds: string[];
  syncedClassificationIds: string[];
  errors: string[];
}> {
  if (!isSupabaseConfigured()) {
    return {
      syncedTripIds: [],
      syncedTransactionIds: [],
      syncedClassificationIds: [],
      errors: ['Supabase is not configured'],
    };
  }

  if (!isNetworkAvailable()) {
    return {
      syncedTripIds: [],
      syncedTransactionIds: [],
      syncedClassificationIds: [],
      errors: ['Device is currently offline'],
    };
  }

  const errors: string[] = [];
  const syncedTripIds: string[] = [];
  const syncedTransactionIds: string[] = [];
  const syncedClassificationIds: string[] = [];

  // 1. Sync Driver Profile (Only if local profile has valid name and is not guest)
  try {
    const profile = localState.driverProfile;
    if (profile && profile.full_name && profile.full_name.trim().length > 0 && profile.id !== 'driver_guest') {
      const profilePayload: any = {
        id: userId,
        full_name: profile.full_name.trim(),
        sms_greeting_name: profile.sms_greeting_name || null,
        phone: profile.telebirr_phone || null,
        account_type: profile.account_type || null,
        vehicle_type: profile.vehicle_type || null,
        vehicle_plate: profile.vehicle_plate || null,
        primary_corridor: profile.primary_corridor || null,
        sub_city: profile.sub_city || null,
        daily_target_minor_units: profile.daily_target_minor_units || null,
        driver_license_number: profile.driver_license_number || null,
        updated_at: new Date().toISOString(),
      };
      if (profile.username && profile.username.trim().length > 0) {
        profilePayload.username = profile.username.trim().toLowerCase();
      }
      const { error: profileError } = await supabase.from('profiles').upsert(profilePayload);
      if (profileError) {
        errors.push(`Profile sync error: ${profileError.message}`);
      }
    }
  } catch (err: any) {
    errors.push(`Profile sync exception: ${err.message}`);
  }

  // 2. Sync User Settings
  try {
    const s = localState.settings;
    if (s) {
      const { error: settingsError } = await supabase.from('user_settings').upsert({
        user_id: userId,
        app_name: s.app_name || 'TripBirr',
        notification_sound: s.notification_sound ?? true,
        notification_vibration: s.notification_vibration ?? true,
        voice_announcement: s.voice_announcement ?? true,
        notification_preview: s.notification_preview ?? true,
        silent_mode: s.silent_mode ?? false,
        auto_suggest_trip_association: s.auto_suggest_trip_association ?? true,
        currency_display: s.currency_display || 'ETB',
        language: s.language || 'en',
        theme: s.theme || 'dark',
        privacy_hide_balance: s.privacy_hide_balance ?? false,
        privacy_mask_sender_names: s.privacy_mask_sender_names ?? false,
        privacy_mask_phones: s.privacy_mask_phones ?? false,
        privacy_hide_popup_amounts: s.privacy_hide_popup_amounts ?? false,
        updated_at: new Date().toISOString(),
      });
      if (settingsError) {
        errors.push(`Settings sync error: ${settingsError.message}`);
      }
    }
  } catch (err: any) {
    errors.push(`Settings sync exception: ${err.message}`);
  }

  // 3. Sync Trips
  // Collect trips that are either PENDING, FAILED, or missing sync_status
  const pendingTrips = localState.trips.filter(
    (t) => !t.sync_status || t.sync_status === 'PENDING' || t.sync_status === 'FAILED'
  );

  if (pendingTrips.length > 0) {
    for (const trip of pendingTrips) {
      try {
        const { error: tripError } = await supabase.from('trips').upsert({
          id: trip.id,
          user_id: userId,
          start_location_name: trip.start_location_name,
          start_latitude: trip.start_latitude ?? null,
          start_longitude: trip.start_longitude ?? null,
          start_location_accuracy: trip.start_location_accuracy ?? null,
          start_location_source: trip.start_location_source || 'MANUAL',
          start_time: trip.start_time,
          end_location_name: trip.end_location_name ?? null,
          end_latitude: trip.end_latitude ?? null,
          end_longitude: trip.end_longitude ?? null,
          end_location_accuracy: trip.end_location_accuracy ?? null,
          end_location_source: trip.end_location_source ?? null,
          end_time: trip.end_time ?? null,
          duration: trip.duration ?? null,
          status: trip.status,
          notes: trip.notes ?? null,
          route_distance_meters: trip.route_distance_meters ?? null,
          route_polyline: (trip.route_polyline as any) ?? null,
          route_source: trip.route_source ?? null,
          created_at: trip.created_at || new Date().toISOString(),
          updated_at: trip.updated_at || new Date().toISOString(),
          version: (trip.version ?? 1) + 1,
        });

        if (tripError) {
          errors.push(`Trip ${trip.id} sync error: ${tripError.message}`);
        } else {
          syncedTripIds.push(trip.id);
        }
      } catch (err: any) {
        errors.push(`Trip ${trip.id} exception: ${err.message}`);
      }
    }
  }

  // 4. Sync Transactions
  // Collect transactions that are either PENDING, FAILED, or missing sync_status
  const pendingTxs = localState.transactions.filter(
    (tx) => !tx.sync_status || tx.sync_status === 'PENDING' || tx.sync_status === 'FAILED'
  );

  if (pendingTxs.length > 0) {
    for (const tx of pendingTxs) {
      try {
        // Ensure that if trip_id exists, the trip is valid or null
        const tripExists = tx.trip_id ? localState.trips.some((t) => t.id === tx.trip_id) : false;
        const validTripId = tripExists ? tx.trip_id : null;

        const { error: txError } = await supabase.from('transactions').upsert({
          id: tx.id,
          user_id: userId,
          trip_id: validTripId,
          transaction_id: tx.transaction_id ?? null,
          transaction_type: tx.transaction_type,
          payment_method: tx.payment_method,
          amount_minor_units: tx.amount_minor_units,
          currency: tx.currency || 'ETB',
          sender_name: tx.sender_name ?? null,
          sender_phone: tx.sender_phone ?? null,
          recipient_name: tx.recipient_name ?? null,
          transaction_date: tx.transaction_date,
          iso_date: tx.iso_date,
          transaction_time: tx.transaction_time,
          account_balance_minor_units: tx.account_balance_minor_units ?? null,
          sms_sender: tx.sms_sender || '127',
          transaction_status: tx.transaction_status,
          original_transaction_id: tx.original_transaction_id ?? null,
          description: tx.description ?? null,
          created_at: tx.created_at || new Date().toISOString(),
          updated_at: tx.updated_at || new Date().toISOString(),
          version: (tx.version ?? 1) + 1,
        });

        if (txError) {
          errors.push(`Transaction ${tx.id} sync error: ${txError.message}`);
        } else {
          syncedTransactionIds.push(tx.id);
        }
      } catch (err: any) {
        errors.push(`Transaction ${tx.id} exception: ${err.message}`);
      }
    }
  }

  // 5. Sync SMS Classifications (Redacted audit log - NEVER raw SMS content)
  const pendingLogs = (localState.smsProcessingRecords || []).filter(
    (log) => !log.sync_status || log.sync_status === 'PENDING' || log.sync_status === 'FAILED'
  );

  if (pendingLogs.length > 0) {
    for (const log of pendingLogs) {
      try {
        const { error: logError } = await supabase.from('payment_classifications').upsert({
          id: log.id,
          user_id: userId,
          sender_id: log.sender_id || '127',
          message_fingerprint: log.message_fingerprint,
          classification: log.classification,
          processing_status: log.processing_status,
          received_at: log.received_at,
          processed_at: log.processed_at,
          summary_note: log.summary_note ?? null,
          updated_at: new Date().toISOString(),
        });

        if (logError) {
          errors.push(`Classification ${log.id} sync error: ${logError.message}`);
        } else {
          syncedClassificationIds.push(log.id);
        }
      } catch (err: any) {
        errors.push(`Classification ${log.id} exception: ${err.message}`);
      }
    }
  }

  return {
    syncedTripIds,
    syncedTransactionIds,
    syncedClassificationIds,
    errors,
  };
}

/**
 * Pull cloud records for this driver from Supabase and merge them into the local database.
 * Resolves conflicts by preserving local pending edits or adopting newer cloud versions.
 */
export async function syncPull(
  userId: string,
  localState: DatabaseState
): Promise<{
  mergedState: DatabaseState;
  downloadedTripsCount: number;
  downloadedTransactionsCount: number;
  downloadedClassificationsCount: number;
  errors: string[];
}> {
  if (!isSupabaseConfigured() || !isNetworkAvailable()) {
    return {
      mergedState: localState,
      downloadedTripsCount: 0,
      downloadedTransactionsCount: 0,
      downloadedClassificationsCount: 0,
      errors: ['Network unavailable or Supabase unconfigured'],
    };
  }

  const errors: string[] = [];
  let nextState: DatabaseState = { ...localState };

  // 1. Fetch Cloud Profile
  try {
    const { data: cloudProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      errors.push(`Pull profile error: ${profileErr.message}`);
    } else if (cloudProfile) {
      nextState.driverProfile = {
        ...nextState.driverProfile,
        username: cloudProfile.username || nextState.driverProfile.username,
        full_name: cloudProfile.full_name || nextState.driverProfile.full_name,
        sms_greeting_name: cloudProfile.sms_greeting_name || nextState.driverProfile.sms_greeting_name,
        telebirr_phone: cloudProfile.phone || nextState.driverProfile.telebirr_phone,
        vehicle_type: (cloudProfile.vehicle_type as any) || nextState.driverProfile.vehicle_type,
        vehicle_plate: cloudProfile.vehicle_plate || nextState.driverProfile.vehicle_plate,
        primary_corridor: cloudProfile.primary_corridor || nextState.driverProfile.primary_corridor,
        sub_city: cloudProfile.sub_city || nextState.driverProfile.sub_city,
        daily_target_minor_units: cloudProfile.daily_target_minor_units ?? nextState.driverProfile.daily_target_minor_units,
        driver_license_number: cloudProfile.driver_license_number || nextState.driverProfile.driver_license_number,
        updated_at: cloudProfile.updated_at || nextState.driverProfile.updated_at,
      };
    }
  } catch (err: any) {
    errors.push(`Pull profile exception: ${err.message}`);
  }

  // 2. Fetch Cloud Settings
  try {
    const { data: cloudSettings, error: settingsErr } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (settingsErr) {
      errors.push(`Pull settings error: ${settingsErr.message}`);
    } else if (cloudSettings) {
      nextState.settings = {
        ...nextState.settings,
        notification_sound: cloudSettings.notification_sound ?? nextState.settings.notification_sound,
        notification_vibration: cloudSettings.notification_vibration ?? nextState.settings.notification_vibration,
        voice_announcement: cloudSettings.voice_announcement ?? nextState.settings.voice_announcement,
        notification_preview: cloudSettings.notification_preview ?? nextState.settings.notification_preview,
        silent_mode: cloudSettings.silent_mode ?? nextState.settings.silent_mode,
        auto_suggest_trip_association: cloudSettings.auto_suggest_trip_association ?? nextState.settings.auto_suggest_trip_association,
        currency_display: (cloudSettings.currency_display as any) || nextState.settings.currency_display,
        language: (cloudSettings.language as any) || nextState.settings.language,
        theme: (cloudSettings.theme as any) || nextState.settings.theme,
        privacy_hide_balance: cloudSettings.privacy_hide_balance ?? nextState.settings.privacy_hide_balance,
        privacy_mask_sender_names: cloudSettings.privacy_mask_sender_names ?? nextState.settings.privacy_mask_sender_names,
        privacy_mask_phones: cloudSettings.privacy_mask_phones ?? nextState.settings.privacy_mask_phones,
        privacy_hide_popup_amounts: cloudSettings.privacy_hide_popup_amounts ?? nextState.settings.privacy_hide_popup_amounts,
      };
    }
  } catch (err: any) {
    errors.push(`Pull settings exception: ${err.message}`);
  }

  // 3. Fetch Cloud Trips
  let downloadedTripsCount = 0;
  try {
    const { data: cloudTrips, error: tripsErr } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    if (tripsErr) {
      errors.push(`Pull trips error: ${tripsErr.message}`);
    } else if (cloudTrips) {
      downloadedTripsCount = cloudTrips.length;
      const localTripMap = new Map<string, TripRecord>(nextState.trips.map((t) => [t.id, t]));

      for (const ct of cloudTrips) {
        const localTrip = localTripMap.get(ct.id);
        const mappedTrip: TripRecord = {
          id: ct.id,
          start_location_name: ct.start_location_name,
          start_latitude: ct.start_latitude,
          start_longitude: ct.start_longitude,
          start_location_accuracy: ct.start_location_accuracy,
          start_location_source: (ct.start_location_source as any) || 'MANUAL',
          start_time: ct.start_time,
          end_location_name: ct.end_location_name,
          end_latitude: ct.end_latitude,
          end_longitude: ct.end_longitude,
          end_location_accuracy: ct.end_location_accuracy,
          end_location_source: (ct.end_location_source as any) || null,
          end_time: ct.end_time,
          duration: ct.duration,
          status: ct.status as any,
          notes: ct.notes,
          route_distance_meters: ct.route_distance_meters,
          route_polyline: (ct.route_polyline as any) || null,
          route_source: ct.route_source as any,
          created_at: ct.created_at,
          updated_at: ct.updated_at,
          sync_status: 'SYNCED',
          synced_at: new Date().toISOString(),
          version: ct.version,
        };

        if (!localTrip) {
          // New record from cloud (e.g. from second device)
          localTripMap.set(ct.id, mappedTrip);
        } else if (localTrip.sync_status !== 'PENDING') {
          // Local record was not pending edits, update with cloud version if newer
          const cloudTime = new Date(ct.updated_at).getTime();
          const localTime = new Date(localTrip.updated_at).getTime();
          if (cloudTime >= localTime || (ct.version || 0) >= (localTrip.version || 0)) {
            localTripMap.set(ct.id, mappedTrip);
          }
        }
      }

      nextState.trips = Array.from(localTripMap.values()).sort(
        (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );
    }
  } catch (err: any) {
    errors.push(`Pull trips exception: ${err.message}`);
  }

  // 4. Fetch Cloud Transactions
  let downloadedTransactionsCount = 0;
  try {
    const { data: cloudTxs, error: txsErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('iso_date', { ascending: false });

    if (txsErr) {
      errors.push(`Pull transactions error: ${txsErr.message}`);
    } else if (cloudTxs) {
      downloadedTransactionsCount = cloudTxs.length;
      const localTxMap = new Map<string, TransactionRecord>(nextState.transactions.map((tx) => [tx.id, tx]));

      for (const ctx of cloudTxs) {
        const localTx = localTxMap.get(ctx.id);
        const mappedTx: TransactionRecord = {
          id: ctx.id,
          trip_id: ctx.trip_id,
          transaction_id: ctx.transaction_id,
          transaction_type: ctx.transaction_type as any,
          payment_method: ctx.payment_method as any,
          amount_minor_units: ctx.amount_minor_units,
          currency: ctx.currency,
          sender_name: ctx.sender_name,
          sender_phone: ctx.sender_phone,
          recipient_name: ctx.recipient_name,
          transaction_date: ctx.transaction_date,
          iso_date: ctx.iso_date,
          transaction_time: ctx.transaction_time,
          account_balance_minor_units: ctx.account_balance_minor_units,
          sms_sender: ctx.sms_sender,
          transaction_status: ctx.transaction_status as any,
          original_transaction_id: ctx.original_transaction_id,
          description: ctx.description,
          created_at: ctx.created_at,
          updated_at: ctx.updated_at,
          sync_status: 'SYNCED',
          synced_at: new Date().toISOString(),
          version: ctx.version,
        };

        if (!localTx) {
          // New record from cloud
          localTxMap.set(ctx.id, mappedTx);
        } else if (localTx.sync_status !== 'PENDING') {
          const cloudTime = new Date(ctx.updated_at).getTime();
          const localTime = new Date(localTx.updated_at).getTime();
          if (cloudTime >= localTime || (ctx.version || 0) >= (localTx.version || 0)) {
            localTxMap.set(ctx.id, mappedTx);
          }
        }
      }

      nextState.transactions = Array.from(localTxMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
  } catch (err: any) {
    errors.push(`Pull transactions exception: ${err.message}`);
  }

  // 5. Fetch Cloud Classifications
  let downloadedClassificationsCount = 0;
  try {
    const { data: cloudLogs, error: logsErr } = await supabase
      .from('payment_classifications')
      .select('*')
      .eq('user_id', userId)
      .order('received_at', { ascending: false });

    if (logsErr) {
      errors.push(`Pull classifications error: ${logsErr.message}`);
    } else if (cloudLogs) {
      downloadedClassificationsCount = cloudLogs.length;
      const localLogMap = new Map<string, SmsProcessingRecord>(
        (nextState.smsProcessingRecords || []).map((l) => [l.id, l])
      );

      for (const cl of cloudLogs) {
        if (!localLogMap.has(cl.id)) {
          localLogMap.set(cl.id, {
            id: cl.id,
            sender_id: cl.sender_id,
            message_fingerprint: cl.message_fingerprint,
            classification: cl.classification as any,
            processing_status: cl.processing_status as any,
            received_at: cl.received_at,
            processed_at: cl.processed_at,
            error_message: null,
            summary_note: cl.summary_note,
            sync_status: 'SYNCED',
            synced_at: new Date().toISOString(),
          });
        }
      }

      nextState.smsProcessingRecords = Array.from(localLogMap.values()).sort(
        (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
      );
    }
  } catch (err: any) {
    errors.push(`Pull classifications exception: ${err.message}`);
  }

  return {
    mergedState: nextState,
    downloadedTripsCount,
    downloadedTransactionsCount,
    downloadedClassificationsCount,
    errors,
  };
}

/**
 * Coordinate full bidirectional synchronization:
 * 1. Push pending local changes to cloud
 * 2. Mark successfully pushed local items as 'SYNCED'
 * 3. Pull cloud updates and merge into local state
 * 4. Update sync timestamp and sync status
 */
export async function performFullSync(
  userId: string,
  currentState: DatabaseState
): Promise<{
  updatedState: DatabaseState;
  result: SyncResult;
}> {
  if (!isSupabaseConfigured()) {
    return {
      updatedState: currentState,
      result: {
        success: false,
        syncedTripsCount: 0,
        syncedTransactionsCount: 0,
        syncedClassificationsCount: 0,
        errors: ['Supabase is not configured'],
      },
    };
  }

  if (!isNetworkAvailable()) {
    return {
      updatedState: currentState,
      result: {
        success: false,
        syncedTripsCount: 0,
        syncedTransactionsCount: 0,
        syncedClassificationsCount: 0,
        errors: ['No internet connection'],
      },
    };
  }

  const allErrors: string[] = [];

  // Step 1: Push
  const pushRes = await syncPush(userId, currentState);
  allErrors.push(...pushRes.errors);

  // Update local sync status for pushed items
  const now = new Date().toISOString();
  const stateAfterPush: DatabaseState = {
    ...currentState,
    trips: currentState.trips.map((t) =>
      pushRes.syncedTripIds.includes(t.id)
        ? { ...t, sync_status: 'SYNCED', synced_at: now }
        : t
    ),
    transactions: currentState.transactions.map((tx) =>
      pushRes.syncedTransactionIds.includes(tx.id)
        ? { ...tx, sync_status: 'SYNCED', synced_at: now }
        : tx
    ),
    smsProcessingRecords: (currentState.smsProcessingRecords || []).map((log) =>
      pushRes.syncedClassificationIds.includes(log.id)
        ? { ...log, sync_status: 'SYNCED', synced_at: now }
        : log
    ),
  };

  // Step 2: Pull and Merge
  const pullRes = await syncPull(userId, stateAfterPush);
  allErrors.push(...pullRes.errors);

  const finalState: DatabaseState = {
    ...pullRes.mergedState,
    settings: {
      ...pullRes.mergedState.settings,
      cloud_sync_enabled: true,
      last_synced_at: now,
      cloud_user_id: userId,
    },
  };

  return {
    updatedState: finalState,
    result: {
      success: allErrors.length === 0,
      syncedTripsCount: pushRes.syncedTripIds.length + pullRes.downloadedTripsCount,
      syncedTransactionsCount: pushRes.syncedTransactionIds.length + pullRes.downloadedTransactionsCount,
      syncedClassificationsCount: pushRes.syncedClassificationIds.length + pullRes.downloadedClassificationsCount,
      errors: allErrors,
      lastSyncedAt: now,
    },
  };
}

/**
 * Migration helper for first-time account registration:
 * Uploads all existing local trips, transactions, and settings to the new Supabase account.
 */
export async function migrateLocalDataOnRegistration(
  userId: string,
  currentState: DatabaseState,
  profileUpdates?: Partial<DriverProfileRecord>
): Promise<{
  updatedState: DatabaseState;
  result: SyncResult;
}> {
  // Mark all existing local records as pending sync for the new cloud account
  const stateToMigrate: DatabaseState = {
    ...currentState,
    driverProfile: {
      ...currentState.driverProfile,
      ...(profileUpdates || {}),
      updated_at: new Date().toISOString(),
    },
    trips: currentState.trips.map((t) => ({
      ...t,
      sync_status: 'PENDING',
    })),
    transactions: currentState.transactions.map((tx) => ({
      ...tx,
      sync_status: 'PENDING',
    })),
    smsProcessingRecords: (currentState.smsProcessingRecords || []).map((l) => ({
      ...l,
      sync_status: 'PENDING',
    })),
  };

  return performFullSync(userId, stateToMigrate);
}

/**
 * Data restoration helper for second device sign-in:
 * Downloads all historical trips, transactions, audit logs, and settings from Supabase.
 */
export async function restoreCloudDataOnLogin(
  userId: string,
  currentState: DatabaseState
): Promise<{
  updatedState: DatabaseState;
  result: SyncResult;
}> {
  return performFullSync(userId, currentState);
}
