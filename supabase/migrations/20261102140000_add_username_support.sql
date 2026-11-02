-- TripBirr Cloud Sync: Add unique username support for driver accounts
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- 2. Create or replace register_driver_account with p_username support
CREATE OR REPLACE FUNCTION public.register_driver_account(
  p_full_name text,
  p_phone text,
  p_secret text,
  p_vehicle_type text DEFAULT 'MINIBUS_TAXI',
  p_vehicle_plate text DEFAULT 'Code 3 - A58291 AA',
  p_primary_corridor text DEFAULT 'Bole ↔ Piassa / Megenagna ↔ Saris',
  p_daily_target bigint DEFAULT 200000,
  p_username text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_phone text;
  v_clean_username text;
  v_email text;
  v_user_id uuid;
  v_existing_id uuid;
  v_taken_user_id uuid;
  v_first_name text;
BEGIN
  -- Normalize phone digits
  v_clean_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF substring(v_clean_phone from 1 for 3) = '251' AND length(v_clean_phone) = 12 THEN
    NULL;
  ELSIF substring(v_clean_phone from 1 for 1) = '0' AND length(v_clean_phone) = 10 THEN
    v_clean_phone := '251' || substring(v_clean_phone from 2);
  ELSIF substring(v_clean_phone from 1 for 1) = '9' AND length(v_clean_phone) = 9 THEN
    v_clean_phone := '251' || v_clean_phone;
  END IF;

  -- Normalize username
  IF p_username IS NOT NULL AND trim(p_username) != '' THEN
    v_clean_username := lower(regexp_replace(trim(p_username), '[^a-zA-Z0-9_.]', '', 'g'));
  ELSE
    v_clean_username := NULL;
  END IF;

  v_first_name := split_part(trim(p_full_name), ' ', 1);
  IF v_first_name = '' THEN
    v_first_name := 'Driver';
  END IF;

  -- 1. Check if username is already taken by another account
  IF v_clean_username IS NOT NULL THEN
    SELECT p.id INTO v_taken_user_id
    FROM public.profiles p
    WHERE lower(p.username) = v_clean_username
    LIMIT 1;

    -- Also check in auth.users metadata or email
    IF v_taken_user_id IS NULL THEN
      SELECT u.id INTO v_taken_user_id
      FROM auth.users u
      WHERE lower(u.email) = ('driver_' || v_clean_username || '@tripbirr.com')
         OR lower(u.raw_user_meta_data->>'username') = v_clean_username
      LIMIT 1;
    END IF;
  END IF;

  -- 2. Check if phone already exists
  SELECT id INTO v_existing_id
  FROM auth.users
  WHERE phone = v_clean_phone OR email = ('driver_' || v_clean_phone || '@tripbirr.com')
  LIMIT 1;

  IF v_existing_id IS NULL AND v_clean_username IS NOT NULL THEN
    -- If user not found by phone, check if user found by username
    v_existing_id := v_taken_user_id;
  END IF;

  -- If username is taken by a different account
  IF v_clean_username IS NOT NULL AND v_taken_user_id IS NOT NULL AND (v_existing_id IS NULL OR v_taken_user_id != v_existing_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Username "' || v_clean_username || '" is already taken. Please choose another username.'
    );
  END IF;

  -- Determine auth email
  IF v_clean_username IS NOT NULL AND v_clean_username != '' THEN
    v_email := 'driver_' || v_clean_username || '@tripbirr.com';
  ELSE
    v_email := 'driver_' || v_clean_phone || '@tripbirr.com';
  END IF;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing user credentials and metadata
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_secret, extensions.gen_salt('bf')),
        email = v_email,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        phone = COALESCE(phone, v_clean_phone),
        phone_confirmed_at = COALESCE(phone_confirmed_at, now()),
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, ''),
        phone_change = COALESCE(phone_change, ''),
        phone_change_token = COALESCE(phone_change_token, ''),
        email_change_token_current = COALESCE(email_change_token_current, ''),
        reauthentication_token = COALESCE(reauthentication_token, ''),
        raw_user_meta_data = jsonb_build_object(
          'full_name', p_full_name,
          'username', v_clean_username,
          'phone', v_clean_phone,
          'vehicle_type', p_vehicle_type,
          'vehicle_plate', p_vehicle_plate,
          'primary_corridor', p_primary_corridor,
          'daily_target_minor_units', p_daily_target
        ),
        updated_at = now()
    WHERE id = v_existing_id;

    -- Update identity data
    UPDATE auth.identities
    SET identity_data = jsonb_build_object('sub', v_existing_id::text, 'email', v_email),
        updated_at = now()
    WHERE user_id = v_existing_id;

    v_user_id := v_existing_id;
  ELSE
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      phone,
      phone_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      phone_change,
      phone_change_token,
      email_change_token_current,
      reauthentication_token,
      is_sso_user
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(p_secret, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', p_full_name,
        'username', v_clean_username,
        'phone', v_clean_phone,
        'vehicle_type', p_vehicle_type,
        'vehicle_plate', p_vehicle_plate,
        'primary_corridor', p_primary_corridor,
        'daily_target_minor_units', p_daily_target
      ),
      now(),
      now(),
      v_clean_phone,
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      false
    );

    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      now(),
      now(),
      now()
    );
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    username,
    sms_greeting_name,
    phone,
    vehicle_type,
    vehicle_plate,
    primary_corridor,
    daily_target_minor_units,
    updated_at
  ) VALUES (
    v_user_id,
    p_full_name,
    v_clean_username,
    v_first_name,
    v_clean_phone,
    p_vehicle_type,
    p_vehicle_plate,
    p_primary_corridor,
    p_daily_target,
    now()
  ) ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    username = COALESCE(EXCLUDED.username, public.profiles.username),
    sms_greeting_name = EXCLUDED.sms_greeting_name,
    phone = EXCLUDED.phone,
    vehicle_type = EXCLUDED.vehicle_type,
    vehicle_plate = EXCLUDED.vehicle_plate,
    primary_corridor = EXCLUDED.primary_corridor,
    daily_target_minor_units = EXCLUDED.daily_target_minor_units,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'username', v_clean_username,
    'email', v_email,
    'phone', v_clean_phone
  );
END;
$$;

-- 3. Create or replace lookup_driver_auth_email with username first
CREATE OR REPLACE FUNCTION public.lookup_driver_auth_email(p_identifier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_trimmed text;
  v_clean_phone text;
  v_email text;
BEGIN
  v_trimmed := lower(trim(p_identifier));
  IF v_trimmed = '' THEN
    RETURN NULL;
  END IF;

  -- 1. Check profiles by unique username
  SELECT u.email INTO v_email
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE lower(p.username) = v_trimmed
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- Check auth.users by email 'driver_' || v_trimmed || '@tripbirr.com'
  SELECT email INTO v_email
  FROM auth.users
  WHERE lower(email) = ('driver_' || v_trimmed || '@tripbirr.com')
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- Check auth.users metadata for username
  SELECT email INTO v_email
  FROM auth.users
  WHERE lower(raw_user_meta_data->>'username') = v_trimmed
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- 2. Check by phone number
  v_clean_phone := regexp_replace(p_identifier, '[^0-9]', '', 'g');
  IF length(v_clean_phone) >= 9 THEN
    IF substring(v_clean_phone from 1 for 3) = '251' AND length(v_clean_phone) = 12 THEN
      NULL;
    ELSIF substring(v_clean_phone from 1 for 1) = '0' AND length(v_clean_phone) = 10 THEN
      v_clean_phone := '251' || substring(v_clean_phone from 2);
    ELSIF substring(v_clean_phone from 1 for 1) = '9' AND length(v_clean_phone) = 9 THEN
      v_clean_phone := '251' || v_clean_phone;
    END IF;

    SELECT u.email INTO v_email
    FROM auth.users u
    WHERE u.phone = v_clean_phone OR u.email = ('driver_' || v_clean_phone || '@tripbirr.com')
    LIMIT 1;

    IF v_email IS NOT NULL THEN
      RETURN v_email;
    END IF;

    -- Check phone in profiles
    SELECT u.email INTO v_email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.phone = v_clean_phone
    LIMIT 1;

    IF v_email IS NOT NULL THEN
      RETURN v_email;
    END IF;
  END IF;

  -- 3. Check by full name or sms_greeting_name in profiles
  SELECT u.email INTO v_email
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE lower(p.full_name) = v_trimmed
     OR lower(p.sms_greeting_name) = v_trimmed
  ORDER BY (lower(p.full_name) = v_trimmed) DESC
  LIMIT 1;

  RETURN v_email;
END;
$$;
