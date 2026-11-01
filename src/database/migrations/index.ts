export interface MigrationDefinition {
  version: number;
  name: string;
  upSql: string;
}

export const SQLITE_MIGRATIONS: MigrationDefinition[] = [
  {
    version: 1,
    name: '001_initial_tripbirr_schema',
    upSql: `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY NOT NULL,
  start_location_name TEXT NOT NULL,
  start_latitude REAL,
  start_longitude REAL,
  start_location_accuracy REAL,
  start_location_source TEXT NOT NULL CHECK(start_location_source IN ('GPS', 'MANUAL')),
  start_time TEXT NOT NULL,
  end_location_name TEXT,
  end_latitude REAL,
  end_longitude REAL,
  end_location_accuracy REAL,
  end_location_source TEXT CHECK(end_location_source IN ('GPS', 'MANUAL')),
  end_time TEXT,
  duration INTEGER,
  status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  transaction_id TEXT UNIQUE,
  transaction_type TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('TELEBIRR', 'CASH')),
  amount_minor_units INTEGER NOT NULL CHECK(amount_minor_units > 0),
  currency TEXT NOT NULL DEFAULT 'ETB',
  sender_name TEXT,
  sender_phone TEXT,
  recipient_name TEXT,
  transaction_date TEXT NOT NULL,
  iso_date TEXT NOT NULL,
  transaction_time TEXT NOT NULL,
  account_balance_minor_units INTEGER,
  sms_sender TEXT NOT NULL,
  transaction_status TEXT NOT NULL CHECK(transaction_status IN ('VALID', 'REVERSED', 'REFUNDED', 'FAILED')),
  original_transaction_id TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sms_processing_records (
  id TEXT PRIMARY KEY NOT NULL,
  sender_id TEXT NOT NULL,
  message_fingerprint TEXT NOT NULL UNIQUE,
  classification TEXT NOT NULL,
  processing_status TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  error_message TEXT,
  summary_note TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_start_time ON trips(start_time);
CREATE INDEX IF NOT EXISTS idx_transactions_trip_id ON transactions(trip_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_id ON transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_iso_date ON transactions(iso_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_sms_fingerprint ON sms_processing_records(message_fingerprint);
`.trim(),
  },
  {
    version: 2,
    name: '002_reversal_reference_index',
    upSql: `
CREATE INDEX IF NOT EXISTS idx_transactions_original_tx_id
  ON transactions(original_transaction_id);
`.trim(),
  },
];

export const CURRENT_SCHEMA_VERSION = 2;
