import {
  AppSettings,
  DriverProfileRecord,
  LocationSource,
  PaymentMethod,
  SmsProcessingRecord,
  TransactionRecord,
  TransactionStatus,
  TripRecord,
  TripStatus,
} from './schema';
import { CURRENT_SCHEMA_VERSION, SQLITE_MIGRATIONS } from './migrations';
import { ProcessingStatus, SmsMessageType } from '../services/sms/smsTypes';

const DB_STORAGE_KEY = 'tripbirr_sqlite_v3_db';

export interface DatabaseState {
  schemaVersion: number;
  appliedMigrations: string[];
  driverProfile: DriverProfileRecord;
  trips: TripRecord[];
  transactions: TransactionRecord[];
  smsProcessingRecords: SmsProcessingRecord[];
  settings: AppSettings;
}

export const DEFAULT_DRIVER_PROFILE: DriverProfileRecord = {
  id: 'driver_biniyam_01',
  full_name: 'Biniyam Zenebe',
  sms_greeting_name: 'Biniyam',
  telebirr_phone: '+251 911 408 747',
  account_type: 'PERSONAL_EMONEY',
  vehicle_type: 'MINIBUS_TAXI',
  vehicle_plate: 'Code 3 - A58291 AA',
  primary_corridor: '4 Kilo ↔ Piassa / Bole ↔ Mexico',
  sub_city: 'Arada Sub-City, Addis Ababa',
  daily_target_minor_units: 60000, // ETB 600.00 daily goal
  driver_license_number: 'AA-DL-904821',
  created_at: '2026-01-15T08:00:00.000Z',
  updated_at: '2026-10-21T20:43:07.000Z',
};

export const DEFAULT_SETTINGS: AppSettings = {
  app_name: 'TripBirr',
  sms_permission_status: 'GRANTED',
  location_permission_status: 'GRANTED',
  notification_sound: true,
  notification_vibration: true,
  voice_announcement: true,
  notification_preview: true,
  silent_mode: false,
  auto_suggest_trip_association: true,
  currency_display: 'ETB',
  language: 'en',
  theme: 'light',
  schema_version: CURRENT_SCHEMA_VERSION,
};

function getTodayIso(): string {
  return '2026-10-21';
}

function getYesterdayIso(): string {
  return '2026-10-20';
}

/**
 * Initial offline database state grounded in Addis Ababa routes and the exact Telebirr SMS
 * specification from Section 5 & Section 8 of the master prompt.
 */
export function createSeedDatabaseState(): DatabaseState {
  const todayIso = getTodayIso();
  const yesterdayIso = getYesterdayIso();

  const trips: TripRecord[] = [
    {
      id: 'trip_4kilo_piassa_01',
      start_location_name: '4 Kilo, Addis Ababa',
      start_latitude: 9.0331,
      start_longitude: 38.7636,
      start_location_accuracy: 11.5,
      start_location_source: LocationSource.GPS,
      start_time: '2026-10-21T20:15:00.000Z',
      end_location_name: 'Piassa, Addis Ababa',
      end_latitude: 9.0358,
      end_longitude: 38.7524,
      end_location_accuracy: 14.0,
      end_location_source: LocationSource.GPS,
      end_time: '2026-10-21T20:48:00.000Z',
      duration: 1980, // 33 mins
      status: TripStatus.COMPLETED,
      notes: 'Evening shared taxi trip from 4 Kilo to Piassa (3 Telebirr passengers: ETB 50 + 30 + 20)',
      created_at: '2026-10-21T20:15:00.000Z',
      updated_at: '2026-10-21T20:48:00.000Z',
    },
    {
      id: 'trip_bole_mexico_02',
      start_location_name: 'Bole Medhanialem, Addis Ababa',
      start_latitude: 8.9974,
      start_longitude: 38.7868,
      start_location_accuracy: 9.2,
      start_location_source: LocationSource.GPS,
      start_time: '2026-10-21T17:10:00.000Z',
      end_location_name: 'Mexico Square, Addis Ababa',
      end_latitude: 9.0104,
      end_longitude: 38.7445,
      end_location_accuracy: 12.0,
      end_location_source: LocationSource.GPS,
      end_time: '2026-10-21T17:52:00.000Z',
      duration: 2520, // 42 mins
      status: TripStatus.COMPLETED,
      notes: 'Afternoon rush hour ride via Meskel Square',
      created_at: '2026-10-21T17:10:00.000Z',
      updated_at: '2026-10-21T17:52:00.000Z',
    },
    {
      id: 'trip_megenagna_cmc_03',
      start_location_name: 'Megenagna, Addis Ababa',
      start_latitude: 9.0205,
      start_longitude: 38.8024,
      start_location_accuracy: 15.0,
      start_location_source: LocationSource.MANUAL,
      start_time: '2026-10-20T14:00:00.000Z',
      end_location_name: 'CMC Michael, Addis Ababa',
      end_latitude: 9.0229,
      end_longitude: 38.8467,
      end_location_accuracy: 16.5,
      end_location_source: LocationSource.GPS,
      end_time: '2026-10-20T14:28:00.000Z',
      duration: 1680, // 28 mins
      status: TripStatus.COMPLETED,
      notes: 'Corridor route Megenagna to CMC',
      created_at: '2026-10-20T14:00:00.000Z',
      updated_at: '2026-10-20T14:28:00.000Z',
    },
  ];

  const transactions: TransactionRecord[] = [
    // Exact prompt example SMS 1: ETB 50.00 from Natnael Birhanu(2519****8747) TX DJL25NAFRW
    {
      id: 'tx_rec_01',
      trip_id: 'trip_4kilo_piassa_01',
      transaction_id: 'DJL25NAFRW',
      transaction_type: SmsMessageType.PAYMENT_RECEIVED,
      payment_method: PaymentMethod.TELEBIRR,
      amount_minor_units: 5000, // ETB 50.00
      currency: 'ETB',
      sender_name: 'Natnael Birhanu',
      sender_phone: '2519****8747',
      recipient_name: 'Biniyam',
      transaction_date: '21/10/2026',
      iso_date: todayIso,
      transaction_time: '23:43:07',
      account_balance_minor_units: 33262, // ETB 332.62
      sms_sender: '127',
      transaction_status: TransactionStatus.VALID,
      original_transaction_id: null,
      description: 'Telebirr SMS 127 auto-captured',
      created_at: '2026-10-21T20:43:07.000Z',
      updated_at: '2026-10-21T20:43:07.000Z',
    },
    // Passenger 2 on 4 Kilo -> Piassa trip: ETB 30.00
    {
      id: 'tx_rec_02',
      trip_id: 'trip_4kilo_piassa_01',
      transaction_id: 'DJL88KMPQ2',
      transaction_type: SmsMessageType.PAYMENT_RECEIVED,
      payment_method: PaymentMethod.TELEBIRR,
      amount_minor_units: 3000, // ETB 30.00
      currency: 'ETB',
      sender_name: 'Selamawit Tadesse',
      sender_phone: '2519****3319',
      recipient_name: 'Biniyam',
      transaction_date: '21/10/2026',
      iso_date: todayIso,
      transaction_time: '23:36:14',
      account_balance_minor_units: 28262,
      sms_sender: '127',
      transaction_status: TransactionStatus.VALID,
      original_transaction_id: null,
      description: 'Telebirr SMS 127 auto-captured',
      created_at: '2026-10-21T20:36:14.000Z',
      updated_at: '2026-10-21T20:36:14.000Z',
    },
    // Passenger 3 on 4 Kilo -> Piassa trip: ETB 20.00
    {
      id: 'tx_rec_03',
      trip_id: 'trip_4kilo_piassa_01',
      transaction_id: 'DJL41VBNR9',
      transaction_type: SmsMessageType.PAYMENT_RECEIVED,
      payment_method: PaymentMethod.TELEBIRR,
      amount_minor_units: 2000, // ETB 20.00
      currency: 'ETB',
      sender_name: 'Dawit Mekonnen',
      sender_phone: '2519****9012',
      recipient_name: 'Biniyam',
      transaction_date: '21/10/2026',
      iso_date: todayIso,
      transaction_time: '23:29:50',
      account_balance_minor_units: 25262,
      sms_sender: '127',
      transaction_status: TransactionStatus.VALID,
      original_transaction_id: null,
      description: 'Telebirr SMS 127 auto-captured',
      created_at: '2026-10-21T20:29:50.000Z',
      updated_at: '2026-10-21T20:29:50.000Z',
    },
    // Bole -> Mexico trip payment 1: ETB 180.00
    {
      id: 'tx_rec_04',
      trip_id: 'trip_bole_mexico_02',
      transaction_id: 'DJL19WXYZ4',
      transaction_type: SmsMessageType.PAYMENT_RECEIVED,
      payment_method: PaymentMethod.TELEBIRR,
      amount_minor_units: 18000, // ETB 180.00
      currency: 'ETB',
      sender_name: 'Yohannes Kebede',
      sender_phone: '2519****4401',
      recipient_name: 'Biniyam',
      transaction_date: '21/10/2026',
      iso_date: todayIso,
      transaction_time: '20:49:12',
      account_balance_minor_units: 23262,
      sms_sender: '127',
      transaction_status: TransactionStatus.VALID,
      original_transaction_id: null,
      description: 'Telebirr SMS 127 auto-captured',
      created_at: '2026-10-21T17:49:12.000Z',
      updated_at: '2026-10-21T17:49:12.000Z',
    },
    // Unassigned Telebirr payment received between trips: ETB 65.00
    {
      id: 'tx_rec_05',
      trip_id: null,
      transaction_id: 'DJL77UNASN',
      transaction_type: SmsMessageType.PAYMENT_RECEIVED,
      payment_method: PaymentMethod.TELEBIRR,
      amount_minor_units: 6500, // ETB 65.00
      currency: 'ETB',
      sender_name: 'Meron Alemu',
      sender_phone: '2519****6128',
      recipient_name: 'Biniyam',
      transaction_date: '21/10/2026',
      iso_date: todayIso,
      transaction_time: '19:05:33',
      account_balance_minor_units: 5262,
      sms_sender: '127',
      transaction_status: TransactionStatus.VALID,
      original_transaction_id: null,
      description: 'Received when no trip was active — awaiting driver assignment',
      created_at: '2026-10-21T16:05:33.000Z',
      updated_at: '2026-10-21T16:05:33.000Z',
    },
    // Yesterday trip payment: Megenagna -> CMC (ETB 140.00 Telebirr)
    {
      id: 'tx_rec_06',
      trip_id: 'trip_megenagna_cmc_03',
      transaction_id: 'DJK90CMC11',
      transaction_type: SmsMessageType.PAYMENT_RECEIVED,
      payment_method: PaymentMethod.TELEBIRR,
      amount_minor_units: 14000, // ETB 140.00
      currency: 'ETB',
      sender_name: 'Henok Girma',
      sender_phone: '2519****7750',
      recipient_name: 'Biniyam',
      transaction_date: '20/10/2026',
      iso_date: yesterdayIso,
      transaction_time: '17:25:10',
      account_balance_minor_units: 41000,
      sms_sender: '127',
      transaction_status: TransactionStatus.VALID,
      original_transaction_id: null,
      description: 'Telebirr SMS 127 auto-captured',
      created_at: '2026-10-20T14:25:10.000Z',
      updated_at: '2026-10-20T14:25:10.000Z',
    },
    // Outgoing Telebirr payment (Fuel station - never counted as incoming income)
    {
      id: 'tx_rec_07',
      trip_id: null,
      transaction_id: 'DJL05FUEL8',
      transaction_type: SmsMessageType.PAYMENT_SENT,
      payment_method: PaymentMethod.TELEBIRR,
      amount_minor_units: 35000, // ETB 350.00
      currency: 'ETB',
      sender_name: 'TotalEnergies Kazanchis',
      sender_phone: '2519****0099',
      recipient_name: 'TotalEnergies Kazanchis',
      transaction_date: '21/10/2026',
      iso_date: todayIso,
      transaction_time: '15:12:40',
      account_balance_minor_units: 11262,
      sms_sender: '127',
      transaction_status: TransactionStatus.VALID,
      original_transaction_id: null,
      description: 'Outgoing Telebirr payment (excluded from driver income)',
      created_at: '2026-10-21T12:12:40.000Z',
      updated_at: '2026-10-21T12:12:40.000Z',
    },
  ];

  const smsProcessingRecords: SmsProcessingRecord[] = [
    {
      id: 'sms_proc_01',
      sender_id: '127',
      message_fingerprint: 'TX_DJL25NAFRW',
      classification: SmsMessageType.PAYMENT_RECEIVED,
      processing_status: ProcessingStatus.PROCESSED,
      received_at: '2026-10-21T20:43:07.000Z',
      processed_at: '2026-10-21T20:43:07.050Z',
      error_message: null,
      summary_note: 'Incoming ETB 50.00 from Natnael Birhanu (TX: DJL25NAFRW)',
    },
    {
      id: 'sms_proc_02',
      sender_id: '127',
      message_fingerprint: 'TX_DJL88KMPQ2',
      classification: SmsMessageType.PAYMENT_RECEIVED,
      processing_status: ProcessingStatus.PROCESSED,
      received_at: '2026-10-21T20:36:14.000Z',
      processed_at: '2026-10-21T20:36:14.040Z',
      error_message: null,
      summary_note: 'Incoming ETB 30.00 from Selamawit Tadesse (TX: DJL88KMPQ2)',
    },
    {
      id: 'sms_proc_03',
      sender_id: '127',
      message_fingerprint: 'TX_DJL41VBNR9',
      classification: SmsMessageType.PAYMENT_RECEIVED,
      processing_status: ProcessingStatus.PROCESSED,
      received_at: '2026-10-21T20:29:50.000Z',
      processed_at: '2026-10-21T20:29:50.045Z',
      error_message: null,
      summary_note: 'Incoming ETB 20.00 from Dawit Mekonnen (TX: DJL41VBNR9)',
    },
    {
      id: 'sms_proc_04',
      sender_id: '127',
      message_fingerprint: 'FP_PROMO_SUPERAPP_01',
      classification: SmsMessageType.PROMOTIONAL_MESSAGE,
      processing_status: ProcessingStatus.IGNORED_NON_FINANCIAL,
      received_at: '2026-10-21T11:20:00.000Z',
      processed_at: '2026-10-21T11:20:00.015Z',
      error_message: null,
      summary_note: 'Ignored Telebirr SuperApp promotional broadcast',
    },
  ];

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appliedMigrations: SQLITE_MIGRATIONS.map((m) => m.name),
    driverProfile: DEFAULT_DRIVER_PROFILE,
    trips,
    transactions,
    smsProcessingRecords,
    settings: DEFAULT_SETTINGS,
  };
}

export function loadDatabaseFromStorage(): DatabaseState {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (!raw) {
      const seeded = createSeedDatabaseState();
      saveDatabaseToStorage(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as DatabaseState;
    if (!parsed.driverProfile) {
      parsed.driverProfile = DEFAULT_DRIVER_PROFILE;
    }
    if (!parsed.schemaVersion || parsed.schemaVersion < CURRENT_SCHEMA_VERSION) {
      parsed.schemaVersion = CURRENT_SCHEMA_VERSION;
      parsed.appliedMigrations = SQLITE_MIGRATIONS.map((m) => m.name);
      parsed.settings = {
        ...DEFAULT_SETTINGS,
        ...parsed.settings,
        schema_version: CURRENT_SCHEMA_VERSION,
      };
      saveDatabaseToStorage(parsed);
    }
    return parsed;
  } catch {
    return createSeedDatabaseState();
  }
}

export function saveDatabaseToStorage(state: DatabaseState): void {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('SQLite storage write failure:', err);
  }
}

/**
 * Generates a complete, standard SQLite `.sql` dump of all current tables and records
 * so the driver or developer can inspect or import into an external SQLite CLI.
 */
export function exportSqliteSqlDump(state: DatabaseState): string {
  const escapeSql = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    return `'${String(val).replace(/'/g, "''")}'`;
  };

  const p = state.driverProfile;
  const lines: string[] = [
    '-- TripBirr Offline SQLite Database Dump',
    `-- Schema Version: ${state.schemaVersion}`,
    `-- Generated At: ${new Date().toISOString()}`,
    '',
    ...SQLITE_MIGRATIONS.map((m) => `-- Migration: ${m.name}\n${m.upSql}\n`),
    'BEGIN TRANSACTION;',
    '',
    `INSERT INTO driver_profile VALUES (${escapeSql(p.id)}, ${escapeSql(p.full_name)}, ${escapeSql(p.sms_greeting_name)}, ${escapeSql(p.telebirr_phone)}, ${escapeSql(p.account_type)}, ${escapeSql(p.vehicle_type)}, ${escapeSql(p.vehicle_plate)}, ${escapeSql(p.primary_corridor)}, ${escapeSql(p.sub_city)}, ${escapeSql(p.daily_target_minor_units)}, ${escapeSql(p.driver_license_number)}, ${escapeSql(p.created_at)}, ${escapeSql(p.updated_at)});`,
    '',
  ];

  for (const t of state.trips) {
    lines.push(
      `INSERT INTO trips VALUES (${escapeSql(t.id)}, ${escapeSql(t.start_location_name)}, ${escapeSql(t.start_latitude)}, ${escapeSql(t.start_longitude)}, ${escapeSql(t.start_location_accuracy)}, ${escapeSql(t.start_location_source)}, ${escapeSql(t.start_time)}, ${escapeSql(t.end_location_name)}, ${escapeSql(t.end_latitude)}, ${escapeSql(t.end_longitude)}, ${escapeSql(t.end_location_accuracy)}, ${escapeSql(t.end_location_source)}, ${escapeSql(t.end_time)}, ${escapeSql(t.duration)}, ${escapeSql(t.status)}, ${escapeSql(t.notes)}, ${escapeSql(t.created_at)}, ${escapeSql(t.updated_at)});`
    );
  }

  lines.push('');
  for (const tx of state.transactions) {
    lines.push(
      `INSERT INTO transactions VALUES (${escapeSql(tx.id)}, ${escapeSql(tx.trip_id)}, ${escapeSql(tx.transaction_id)}, ${escapeSql(tx.transaction_type)}, ${escapeSql(tx.payment_method)}, ${escapeSql(tx.amount_minor_units)}, ${escapeSql(tx.currency)}, ${escapeSql(tx.sender_name)}, ${escapeSql(tx.sender_phone)}, ${escapeSql(tx.recipient_name)}, ${escapeSql(tx.transaction_date)}, ${escapeSql(tx.iso_date)}, ${escapeSql(tx.transaction_time)}, ${escapeSql(tx.account_balance_minor_units)}, ${escapeSql(tx.sms_sender)}, ${escapeSql(tx.transaction_status)}, ${escapeSql(tx.original_transaction_id)}, ${escapeSql(tx.description)}, ${escapeSql(tx.created_at)}, ${escapeSql(tx.updated_at)});`
    );
  }

  lines.push('');
  for (const rec of state.smsProcessingRecords) {
    lines.push(
      `INSERT INTO sms_processing_records VALUES (${escapeSql(rec.id)}, ${escapeSql(rec.sender_id)}, ${escapeSql(rec.message_fingerprint)}, ${escapeSql(rec.classification)}, ${escapeSql(rec.processing_status)}, ${escapeSql(rec.received_at)}, ${escapeSql(rec.processed_at)}, ${escapeSql(rec.error_message)}, ${escapeSql(rec.summary_note)});`
    );
  }

  lines.push('', 'COMMIT;');
  return lines.join('\n');
}
