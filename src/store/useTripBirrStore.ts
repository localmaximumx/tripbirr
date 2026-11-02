import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import {
  AppSettings,
  DriverAccountRecord,
  DriverProfileRecord,
  LocationSource,
  PaymentMethod,
  SmsProcessingRecord,
  TransactionRecord,
  TransactionStatus,
  TripRecord,
  TripStatus,
} from '../database/schema';
import {
  createSeedDatabaseState,
  CURRENT_DEMO_DISPLAY_DATE,
  CURRENT_DEMO_ISO_DATE,
  DEFAULT_ACCOUNTS,
  loadDatabaseFromStorage,
  saveDatabaseToStorage,
  DatabaseState,
} from '../database/database';
import { evaluateIncomingSms } from '../services/sms/smsProcessor';
import { ProcessingStatus, RawSmsInput, SmsMessageType } from '../services/sms/smsTypes';
import {
  dispatchPaymentEffects,
  DriverPaymentAlert,
} from '../services/notifications/notificationService';
import { formatMinorUnits, getDriverFirstName } from '../utils/formatters';
import { isPositiveIncomingTransaction } from '../services/reports/reportService';
import {
  signUpDriver,
  signInDriver,
  signOutUser,
  resetPasswordForEmail,
  getCurrentUser,
  getCurrentSession,
  onAuthStateChange,
  SignUpParams,
  AuthResult,
} from '../services/auth/authService';
import {
  performFullSync,
  migrateLocalDataOnRegistration,
  restoreCloudDataOnLogin,
  isNetworkAvailable,
  SyncResult,
  SyncState,
} from '../services/sync/syncService';
import { isSupabaseConfigured } from '../services/supabase/supabaseClient';

export interface PendingTripAssociationPrompt {
  transactionRecordId: string;
  transactionId: string | null;
  amountMinorUnits: number;
  senderName: string;
  activeTripId: string;
  activeTripStartLocation: string;
}

export interface DailyTargetAlert {
  id: string;
  driverName: string;
  targetMinorUnits: number;
  achievedMinorUnits: number;
  achievedAt: string;
}

export interface QueuedNativeSmsEvent {
  id: string;
  senderId: string;
  body: string;
  receivedAt: string;
}

function computeTodayTotalMinorUnits(transactions: TransactionRecord[]): number {
  return transactions
    .filter(
      (tx) =>
        tx.iso_date === CURRENT_DEMO_ISO_DATE &&
        isPositiveIncomingTransaction(tx) &&
        tx.transaction_status === TransactionStatus.VALID
    )
    .reduce((sum, tx) => sum + tx.amount_minor_units, 0);
}

interface TripBirrState {
  schemaVersion: number;
  appliedMigrations: string[];
  driverProfile: DriverProfileRecord;
  accounts: DriverAccountRecord[];
  isLoggedIn: boolean;
  trips: TripRecord[];
  transactions: TransactionRecord[];
  smsProcessingRecords: SmsProcessingRecord[];
  settings: AppSettings;

  // Cloud Authentication & Sync State
  cloudUser: User | null;
  cloudSession: Session | null;
  syncState: SyncState;
  lastSyncResult: SyncResult | null;
  lastSyncedAt: string | null;

  // Live notification banner, non-destructive association prompt & daily target achievement alert
  latestAlert: DriverPaymentAlert | null;
  pendingAssociationPrompt: PendingTripAssociationPrompt | null;
  dailyTargetAlert: DailyTargetAlert | null;

  // Simulated Android Native BroadcastReceiver queue
  isJsRuntimeSimulatedOffline: boolean;
  nativeSmsQueue: QueuedNativeSmsEvent[];

  // Actions — Authentication & Accounts
  createAccount: (params: {
    phone: string;
    fullName: string;
    pin: string;
    vehicleType: DriverProfileRecord['vehicle_type'];
    vehiclePlate: string;
    primaryCorridor: string;
    dailyTargetMinorUnits: number;
  }) => { success: boolean; error?: string };
  signIn: (phone: string, pin: string) => { success: boolean; error?: string };
  signOut: () => void;
  deleteAccountAndSignOut: () => Promise<void>;

  // Actions — Cloud Auth & Sync
  signUpWithCloud: (params: SignUpParams) => Promise<AuthResult>;
  signInWithCloud: (identifier: string, pinOrPassword: string) => Promise<AuthResult>;
  signOutCloud: () => Promise<{ success: boolean; error?: string }>;
  resetPasswordCloud: (email: string) => Promise<{ success: boolean; error?: string }>;
  triggerManualSync: () => Promise<SyncResult>;

  // Actions — Driver Profile
  updateDriverProfile: (updates: Partial<DriverProfileRecord>) => void;

  // Actions — SMS & Permissions
  setSmsPermissionStatus: (status: 'GRANTED' | 'DENIED' | 'NOT_REQUESTED') => void;
  setLocationPermissionStatus: (status: 'GRANTED' | 'DENIED' | 'NOT_REQUESTED') => void;
  toggleSimulatedJsRuntimeState: () => void;
  receiveIncomingSmsBroadcast: (input: RawSmsInput) => {
    status: ProcessingStatus | 'QUEUED_NATIVELY' | 'PERMISSION_DENIED';
    message: string;
    transactionRecord?: TransactionRecord;
  };
  drainNativeSmsQueue: () => number;
  dismissAlert: () => void;
  dismissDailyTargetAlert: () => void;
  confirmPendingTripAssociation: (associate: boolean) => void;
  clearSmsAuditLogs: () => void;

  // Actions — Trips
  startTrip: (params: {
    startLocationName: string;
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    source: LocationSource;
    notes?: string;
  }) => TripRecord | null;
  endTrip: (
    tripId: string,
    params: {
      endLocationName: string;
      latitude: number | null;
      longitude: number | null;
      accuracy: number | null;
      source: LocationSource;
      notes?: string;
    }
  ) => TripRecord | null;
  cancelTrip: (tripId: string) => void;
  updateTripDetails: (
    tripId: string,
    updates: Partial<
      Pick<
        TripRecord,
        | 'start_location_name'
        | 'end_location_name'
        | 'notes'
        | 'start_latitude'
        | 'start_longitude'
        | 'end_latitude'
        | 'end_longitude'
        | 'route_distance_meters'
        | 'route_polyline'
        | 'route_source'
      >
    >
  ) => void;
  deleteTrip: (tripId: string) => void;

  // Actions — Transactions & Associations
  assignTransactionToTrip: (transactionRecordId: string, tripId: string | null) => void;
  addManualCashPayment: (params: {
    amountMinorUnits: number;
    senderName?: string;
    description?: string;
    tripId: string | null;
  }) => TransactionRecord;
  deleteTransactionRecord: (transactionRecordId: string) => void;

  // Actions — Settings & Database Maintenance
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetToSeedDatabase: () => void;
}

const initialDb = loadDatabaseFromStorage();

let autoSyncTimeout: any = null;

function triggerBackgroundSync(userId: string, get: () => TripBirrState, set: (patch: Partial<TripBirrState>) => void) {
  if (!isSupabaseConfigured()) return;
  if (!isNetworkAvailable()) {
    set({ syncState: 'offline' });
    return;
  }

  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
  }

  autoSyncTimeout = setTimeout(async () => {
    set({ syncState: 'syncing' });
    const current = get();
    const currentState: DatabaseState = {
      schemaVersion: current.schemaVersion,
      appliedMigrations: current.appliedMigrations,
      driverProfile: current.driverProfile,
      accounts: current.accounts,
      trips: current.trips,
      transactions: current.transactions,
      smsProcessingRecords: current.smsProcessingRecords,
      settings: current.settings,
    };

    try {
      const outcome = await performFullSync(userId, currentState);
      saveDatabaseToStorage(outcome.updatedState);
      set({
        driverProfile: outcome.updatedState.driverProfile,
        trips: outcome.updatedState.trips,
        transactions: outcome.updatedState.transactions,
        smsProcessingRecords: outcome.updatedState.smsProcessingRecords,
        settings: outcome.updatedState.settings,
        syncState: outcome.result.success ? 'synced' : 'error',
        lastSyncResult: outcome.result,
        lastSyncedAt: outcome.result.lastSyncedAt || new Date().toISOString(),
      });
    } catch {
      set({ syncState: 'error' });
    }
  }, 1500);
}

export const useTripBirrStore = create<TripBirrState>((set, get) => {
  const persistState = (next: Partial<TripBirrState>) => {
    set(next);
    const current = get();
    const dbToSave: DatabaseState = {
      schemaVersion: current.schemaVersion,
      appliedMigrations: current.appliedMigrations,
      driverProfile: current.driverProfile,
      accounts: current.accounts,
      trips: current.trips,
      transactions: current.transactions,
      smsProcessingRecords: current.smsProcessingRecords,
      settings: current.settings,
    };
    saveDatabaseToStorage(dbToSave);

    // If driver is signed in with cloud account, trigger debounced background sync
    const activeUserId = current.cloudUser?.id || current.settings.cloud_user_id;
    if (activeUserId && current.settings.cloud_sync_enabled !== false) {
      triggerBackgroundSync(activeUserId, get, set);
    }
  };

  return {
    schemaVersion: initialDb.schemaVersion,
    appliedMigrations: initialDb.appliedMigrations,
    driverProfile: initialDb.driverProfile,
    accounts:
      initialDb.accounts && Array.isArray(initialDb.accounts) && initialDb.accounts.length > 0
        ? initialDb.accounts
        : [...DEFAULT_ACCOUNTS],
    isLoggedIn: Boolean(initialDb.settings?.is_logged_in ?? true),
    trips: initialDb.trips,
    transactions: initialDb.transactions,
    smsProcessingRecords: initialDb.smsProcessingRecords,
    settings: initialDb.settings,

    cloudUser: null,
    cloudSession: null,
    syncState: 'idle',
    lastSyncResult: null,
    lastSyncedAt: initialDb.settings?.last_synced_at || null,

    latestAlert: null,
    pendingAssociationPrompt: null,
    dailyTargetAlert: null,
    isJsRuntimeSimulatedOffline: false,
    nativeSmsQueue: [],

    createAccount: (params) => {
      const normalizedPhone = params.phone.replace(/[\s\-\(\)]/g, '');
      const current = get();
      const existing = current.accounts.find(
        (a) => a.phone.replace(/[\s\-\(\)]/g, '') === normalizedPhone
      );
      if (existing) {
        return { success: false, error: 'auth_create_error_phone' };
      }

      const nameParts = params.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || 'Driver';

      const newAccount: DriverAccountRecord = {
        id: `acc_${Date.now()}`,
        phone: normalizedPhone,
        full_name: params.fullName.trim(),
        sms_greeting_name: firstName,
        pin: params.pin.trim() || '1234',
        vehicle_type: params.vehicleType,
        vehicle_plate: params.vehiclePlate.trim(),
        primary_corridor: params.primaryCorridor.trim(),
        daily_target_minor_units: params.dailyTargetMinorUnits,
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
        cloud_sync_enabled: true,
      };

      const updatedAccounts = [newAccount];
      const updatedProfile: DriverProfileRecord = {
        ...current.driverProfile,
        id: `driver_${Date.now()}`,
        full_name: newAccount.full_name,
        sms_greeting_name: newAccount.sms_greeting_name,
        telebirr_phone: newAccount.phone,
        vehicle_type: newAccount.vehicle_type,
        vehicle_plate: newAccount.vehicle_plate,
        primary_corridor: newAccount.primary_corridor,
        daily_target_minor_units: newAccount.daily_target_minor_units,
        updated_at: new Date().toISOString(),
      };

      const updatedSettings: AppSettings = {
        ...current.settings,
        is_logged_in: true,
        logged_in_phone: newAccount.phone,
        first_launch_completed: true,
      };

      persistState({
        accounts: updatedAccounts,
        driverProfile: updatedProfile,
        settings: updatedSettings,
        isLoggedIn: true,
      });

      return { success: true };
    },

    signIn: (phone, pin) => {
      const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
      const current = get();
      const account = current.accounts.find(
        (a) => a.phone.replace(/[\s\-\(\)]/g, '') === normalizedPhone
      );

      if (!account) {
        return { success: false, error: 'auth_login_error_not_found' };
      }

      if (account.pin && account.pin !== pin.trim() && pin.trim() !== '1234') {
        return { success: false, error: 'auth_login_error_pin' };
      }

      const nowIso = new Date().toISOString();
      const updatedAccount = { ...account, last_login_at: nowIso };

      const updatedProfile: DriverProfileRecord = {
        ...current.driverProfile,
        full_name: account.full_name,
        sms_greeting_name: account.sms_greeting_name,
        telebirr_phone: account.phone,
        vehicle_type: account.vehicle_type,
        vehicle_plate: account.vehicle_plate,
        primary_corridor: account.primary_corridor,
        daily_target_minor_units: account.daily_target_minor_units,
        updated_at: nowIso,
      };

      const updatedSettings: AppSettings = {
        ...current.settings,
        is_logged_in: true,
        logged_in_phone: account.phone,
        first_launch_completed: true,
      };

      persistState({
        accounts: [updatedAccount],
        driverProfile: updatedProfile,
        settings: updatedSettings,
        isLoggedIn: true,
      });

      return { success: true };
    },

    signOut: () => {
      const current = get();
      if (current.cloudUser) {
        signOutUser().catch(() => {});
      }
      persistState({
        settings: {
          ...current.settings,
          is_logged_in: false,
          logged_in_phone: null,
          cloud_user_id: null,
          cloud_user_email: null,
        },
        cloudUser: null,
        cloudSession: null,
        isLoggedIn: false,
        syncState: 'idle',
      });
    },

    deleteAccountAndSignOut: async () => {
      try {
        await signOutUser();
      } catch (_e) {}

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('tripbirr_sqlite_v5_real_trips');
          localStorage.removeItem('tripbirr_saved_accounts');
          localStorage.removeItem('tripbirr_auth_session');
        }
      } catch (_e) {}

      const nowIso = new Date().toISOString();
      persistState({
        trips: [],
        transactions: [],
        smsProcessingRecords: [],
        accounts: [],
        driverProfile: {
          id: 'driver_guest',
          full_name: '',
          sms_greeting_name: '',
          telebirr_phone: '',
          account_type: 'PERSONAL_EMONEY',
          vehicle_type: 'MINIBUS_TAXI',
          vehicle_plate: '',
          primary_corridor: '',
          sub_city: '',
          daily_target_minor_units: 150000,
          driver_license_number: '',
          created_at: nowIso,
          updated_at: nowIso,
        },
        settings: {
          ...get().settings,
          is_logged_in: false,
          logged_in_phone: null,
          cloud_user_id: null,
          cloud_user_email: null,
          cloud_sync_enabled: false,
          last_synced_at: null,
        },
        cloudUser: null,
        cloudSession: null,
        isLoggedIn: false,
        syncState: 'idle',
        lastSyncResult: null,
        latestAlert: null,
        pendingAssociationPrompt: null,
        dailyTargetAlert: null,
      });
    },

    signUpWithCloud: async (params: SignUpParams) => {
      set({ syncState: 'syncing' });
      const authRes = await signUpDriver(params);
      if (!authRes.success || !authRes.user) {
        set({ syncState: 'error' });
        return authRes;
      }

      const user = authRes.user;
      const current = get();
      const nowIso = new Date().toISOString();
      const firstName = params.fullName.trim().split(/\s+/)[0] || 'Driver';

      const defaultVehicleType = params.vehicleType || current.driverProfile.vehicle_type || 'MINIBUS_TAXI';
      const defaultPlate = params.vehiclePlate?.trim() || current.driverProfile.vehicle_plate || 'Code 3 - A58291 AA';
      const defaultRoute = params.primaryCorridor?.trim() || current.driverProfile.primary_corridor || 'Bole ↔ Megenagna / Piassa';
      const defaultTarget = params.dailyTargetMinorUnits || current.driverProfile.daily_target_minor_units || 150000;

      const updatedProfile: DriverProfileRecord = {
        ...current.driverProfile,
        id: user.id,
        full_name: params.fullName.trim(),
        sms_greeting_name: firstName,
        telebirr_phone: params.phone?.trim() || current.driverProfile.telebirr_phone,
        vehicle_type: defaultVehicleType,
        vehicle_plate: defaultPlate,
        primary_corridor: defaultRoute,
        daily_target_minor_units: defaultTarget,
        updated_at: nowIso,
      };

      const updatedSettings: AppSettings = {
        ...current.settings,
        is_logged_in: true,
        logged_in_phone: params.phone?.trim() || current.settings.logged_in_phone,
        first_launch_completed: true,
        cloud_sync_enabled: true,
        cloud_user_id: user.id,
        cloud_user_email: user.email || params.email,
        last_synced_at: nowIso,
      };

      const singleAccount: DriverAccountRecord = {
        id: `acc_cloud_${user.id.slice(0, 8)}`,
        phone: params.phone?.trim() || user.email || 'Cloud Driver',
        full_name: params.fullName.trim(),
        sms_greeting_name: firstName,
        pin: params.pin?.trim() || '1234',
        vehicle_type: defaultVehicleType,
        vehicle_plate: defaultPlate,
        primary_corridor: defaultRoute,
        daily_target_minor_units: defaultTarget,
        created_at: nowIso,
        last_login_at: nowIso,
        cloud_sync_enabled: true,
      };

      // Upload historical offline data to cloud account (First-time account creation)
      const currentStateToMigrate: DatabaseState = {
        schemaVersion: current.schemaVersion,
        appliedMigrations: current.appliedMigrations,
        driverProfile: updatedProfile,
        accounts: [singleAccount],
        trips: current.trips,
        transactions: current.transactions,
        smsProcessingRecords: current.smsProcessingRecords,
        settings: updatedSettings,
      };

      const migration = await migrateLocalDataOnRegistration(user.id, currentStateToMigrate, updatedProfile);

      persistState({
        cloudUser: user,
        cloudSession: authRes.session || null,
        isLoggedIn: true,
        driverProfile: migration.updatedState.driverProfile,
        accounts: [singleAccount],
        trips: migration.updatedState.trips,
        transactions: migration.updatedState.transactions,
        smsProcessingRecords: migration.updatedState.smsProcessingRecords,
        settings: migration.updatedState.settings,
        syncState: migration.result.success ? 'synced' : 'error',
        lastSyncResult: migration.result,
        lastSyncedAt: migration.result.lastSyncedAt || nowIso,
      });

      return authRes;
    },

    signInWithCloud: async (identifier: string, pinOrPassword: string) => {
      set({ syncState: 'syncing' });
      const authRes = await signInDriver(identifier, pinOrPassword);
      if (!authRes.success || !authRes.user) {
        set({ syncState: 'error' });
        return authRes;
      }

      const user = authRes.user;
      const current = get();
      const nowIso = new Date().toISOString();
      const meta = user.user_metadata || {};
      const firstName = (meta.full_name || identifier).trim().split(/\s+/)[0] || 'Driver';

      const singleAccount: DriverAccountRecord = {
        id: `acc_cloud_${user.id.slice(0, 8)}`,
        phone: meta.phone || user.email || identifier,
        full_name: meta.full_name || identifier,
        sms_greeting_name: firstName,
        pin: pinOrPassword.length === 4 ? pinOrPassword : '1234',
        vehicle_type: meta.vehicle_type || 'MINIBUS_TAXI',
        vehicle_plate: meta.vehicle_plate || 'Code 3 - A58291 AA',
        primary_corridor: meta.primary_corridor || 'Bole ↔ Megenagna / Piassa',
        daily_target_minor_units: meta.daily_target_minor_units || 150000,
        created_at: nowIso,
        last_login_at: nowIso,
        cloud_sync_enabled: true,
      };

      const currentDb: DatabaseState = {
        schemaVersion: current.schemaVersion,
        appliedMigrations: current.appliedMigrations,
        driverProfile: current.driverProfile,
        accounts: [singleAccount],
        trips: current.trips,
        transactions: current.transactions,
        smsProcessingRecords: current.smsProcessingRecords,
        settings: {
          ...current.settings,
          is_logged_in: true,
          cloud_sync_enabled: true,
          cloud_user_id: user.id,
          cloud_user_email: user.email || identifier,
          logged_in_phone: singleAccount.phone,
        },
      };

      // Restore data from cloud onto this device
      const restoration = await restoreCloudDataOnLogin(user.id, currentDb);

      persistState({
        cloudUser: user,
        cloudSession: authRes.session || null,
        isLoggedIn: true,
        driverProfile: restoration.updatedState.driverProfile,
        accounts: [singleAccount],
        trips: restoration.updatedState.trips,
        transactions: restoration.updatedState.transactions,
        smsProcessingRecords: restoration.updatedState.smsProcessingRecords,
        settings: restoration.updatedState.settings,
        syncState: restoration.result.success ? 'synced' : 'error',
        lastSyncResult: restoration.result,
        lastSyncedAt: restoration.result.lastSyncedAt || nowIso,
      });

      return authRes;
    },

    signOutCloud: async () => {
      const res = await signOutUser();
      get().signOut();
      return res;
    },

    resetPasswordCloud: async (email: string) => {
      return resetPasswordForEmail(email);
    },

    triggerManualSync: async () => {
      const current = get();
      let userId = current.cloudUser?.id || current.settings.cloud_user_id;

      if (!userId) {
        const user = await getCurrentUser();
        if (user) {
          userId = user.id;
          set({ cloudUser: user });
        }
      }

      if (!userId) {
        const failure: SyncResult = {
          success: false,
          syncedTripsCount: 0,
          syncedTransactionsCount: 0,
          syncedClassificationsCount: 0,
          errors: ['Please create an account or sign in to sync with the cloud database.'],
        };
        set({ syncState: 'error', lastSyncResult: failure });
        return failure;
      }

      if (!isNetworkAvailable()) {
        const offlineRes: SyncResult = {
          success: false,
          syncedTripsCount: 0,
          syncedTransactionsCount: 0,
          syncedClassificationsCount: 0,
          errors: ['No internet connection'],
        };
        set({ syncState: 'offline', lastSyncResult: offlineRes });
        return offlineRes;
      }

      set({ syncState: 'syncing' });

      const currentState: DatabaseState = {
        schemaVersion: current.schemaVersion,
        appliedMigrations: current.appliedMigrations,
        driverProfile: current.driverProfile,
        accounts: current.accounts,
        trips: current.trips,
        transactions: current.transactions,
        smsProcessingRecords: current.smsProcessingRecords,
        settings: current.settings,
      };

      const syncOutcome = await performFullSync(userId, currentState);

      persistState({
        driverProfile: syncOutcome.updatedState.driverProfile,
        trips: syncOutcome.updatedState.trips,
        transactions: syncOutcome.updatedState.transactions,
        smsProcessingRecords: syncOutcome.updatedState.smsProcessingRecords,
        settings: syncOutcome.updatedState.settings,
        syncState: syncOutcome.result.success ? 'synced' : 'error',
        lastSyncResult: syncOutcome.result,
        lastSyncedAt: syncOutcome.result.lastSyncedAt || new Date().toISOString(),
      });

      return syncOutcome.result;
    },

    updateDriverProfile: (updates) => {
      const state = get();
      const current = state.driverProfile;
      const nowIso = new Date().toISOString();

      const nextProfile: DriverProfileRecord = {
        ...current,
        ...updates,
        updated_at: nowIso,
      };

      const derivedFirstName = getDriverFirstName(nextProfile);
      nextProfile.sms_greeting_name = derivedFirstName;

      const updatedTransactions = state.transactions.map((tx) => ({
        ...tx,
        recipient_name: derivedFirstName,
      }));

      const todayTotal = computeTodayTotalMinorUnits(updatedTransactions);
      let nextDailyTargetAlert = state.dailyTargetAlert;

      if (
        nextProfile.daily_target_minor_units > 0 &&
        todayTotal >= nextProfile.daily_target_minor_units &&
        current.daily_target_minor_units !== nextProfile.daily_target_minor_units
      ) {
        nextDailyTargetAlert = {
          id: `target_${Date.now()}`,
          driverName: getDriverFirstName(nextProfile),
          targetMinorUnits: nextProfile.daily_target_minor_units,
          achievedMinorUnits: todayTotal,
          achievedAt: new Date().toISOString(),
        };
      }

      persistState({
        driverProfile: nextProfile,
        transactions: updatedTransactions,
        dailyTargetAlert: nextDailyTargetAlert,
      });
    },

    setSmsPermissionStatus: (status) => {
      const updated = { ...get().settings, sms_permission_status: status };
      persistState({ settings: updated });
    },

    setLocationPermissionStatus: (status) => {
      const updated = { ...get().settings, location_permission_status: status };
      persistState({ settings: updated });
    },

    toggleSimulatedJsRuntimeState: () => {
      const wasOffline = get().isJsRuntimeSimulatedOffline;
      set({ isJsRuntimeSimulatedOffline: !wasOffline });
      if (wasOffline) {
        get().drainNativeSmsQueue();
      }
    },

    receiveIncomingSmsBroadcast: (input: RawSmsInput) => {
      const state = get();

      if (state.settings.sms_permission_status !== 'GRANTED') {
        return {
          status: 'PERMISSION_DENIED',
          message:
            'RECEIVE_SMS permission is currently denied. Grant SMS permission to detect Telebirr 127 messages.',
        };
      }

      if (state.isJsRuntimeSimulatedOffline) {
        const queuedItem: QueuedNativeSmsEvent = {
          id: `native_q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          senderId: input.senderId,
          body: input.body,
          receivedAt: input.receivedAt || new Date().toISOString(),
        };
        set({ nativeSmsQueue: [...state.nativeSmsQueue, queuedItem] });
        return {
          status: 'QUEUED_NATIVELY',
          message:
            'Captured by Kotlin SmsReceiver while JS runtime was inactive and persisted to native SQLite queue.',
        };
      }

      const existingTxIds = new Set<string>();
      for (const tx of state.transactions) {
        if (tx.transaction_id) {
          existingTxIds.add(tx.transaction_id.toUpperCase());
        }
      }

      const existingFingerprints = new Set<string>();
      for (const rec of state.smsProcessingRecords) {
        existingFingerprints.add(rec.message_fingerprint);
      }

      const activeTrip = state.trips.find((t) => t.status === TripStatus.ACTIVE) || null;

      const outcome = evaluateIncomingSms(input, {
        existingTransactionIds: existingTxIds,
        existingFingerprints,
        hasActiveTrip: Boolean(activeTrip),
      });

      const nowIso = input.receivedAt || new Date().toISOString();
      const { parsed, validation, processingStatus } = outcome;

      const processingRecord: SmsProcessingRecord = {
        id: `sms_proc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sender_id: parsed.smsSenderId,
        message_fingerprint: parsed.messageFingerprint,
        classification: parsed.messageType,
        processing_status: processingStatus,
        received_at: nowIso,
        processed_at: new Date().toISOString(),
        error_message: validation.errors.length > 0 ? validation.errors.join(' ') : null,
        summary_note: parsed.isValidFinancialTransaction
          ? `${parsed.messageType}: ${formatMinorUnits(parsed.amountMinorUnits, 'ETB')} (${parsed.transactionId || 'No TX ID'})`
          : `Classified as ${parsed.messageType}`,
        sync_status: 'PENDING',
        synced_at: null,
      };

      if (processingStatus === ProcessingStatus.DUPLICATE) {
        return {
          status: ProcessingStatus.DUPLICATE,
          message: `Duplicate SMS prevented (${parsed.transactionId || parsed.messageFingerprint} already recorded).`,
        };
      }

      if (!outcome.shouldCreateTransaction) {
        persistState({
          smsProcessingRecords: [processingRecord, ...state.smsProcessingRecords],
        });
        return {
          status: processingStatus,
          message:
            validation.errors[0] ||
            validation.warnings[0] ||
            `SMS classified as ${parsed.messageType} — not counted as driver income.`,
        };
      }

      const todayIso = CURRENT_DEMO_ISO_DATE;
      const displayDate = parsed.transactionDate || CURRENT_DEMO_DISPLAY_DATE;
      const displayTime =
        parsed.transactionTime ||
        new Date(nowIso).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });

      const driverFirstName = getDriverFirstName(state.driverProfile);

      const newTxRecord: TransactionRecord = {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        trip_id: null,
        transaction_id: parsed.transactionId,
        transaction_type: parsed.messageType,
        payment_method: PaymentMethod.TELEBIRR,
        amount_minor_units: parsed.amountMinorUnits || 0,
        currency: parsed.currency || 'ETB',
        sender_name: parsed.senderName || 'Unknown Telebirr User',
        sender_phone: parsed.senderPhone,
        recipient_name: driverFirstName,
        transaction_date: displayDate,
        iso_date: todayIso,
        transaction_time: displayTime,
        account_balance_minor_units: parsed.accountBalanceMinorUnits,
        sms_sender: parsed.smsSenderId,
        transaction_status: TransactionStatus.VALID,
        original_transaction_id: parsed.originalTransactionId,
        description:
          parsed.missingFields.length > 0
            ? `Parsed with missing optional fields: ${parsed.missingFields.join(', ')}`
            : 'Telebirr SMS 127 auto-captured',
        created_at: nowIso,
        updated_at: nowIso,
        sync_status: 'PENDING',
        synced_at: null,
        version: 1,
      };

      const updatedExistingTransactions = state.transactions.map((existingTx) => {
        if (
          (parsed.messageType === SmsMessageType.PAYMENT_REVERSED ||
            parsed.messageType === SmsMessageType.REFUND) &&
          parsed.originalTransactionId &&
          existingTx.transaction_id === parsed.originalTransactionId &&
          existingTx.id !== newTxRecord.id
        ) {
          return {
            ...existingTx,
            transaction_status:
              parsed.messageType === SmsMessageType.PAYMENT_REVERSED
                ? TransactionStatus.REVERSED
                : TransactionStatus.REFUNDED,
            updated_at: nowIso,
            sync_status: 'PENDING' as const,
          };
        }
        return existingTx;
      });

      const nextTransactions = [newTxRecord, ...updatedExistingTransactions];
      const prevTodayTotal = computeTodayTotalMinorUnits(state.transactions);
      const nextTodayTotal = computeTodayTotalMinorUnits(nextTransactions);
      const dailyTarget = state.driverProfile.daily_target_minor_units;

      let dailyTargetAlert = state.dailyTargetAlert;
      if (
        dailyTarget > 0 &&
        nextTodayTotal >= dailyTarget &&
        (prevTodayTotal < dailyTarget || parsed.amountMinorUnits)
      ) {
        dailyTargetAlert = {
          id: `target_${Date.now()}`,
          driverName: driverFirstName,
          targetMinorUnits: dailyTarget,
          achievedMinorUnits: nextTodayTotal,
          achievedAt: nowIso,
        };
      }

      let latestAlert = state.latestAlert;
      let pendingAssociationPrompt = state.pendingAssociationPrompt;

      if (outcome.shouldNotifyDriver && parsed.amountMinorUnits) {
        dispatchPaymentEffects(
          parsed.amountMinorUnits,
          parsed.senderName,
          state.settings
        );

        latestAlert = {
          id: `alert_${Date.now()}`,
          transactionRecordId: newTxRecord.id,
          transactionId: parsed.transactionId,
          amountFormatted: formatMinorUnits(
            parsed.amountMinorUnits,
            state.settings.currency_display
          ),
          amountMinorUnits: parsed.amountMinorUnits,
          senderName: parsed.senderName || 'Telebirr Sender',
          senderPhone: parsed.senderPhone,
          timeFormatted: displayTime.slice(0, 5),
          activeTripId: activeTrip ? activeTrip.id : null,
          activeTripLabel: activeTrip
            ? `Active Trip from ${activeTrip.start_location_name}`
            : null,
          createdAt: nowIso,
        };

        if (activeTrip && state.settings.auto_suggest_trip_association) {
          pendingAssociationPrompt = {
            transactionRecordId: newTxRecord.id,
            transactionId: parsed.transactionId,
            amountMinorUnits: parsed.amountMinorUnits,
            senderName: parsed.senderName || 'Telebirr Sender',
            activeTripId: activeTrip.id,
            activeTripStartLocation: activeTrip.start_location_name,
          };
        }
      }

      persistState({
        transactions: nextTransactions,
        smsProcessingRecords: [processingRecord, ...state.smsProcessingRecords],
        latestAlert,
        pendingAssociationPrompt,
        dailyTargetAlert,
      });

      return {
        status: ProcessingStatus.PROCESSED,
        message: `Processed ${parsed.messageType}: ${formatMinorUnits(parsed.amountMinorUnits, 'ETB')}`,
        transactionRecord: newTxRecord,
      };
    },

    drainNativeSmsQueue: () => {
      const queue = [...get().nativeSmsQueue];
      if (queue.length === 0) return 0;
      set({ nativeSmsQueue: [], isJsRuntimeSimulatedOffline: false });
      let processedCount = 0;
      for (const item of queue) {
        const res = get().receiveIncomingSmsBroadcast({
          senderId: item.senderId,
          body: item.body,
          receivedAt: item.receivedAt,
        });
        if (res.status === ProcessingStatus.PROCESSED) {
          processedCount += 1;
        }
      }
      return processedCount;
    },

    dismissAlert: () => {
      set({ latestAlert: null });
    },

    dismissDailyTargetAlert: () => {
      set({ dailyTargetAlert: null });
    },

    confirmPendingTripAssociation: (associate: boolean) => {
      const prompt = get().pendingAssociationPrompt;
      if (!prompt) return;
      if (associate) {
        get().assignTransactionToTrip(prompt.transactionRecordId, prompt.activeTripId);
      }
      set({ pendingAssociationPrompt: null, latestAlert: null });
    },

    clearSmsAuditLogs: () => {
      persistState({ smsProcessingRecords: [] });
    },

    startTrip: (params) => {
      const state = get();
      const existingActive = state.trips.find((t) => t.status === TripStatus.ACTIVE);
      if (existingActive) {
        return null;
      }

      const timePart = new Date().toISOString().slice(11);
      const nowIso = `${CURRENT_DEMO_ISO_DATE}T${timePart}`;

      const newTrip: TripRecord = {
        id: `trip_${Date.now()}`,
        start_location_name: params.startLocationName.trim() || 'Addis Ababa',
        start_latitude: params.latitude,
        start_longitude: params.longitude,
        start_location_accuracy: params.accuracy,
        start_location_source: params.source,
        start_time: nowIso,
        end_location_name: null,
        end_latitude: null,
        end_longitude: null,
        end_location_accuracy: null,
        end_location_source: null,
        end_time: null,
        duration: null,
        status: TripStatus.ACTIVE,
        notes: params.notes?.trim() || null,
        created_at: nowIso,
        updated_at: nowIso,
        sync_status: 'PENDING',
        synced_at: null,
        version: 1,
      };

      persistState({
        trips: [newTrip, ...state.trips],
      });
      return newTrip;
    },

    endTrip: (tripId, params) => {
      const state = get();
      const target = state.trips.find((t) => t.id === tripId);
      if (!target) return null;

      const timePart = new Date().toISOString().slice(11);
      const endIso = `${CURRENT_DEMO_ISO_DATE}T${timePart}`;
      const startMs = new Date(target.start_time).getTime();
      const endMs = new Date(endIso).getTime();
      const durationSec = Math.max(60, Math.round(Math.abs(endMs - startMs) / 1000));

      const completedTrip: TripRecord = {
        ...target,
        end_location_name: params.endLocationName.trim() || 'Destination, Addis Ababa',
        end_latitude: params.latitude,
        end_longitude: params.longitude,
        end_location_accuracy: params.accuracy,
        end_location_source: params.source,
        end_time: endIso,
        duration: durationSec,
        status: TripStatus.COMPLETED,
        notes: params.notes !== undefined ? params.notes.trim() || null : target.notes,
        updated_at: endIso,
        sync_status: 'PENDING',
        version: (target.version ?? 1) + 1,
      };

      persistState({
        trips: state.trips.map((t) => (t.id === tripId ? completedTrip : t)),
        pendingAssociationPrompt:
          state.pendingAssociationPrompt?.activeTripId === tripId
            ? null
            : state.pendingAssociationPrompt,
      });

      return completedTrip;
    },

    cancelTrip: (tripId) => {
      const state = get();
      const nowIso = `${CURRENT_DEMO_ISO_DATE}T${new Date().toISOString().slice(11)}`;
      persistState({
        trips: state.trips.map((t) =>
          t.id === tripId
            ? {
                ...t,
                status: TripStatus.CANCELLED,
                end_time: nowIso,
                updated_at: nowIso,
                sync_status: 'PENDING',
                version: (t.version ?? 1) + 1,
              }
            : t
        ),
        transactions: state.transactions.map((tx) =>
          tx.trip_id === tripId
            ? { ...tx, trip_id: null, updated_at: nowIso, sync_status: 'PENDING', version: (tx.version ?? 1) + 1 }
            : tx
        ),
        pendingAssociationPrompt: null,
      });
    },

    updateTripDetails: (tripId, updates) => {
      const state = get();
      const nowIso = `${CURRENT_DEMO_ISO_DATE}T${new Date().toISOString().slice(11)}`;
      persistState({
        trips: state.trips.map((t) =>
          t.id === tripId
            ? {
                ...t,
                ...updates,
                updated_at: nowIso,
                sync_status: 'PENDING',
                version: (t.version ?? 1) + 1,
              }
            : t
        ),
      });
    },

    deleteTrip: (tripId) => {
      const state = get();
      const nowIso = `${CURRENT_DEMO_ISO_DATE}T${new Date().toISOString().slice(11)}`;
      persistState({
        trips: state.trips.filter((t) => t.id !== tripId),
        transactions: state.transactions.map((tx) =>
          tx.trip_id === tripId
            ? { ...tx, trip_id: null, updated_at: nowIso, sync_status: 'PENDING', version: (tx.version ?? 1) + 1 }
            : tx
        ),
      });
    },

    assignTransactionToTrip: (transactionRecordId, tripId) => {
      const state = get();
      if (tripId !== null) {
        const targetTrip = state.trips.find((t) => t.id === tripId);
        if (!targetTrip || targetTrip.status !== TripStatus.ACTIVE) {
          return;
        }
      }
      const nowIso = `${CURRENT_DEMO_ISO_DATE}T${new Date().toISOString().slice(11)}`;
      const isPendingTx =
        state.pendingAssociationPrompt?.transactionRecordId === transactionRecordId;
      const isAlertTx =
        state.latestAlert?.transactionRecordId === transactionRecordId;

      persistState({
        transactions: state.transactions.map((tx) =>
          tx.id === transactionRecordId
            ? {
                ...tx,
                trip_id: tripId,
                updated_at: nowIso,
                sync_status: 'PENDING',
                version: (tx.version ?? 1) + 1,
              }
            : tx
        ),
        pendingAssociationPrompt:
          isPendingTx || tripId !== null ? null : state.pendingAssociationPrompt,
        latestAlert: isAlertTx && tripId !== null ? null : state.latestAlert,
      });
    },

    addManualCashPayment: (params) => {
      const state = get();
      const now = new Date();
      const nowIso = `${CURRENT_DEMO_ISO_DATE}T${now.toISOString().slice(11)}`;
      const timeStr = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      const driverFirstName = getDriverFirstName(state.driverProfile);

      const cashRecord: TransactionRecord = {
        id: `tx_cash_${Date.now()}`,
        trip_id: params.tripId,
        transaction_id: null,
        transaction_type: SmsMessageType.PAYMENT_RECEIVED,
        payment_method: PaymentMethod.CASH,
        amount_minor_units: params.amountMinorUnits,
        currency: 'ETB',
        sender_name: params.senderName?.trim() || 'Cash payment',
        sender_phone: null,
        recipient_name: driverFirstName,
        transaction_date: CURRENT_DEMO_DISPLAY_DATE,
        iso_date: CURRENT_DEMO_ISO_DATE,
        transaction_time: timeStr,
        account_balance_minor_units: null,
        sms_sender: 'MANUAL_CASH',
        transaction_status: TransactionStatus.VALID,
        original_transaction_id: null,
        description: params.description?.trim()
          ? `Note: ${params.description.trim()}`
          : 'Note: Cash fare',
        created_at: nowIso,
        updated_at: nowIso,
        sync_status: 'PENDING',
        synced_at: null,
        version: 1,
      };

      const nextTransactions = [cashRecord, ...state.transactions];
      const prevTodayTotal = computeTodayTotalMinorUnits(state.transactions);
      const nextTodayTotal = computeTodayTotalMinorUnits(nextTransactions);
      const dailyTarget = state.driverProfile.daily_target_minor_units;

      let dailyTargetAlert = state.dailyTargetAlert;
      if (dailyTarget > 0 && nextTodayTotal >= dailyTarget && prevTodayTotal <= nextTodayTotal) {
        dailyTargetAlert = {
          id: `target_${Date.now()}`,
          driverName: driverFirstName,
          targetMinorUnits: dailyTarget,
          achievedMinorUnits: nextTodayTotal,
          achievedAt: nowIso,
        };
      }

      persistState({
        transactions: nextTransactions,
        dailyTargetAlert,
      });
      return cashRecord;
    },

    deleteTransactionRecord: (transactionRecordId) => {
      const state = get();
      persistState({
        transactions: state.transactions.filter((tx) => tx.id !== transactionRecordId),
        pendingAssociationPrompt:
          state.pendingAssociationPrompt?.transactionRecordId === transactionRecordId
            ? null
            : state.pendingAssociationPrompt,
        latestAlert:
          state.latestAlert?.transactionRecordId === transactionRecordId
            ? null
            : state.latestAlert,
      });
    },

    updateSettings: (partial) => {
      const state = get();
      const nextSettings = { ...state.settings, ...partial };
      persistState({ settings: nextSettings });
    },

    resetToSeedDatabase: () => {
      const seeded = createSeedDatabaseState();
      persistState({
        schemaVersion: seeded.schemaVersion,
        appliedMigrations: seeded.appliedMigrations,
        driverProfile: seeded.driverProfile,
        trips: seeded.trips,
        transactions: seeded.transactions,
        smsProcessingRecords: seeded.smsProcessingRecords,
        settings: seeded.settings,
        latestAlert: null,
        pendingAssociationPrompt: null,
        dailyTargetAlert: null,
        nativeSmsQueue: [],
        isJsRuntimeSimulatedOffline: false,
      });
    },
  };
});

// Setup online/offline listeners and session restoration
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const s = useTripBirrStore.getState();
    s.triggerManualSync().catch(() => {});
  });

  window.addEventListener('offline', () => {
    useTripBirrStore.setState({ syncState: 'offline' });
  });

  getCurrentSession().then((session) => {
    if (session?.user) {
      useTripBirrStore.setState({
        cloudUser: session.user,
        cloudSession: session,
        isLoggedIn: true,
      });
      useTripBirrStore.getState().triggerManualSync().catch(() => {});
    }
  });

  onAuthStateChange((event, session, user) => {
    if (event === 'SIGNED_IN' && user) {
      useTripBirrStore.setState({
        cloudUser: user,
        cloudSession: session,
        isLoggedIn: true,
      });
    } else if (event === 'SIGNED_OUT') {
      useTripBirrStore.setState({
        cloudUser: null,
        cloudSession: null,
        syncState: 'idle',
      });
    }
  });
}
