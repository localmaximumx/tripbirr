import { create } from 'zustand';
import {
  AppSettings,
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
  loadDatabaseFromStorage,
  saveDatabaseToStorage,
} from '../database/database';
import { evaluateIncomingSms } from '../services/sms/smsProcessor';
import { ProcessingStatus, RawSmsInput, SmsMessageType } from '../services/sms/smsTypes';
import {
  dispatchPaymentEffects,
  DriverPaymentAlert,
} from '../services/notifications/notificationService';
import { formatMinorUnits } from '../utils/formatters';

export interface PendingTripAssociationPrompt {
  transactionRecordId: string;
  transactionId: string | null;
  amountMinorUnits: number;
  senderName: string;
  activeTripId: string;
  activeTripStartLocation: string;
}

export interface QueuedNativeSmsEvent {
  id: string;
  senderId: string;
  body: string;
  receivedAt: string;
}

interface TripBirrState {
  schemaVersion: number;
  appliedMigrations: string[];
  trips: TripRecord[];
  transactions: TransactionRecord[];
  smsProcessingRecords: SmsProcessingRecord[];
  settings: AppSettings;

  // Live notification banner & non-destructive association prompt
  latestAlert: DriverPaymentAlert | null;
  pendingAssociationPrompt: PendingTripAssociationPrompt | null;

  // Simulated Android Native BroadcastReceiver queue (for testing when JS runtime is paused/closed)
  isJsRuntimeSimulatedOffline: boolean;
  nativeSmsQueue: QueuedNativeSmsEvent[];

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
  confirmPendingTripAssociation: (associate: boolean) => void;

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

export const useTripBirrStore = create<TripBirrState>((set, get) => {
  const persistState = (next: Partial<TripBirrState>) => {
    set(next);
    const current = get();
    saveDatabaseToStorage({
      schemaVersion: current.schemaVersion,
      appliedMigrations: current.appliedMigrations,
      trips: current.trips,
      transactions: current.transactions,
      smsProcessingRecords: current.smsProcessingRecords,
      settings: current.settings,
    });
  };

  return {
    schemaVersion: initialDb.schemaVersion,
    appliedMigrations: initialDb.appliedMigrations,
    trips: initialDb.trips,
    transactions: initialDb.transactions,
    smsProcessingRecords: initialDb.smsProcessingRecords,
    settings: initialDb.settings,
    latestAlert: null,
    pendingAssociationPrompt: null,
    isJsRuntimeSimulatedOffline: false,
    nativeSmsQueue: [],

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
        // Automatically drain queued native SMS events when JS runtime wakes up
        get().drainNativeSmsQueue();
      }
    },

    receiveIncomingSmsBroadcast: (input: RawSmsInput) => {
      const state = get();

      // 1. Check RECEIVE_SMS permission first
      if (state.settings.sms_permission_status !== 'GRANTED') {
        return {
          status: 'PERMISSION_DENIED',
          message:
            'RECEIVE_SMS permission is currently denied. Grant SMS permission to detect Telebirr 127 messages.',
        };
      }

      // 2. If simulating background/killed JS runtime, queue in native BroadcastReceiver SQLite table
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

      // 3. Collect existing transaction IDs and message fingerprints for strict duplicate prevention
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

      // Record processing audit entry (without storing raw SMS content)
      const processingRecord: SmsProcessingRecord = {
        id: `sms_proc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sender_id: parsed.smsSenderId,
        message_fingerprint: parsed.messageFingerprint,
        classification: parsed.messageType,
        processing_status: processingStatus,
        received_at: nowIso,
        processed_at: new Date().toISOString(),
        error_message:
          validation.errors.length > 0 ? validation.errors.join(' ') : null,
        summary_note: parsed.isValidFinancialTransaction
          ? `${parsed.messageType}: ${formatMinorUnits(parsed.amountMinorUnits, 'ETB')} (${parsed.transactionId || 'No TX ID'})`
          : `Classified as ${parsed.messageType}`,
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

      // 4. Create financial transaction record
      const todayIso = parsed.isoDate || '2026-10-21';
      const displayDate = parsed.transactionDate || '21/10/2026';
      const displayTime =
        parsed.transactionTime ||
        new Date(nowIso).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });

      const newTxRecord: TransactionRecord = {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        trip_id: null, // Never silently make an irreversible association! Driver confirms or assigns.
        transaction_id: parsed.transactionId,
        transaction_type: parsed.messageType,
        payment_method: PaymentMethod.TELEBIRR,
        amount_minor_units: parsed.amountMinorUnits || 0,
        currency: parsed.currency || 'ETB',
        sender_name: parsed.senderName || 'Unknown Telebirr User',
        sender_phone: parsed.senderPhone,
        recipient_name: parsed.recipient || 'Driver',
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
      };

      // 5. If this is a REVERSAL or REFUND referencing an original transaction ID,
      // preserve the original transaction (Rule 9 & 10) and mark its status REVERSED/REFUNDED
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
          };
        }
        return existingTx;
      });

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
        transactions: [newTxRecord, ...updatedExistingTransactions],
        smsProcessingRecords: [processingRecord, ...state.smsProcessingRecords],
        latestAlert,
        pendingAssociationPrompt,
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

    confirmPendingTripAssociation: (associate: boolean) => {
      const prompt = get().pendingAssociationPrompt;
      if (!prompt) return;
      if (associate) {
        get().assignTransactionToTrip(prompt.transactionRecordId, prompt.activeTripId);
      }
      set({ pendingAssociationPrompt: null, latestAlert: null });
    },

    startTrip: (params) => {
      const state = get();
      // Prevent multiple simultaneous active trips
      const existingActive = state.trips.find((t) => t.status === TripStatus.ACTIVE);
      if (existingActive) {
        return null;
      }

      const nowIso = new Date().toISOString();
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

      const endIso = new Date().toISOString();
      const startMs = new Date(target.start_time).getTime();
      const endMs = new Date(endIso).getTime();
      const durationSec = Math.max(60, Math.round((endMs - startMs) / 1000));

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
      const nowIso = new Date().toISOString();
      persistState({
        trips: state.trips.map((t) =>
          t.id === tripId
            ? { ...t, status: TripStatus.CANCELLED, end_time: nowIso, updated_at: nowIso }
            : t
        ),
        // Unassign transactions that were temporarily linked to a cancelled trip so they are never lost
        transactions: state.transactions.map((tx) =>
          tx.trip_id === tripId ? { ...tx, trip_id: null, updated_at: nowIso } : tx
        ),
        pendingAssociationPrompt: null,
      });
    },

    updateTripDetails: (tripId, updates) => {
      const state = get();
      const nowIso = new Date().toISOString();
      persistState({
        trips: state.trips.map((t) =>
          t.id === tripId ? { ...t, ...updates, updated_at: nowIso } : t
        ),
      });
    },

    deleteTrip: (tripId) => {
      const state = get();
      const nowIso = new Date().toISOString();
      // Foreign key ON DELETE SET NULL: preserve all transactions, setting their trip_id to null
      persistState({
        trips: state.trips.filter((t) => t.id !== tripId),
        transactions: state.transactions.map((tx) =>
          tx.trip_id === tripId ? { ...tx, trip_id: null, updated_at: nowIso } : tx
        ),
      });
    },

    assignTransactionToTrip: (transactionRecordId, tripId) => {
      const state = get();
      const nowIso = new Date().toISOString();
      persistState({
        transactions: state.transactions.map((tx) =>
          tx.id === transactionRecordId
            ? { ...tx, trip_id: tripId, updated_at: nowIso }
            : tx
        ),
      });
    },

    addManualCashPayment: (params) => {
      const state = get();
      const now = new Date();
      const nowIso = now.toISOString();
      const timeStr = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      const cashRecord: TransactionRecord = {
        id: `tx_cash_${Date.now()}`,
        trip_id: params.tripId,
        transaction_id: null,
        transaction_type: SmsMessageType.PAYMENT_RECEIVED,
        payment_method: PaymentMethod.CASH,
        amount_minor_units: params.amountMinorUnits,
        currency: 'ETB',
        sender_name: params.senderName?.trim() || 'Cash Passenger',
        sender_phone: null,
        recipient_name: 'Driver',
        transaction_date: '21/10/2026',
        iso_date: '2026-10-21',
        transaction_time: timeStr,
        account_balance_minor_units: null,
        sms_sender: 'MANUAL_CASH',
        transaction_status: TransactionStatus.VALID,
        original_transaction_id: null,
        description: params.description?.trim() || 'Manual cash fare entry',
        created_at: nowIso,
        updated_at: nowIso,
      };

      persistState({
        transactions: [cashRecord, ...state.transactions],
      });
      return cashRecord;
    },

    deleteTransactionRecord: (transactionRecordId) => {
      const state = get();
      persistState({
        transactions: state.transactions.filter((tx) => tx.id !== transactionRecordId),
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
        trips: seeded.trips,
        transactions: seeded.transactions,
        smsProcessingRecords: seeded.smsProcessingRecords,
        settings: seeded.settings,
        latestAlert: null,
        pendingAssociationPrompt: null,
        nativeSmsQueue: [],
        isJsRuntimeSimulatedOffline: false,
      });
    },
  };
});
