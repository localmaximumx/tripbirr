# TripBirr — Telebirr Driver Companion

An offline-first Android companion application designed for Ethiopian drivers to automatically detect incoming Telebirr SMS notifications from sender ID `127`, parse payment details into integer minor units (cents), associate passenger payments with active trips, and track per-trip earnings.

---

## Core Capabilities

1. **Telebirr `127` SMS Classification & Parsing (`src/services/sms/`)**
   - Strictly verifies official sender ID `127`.
   - Classifies incoming SMS messages into `PAYMENT_RECEIVED`, `TRANSFER_RECEIVED`, `PAYMENT_SENT`, `TRANSFER_SENT`, `PAYMENT_FAILED`, `PAYMENT_REVERSED`, `REFUND`, `ACCOUNT_BALANCE_UPDATE`, `SERVICE_NOTIFICATION`, `PROMOTIONAL_MESSAGE`, and `UNKNOWN`.
   - Extracts recipient name, amount (stored as integer minor units, e.g. `ETB 50.00` = `5000`), currency (`ETB`), sender name, sender phone (`2519****8747`), transaction date & time, transaction ID (`DJL25NAFRW`), original transaction ID for reversals/refunds, and E-Money balance.
   - Prevents duplicate transactions using the unique `transaction_id` constraint and a deterministic FNV-1a/SHA-256 fallback fingerprint (`message_fingerprint`) when a transaction ID is missing.

2. **Native Android Background SMS Receiver (`android/app/src/main/java/com/tripbirr/`)**
   - `SmsReceiver.kt`: Native Kotlin `BroadcastReceiver` for `android.provider.Telephony.SMS_RECEIVED` that queues incoming `127` messages in a native SQLite table (`native_sms_queue`) when the React Native JS runtime is inactive or closed.
   - `SmsModule.kt`: React Native bridge module for checking `RECEIVE_SMS` permission and draining queued background messages on app launch.

3. **Offline-First Relational SQLite Database (`src/database/`)**
   - Normalized tables: `trips`, `transactions`, `sms_processing_records`, and `settings`.
   - Enforces foreign keys (`trip_id REFERENCES trips(id) ON DELETE SET NULL`) so deleting or cancelling a trip preserves all associated payments as unassigned.
   - Strictly separates incoming Telebirr revenue from manual cash entries (`CASH`) and outgoing transactions (`PAYMENT_SENT`).

4. **Trip Management & Voice Announcements**
   - One-tap **Start Trip** and **End Trip** with single-point GPS capture or manual Addis Ababa hub selection (`4 Kilo`, `Piassa`, `Bole Medhanialem`, `Mexico Square`, `Megenagna`, `CMC Michael`, `Merkato`, `Kazanchis`).
   - Offline notification chime, vibration, and optional Text-to-Speech voice announcement (*"Payment received, 50 birr from Natnael Birhanu"*).

---

## Running Locally

```bash
npm install
npm run dev
```
