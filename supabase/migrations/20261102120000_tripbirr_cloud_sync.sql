-- TripBirr Cloud Database Schema & Row-Level Security
-- Created: 2026-11-02

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  sms_greeting_name text DEFAULT '',
  phone text DEFAULT '',
  account_type text DEFAULT 'PERSONAL_EMONEY',
  vehicle_type text DEFAULT 'MINIBUS_TAXI',
  vehicle_plate text DEFAULT '',
  primary_corridor text DEFAULT '',
  sub_city text DEFAULT '',
  daily_target_minor_units bigint DEFAULT 200000,
  driver_license_number text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Trips Table
CREATE TABLE IF NOT EXISTS public.trips (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_location_name text NOT NULL,
  start_latitude double precision,
  start_longitude double precision,
  start_location_accuracy double precision,
  start_location_source text DEFAULT 'GPS',
  start_time timestamptz NOT NULL,
  end_location_name text,
  end_latitude double precision,
  end_longitude double precision,
  end_location_accuracy double precision,
  end_location_source text,
  end_time timestamptz,
  duration integer,
  status text NOT NULL DEFAULT 'ACTIVE',
  notes text,
  route_distance_meters double precision,
  route_polyline jsonb,
  route_source text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id text REFERENCES public.trips(id) ON DELETE SET NULL,
  transaction_id text,
  transaction_type text NOT NULL,
  payment_method text NOT NULL DEFAULT 'TELEBIRR',
  amount_minor_units bigint NOT NULL,
  currency text NOT NULL DEFAULT 'ETB',
  sender_name text,
  sender_phone text,
  recipient_name text,
  transaction_date text NOT NULL,
  iso_date text NOT NULL,
  transaction_time text NOT NULL,
  account_balance_minor_units bigint,
  sms_sender text NOT NULL DEFAULT '127',
  transaction_status text NOT NULL DEFAULT 'VALID',
  original_transaction_id text,
  description text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Payment Classifications Table
CREATE TABLE IF NOT EXISTS public.payment_classifications (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id text NOT NULL DEFAULT '127',
  message_fingerprint text NOT NULL,
  classification text NOT NULL,
  processing_status text NOT NULL,
  received_at timestamptz NOT NULL,
  processed_at timestamptz NOT NULL,
  summary_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. User Settings Table
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  app_name text DEFAULT 'TripBirr',
  notification_sound boolean DEFAULT true,
  notification_vibration boolean DEFAULT true,
  voice_announcement boolean DEFAULT true,
  notification_preview boolean DEFAULT true,
  silent_mode boolean DEFAULT false,
  auto_suggest_trip_association boolean DEFAULT true,
  currency_display text DEFAULT 'ETB',
  language text DEFAULT 'en',
  theme text DEFAULT 'dark',
  privacy_hide_balance boolean DEFAULT false,
  privacy_mask_sender_names boolean DEFAULT false,
  privacy_mask_phones boolean DEFAULT false,
  privacy_hide_popup_amounts boolean DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON public.trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_start_time ON public.trips(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_trip_id ON public.transactions(trip_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_txn ON public.transactions(user_id, transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_iso_date ON public.transactions(user_id, iso_date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_classifications_user_fp ON public.payment_classifications(user_id, message_fingerprint);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);

-- Trips RLS Policies
DROP POLICY IF EXISTS "trips_select_own" ON public.trips;
CREATE POLICY "trips_select_own" ON public.trips FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "trips_insert_own" ON public.trips;
CREATE POLICY "trips_insert_own" ON public.trips FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "trips_update_own" ON public.trips;
CREATE POLICY "trips_update_own" ON public.trips FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "trips_delete_own" ON public.trips;
CREATE POLICY "trips_delete_own" ON public.trips FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Transactions RLS Policies
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
CREATE POLICY "transactions_insert_own" ON public.transactions FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "transactions_update_own" ON public.transactions;
CREATE POLICY "transactions_update_own" ON public.transactions FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "transactions_delete_own" ON public.transactions;
CREATE POLICY "transactions_delete_own" ON public.transactions FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Payment Classifications RLS Policies
DROP POLICY IF EXISTS "payment_classifications_select_own" ON public.payment_classifications;
CREATE POLICY "payment_classifications_select_own" ON public.payment_classifications FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "payment_classifications_insert_own" ON public.payment_classifications;
CREATE POLICY "payment_classifications_insert_own" ON public.payment_classifications FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "payment_classifications_update_own" ON public.payment_classifications;
CREATE POLICY "payment_classifications_update_own" ON public.payment_classifications FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "payment_classifications_delete_own" ON public.payment_classifications;
CREATE POLICY "payment_classifications_delete_own" ON public.payment_classifications FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- User Settings RLS Policies
DROP POLICY IF EXISTS "user_settings_select_own" ON public.user_settings;
CREATE POLICY "user_settings_select_own" ON public.user_settings FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_settings_insert_own" ON public.user_settings;
CREATE POLICY "user_settings_insert_own" ON public.user_settings FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_settings_update_own" ON public.user_settings;
CREATE POLICY "user_settings_update_own" ON public.user_settings FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- API Access Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Auto-provision profile and settings on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, sms_greeting_name, phone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'sms_greeting_name', ''),
    COALESCE(new.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;
