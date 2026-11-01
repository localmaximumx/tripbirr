import { ProcessingStatus, SmsMessageType } from '../services/sms/smsTypes';

export enum TripStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum LocationSource {
  GPS = 'GPS',
  MANUAL = 'MANUAL',
}

export enum PaymentMethod {
  TELEBIRR = 'TELEBIRR',
  CASH = 'CASH',
}

export enum TransactionStatus {
  VALID = 'VALID',
  REVERSED = 'REVERSED',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

export interface DriverProfileRecord {
  id: string;
  full_name: string;
  sms_greeting_name: string; // Matches "Dear <Name>" in Telebirr 127 SMS
  telebirr_phone: string;
  account_type: 'PERSONAL_EMONEY' | 'MERCHANT_AGENT';
  vehicle_type: 'MINIBUS_TAXI' | 'LADA_TAXI' | 'METER_RIDE' | 'BAJAJ' | 'PRIVATE';
  vehicle_plate: string;
  primary_corridor: string;
  sub_city: string;
  daily_target_minor_units: number; // e.g., 120000 = ETB 1,200.00
  driver_license_number: string;
  created_at: string;
  updated_at: string;
}

export interface TripRecord {
  id: string;
  start_location_name: string;
  start_latitude: number | null;
  start_longitude: number | null;
  start_location_accuracy: number | null;
  start_location_source: LocationSource;
  start_time: string; // UTC ISO string
  end_location_name: string | null;
  end_latitude: number | null;
  end_longitude: number | null;
  end_location_accuracy: number | null;
  end_location_source: LocationSource | null;
  end_time: string | null; // UTC ISO string
  duration: number | null; // Duration in seconds
  status: TripStatus;
  notes: string | null;
  route_distance_meters?: number | null;
  route_polyline?: [number, number][] | null;
  route_source?: 'OSRM_ROAD' | 'LOCAL_CORRIDOR_GRAPH' | 'ESTIMATED_ROAD' | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionRecord {
  id: string;
  trip_id: string | null; // Nullable foreign key -> trips.id
  transaction_id: string | null; // Unique Telebirr Transaction ID (e.g., DJL25NAFRW)
  transaction_type: SmsMessageType;
  payment_method: PaymentMethod;
  amount_minor_units: number; // Integer minor units: ETB 50.00 = 5000 cents
  currency: string; // 'ETB'
  sender_name: string | null;
  sender_phone: string | null;
  recipient_name: string | null;
  transaction_date: string; // Display date DD/MM/YYYY
  iso_date: string; // YYYY-MM-DD for date-range filtering
  transaction_time: string; // HH:mm:ss
  account_balance_minor_units: number | null;
  sms_sender: string; // '127' or 'MANUAL_CASH'
  transaction_status: TransactionStatus;
  original_transaction_id: string | null; // Links reversal/refund to original tx
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SmsProcessingRecord {
  id: string;
  sender_id: string;
  message_fingerprint: string;
  classification: SmsMessageType;
  processing_status: ProcessingStatus;
  received_at: string;
  processed_at: string;
  error_message: string | null;
  summary_note: string | null; // Redacted summary (never stores full raw inbox SMS)
}

export interface AppSettings {
  app_name: string;
  sms_permission_status: 'GRANTED' | 'DENIED' | 'NOT_REQUESTED';
  location_permission_status: 'GRANTED' | 'DENIED' | 'NOT_REQUESTED';
  notification_sound: boolean;
  notification_vibration: boolean;
  voice_announcement: boolean;
  notification_preview: boolean;
  silent_mode: boolean;
  auto_suggest_trip_association: boolean;
  currency_display: 'ETB' | 'Birr';
  language: 'en' | 'am';
  theme: 'light' | 'dark';
  schema_version: number;
  first_launch_completed?: boolean;
  // User-configurable Privacy Settings
  privacy_hide_balance?: boolean;
  privacy_mask_sender_names?: boolean;
  privacy_mask_phones?: boolean;
  privacy_hide_popup_amounts?: boolean;
}
