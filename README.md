# TripBirr — Telebirr Driver Companion & Fare Ledger 🚕🇪🇹

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Android%207.0%2B%20%7C%20React%20Native%20WebView%20%7C%20Web%20PWA-green.svg)](#architecture)
[![Language](https://img.shields.io/badge/language-TypeScript%20%7C%20React%2019%20%7C%20Tailwind%204-teal.svg)](#tech-stack)
[![Localization](https://img.shields.io/badge/localization-English%20%7C%20%E1%80%8A%E1%88%9B%E1%88%AD%E1%88%9B%20(Amharic)-orange.svg)](#multilingual-support)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#building--running)
[![Storage & Sync](https://img.shields.io/badge/storage-Offline--First%20%2B%20Supabase%20Sync-darkgreen.svg)](#offline-first--cloud-sync-architecture)
[![Reusable Skills](https://img.shields.io/badge/antigravity-4%20reusable%20skills-purple.svg)](#reusable-engineering-skills)

> **TripBirr** is an offline-first companion application engineered specifically for Ethiopian drivers (minibus taxis, Lada taxis, bajaj, and ride-hailing operators). It automates the detection, validation, parsing, and attribution of incoming **Telebirr** passenger payments from Ethio Telecom's official sender shortcode **`127`**, seamlessly merging electronic and cash revenue into an auditable financial ledger with optional cloud synchronization.

---

## 📖 The Problem & Context

Across Addis Ababa and Ethiopian metropolitan corridors, over 80% of urban commuters pay public transit and taxi fares using **Telebirr** (Ethio Telecom). Drivers operating high-frequency passenger routes face significant friction:

1. **Dangerous Driver Distraction**: Drivers must manually unlock their phones during stop-and-go traffic to read 4-line Telebirr confirmation text messages.
2. **Payment Fraud & Fake SMS**: Commuters sometimes display forged confirmation screenshots or spoofed SMS alerts.
3. **Fragmented Revenue**: Drivers collect both physical cash and electronic Telebirr payments, making end-of-shift reconciliation and vehicle fuel/association accounting tedious.
4. **Network Dropouts**: Cellular connectivity frequently drops along highway corridors or underground parking hubs, causing cloud-dependent apps to hang or lose state.

**TripBirr** solves this directly on the driver's device with zero latency, running completely offline by default, and seamlessly synchronizing with the cloud when connected.

---

## ✨ Key Features

### 1. 🔔 Intelligent 127 SMS Detection & Voice Chime
* **Native Broadcast Interceptor**: Captures incoming Telebirr SMS messages directly via native Android `BroadcastReceiver` (`android.provider.Telephony.SMS_RECEIVED`).
* **Strict Filter for `127`**: Ignores all personal, OTP, and banking messages. Never reads personal chats.
* **Smart Inflow Verification**: Strictly checks for incoming payment markers (`received`, `credited with`, `ተቀብለዋል`). Outgoing transfers sent to others and airtime/package recharges (`recharge`, `የአየር ሰዓት`) are completely ignored.
* **Instant Voice Announcement (TTS)**: Plays an offline notification chime and speaks the fare aloud in real-time (*"Payment received: 50 birr from Natnael"*), allowing the driver to keep both eyes on the road.

### 2. 🚖 Active Trip Lifecycle & Corridor Association
* **One-Tap Trip Management**: Start and complete trips along known transit corridors (e.g. *Bole ⇄ Piassa*, *Mexico ⇄ Megenagna*, *Merkato ⇄ CMC*).
* **Automated Fare Attribution**: Payments received while a trip is active automatically prompt to link to that trip.
* **Trip Deletion with Data Preservation**: Drivers can delete trips (with full confirmation), while linked payments are never lost—they are automatically unlinked and tagged as **`● ያልተገናኘ` / `● Unassigned`**.
* **Transactions Immutability**: Financial transaction records cannot be deleted, preserving audit integrity.
* **Manual Cash Tracker**: Quick modal to record physical paper cash payments with preset quick-denominations (+10, +25, +50, +100 ETB).

### 3. 👆 Mobile Gestures & Safe-Area Ergonomics
* **Swipe-to-Dismiss Notifications**: Floating heads-up banners can be wiped away by swiping left or right (with natural velocity flick, tilt, and spring resistance), or dismissed via the `X` button.
* **Safe-Area Notch Adaptation**: Banner overlays dynamically calculate top spacing (`max(1.75rem, env(safe-area-inset-top, 1.75rem))`), guaranteeing clearance from camera notches, status bars, and dynamic islands.
* **Non-Intrusive Floating Overlays**: Popups never shift or push page content downward.

### 4. 🧪 On-Device SMS Simulator & Testbench
* **One-Click Simulator Drawer**: Accessible directly from the top bar on the Home screen.
* **Preset Test Payloads**: Test standard English Telebirr receipts, Amharic formats, and reversed name structures without sending physical cellular messages.
* **Instant Verification**: Exercises the complete pipeline: parsing, FNV-1a deduplication, audio readout, heads-up banner, and trip association prompt.

### 5. ☁️ Offline-First Persistence & Supabase Cloud Sync
* **Zero-Latency Local Storage**: All reads and writes occur against local persistent state instantly (Zustand + LocalStorage).
* **Supabase Cloud Sync**: Optional sign-in / registration using unique username and secure PIN.
* **Monotonic Versioning**: Automatic conflict-free resolution using `version` increments and UTC timestamps.
* **Offline Deletion Tombstones**: Deleting a trip while offline queues the deletion in a tombstone log (`trip_deletions`) to ensure reliable synchronization upon reconnecting.
* **Anonymous-to-Authenticated Account Migration**: Drivers can use the app immediately without signing up; upon account creation, all local anonymous trips and transactions migrate seamlessly to their cloud account without data loss.
* **Pull-to-Refresh**: Native pull-down gesture to trigger on-demand bidirectional sync with Supabase.

### 6. 🛡️ Privacy Shield & Balance Masking
* **Anti-Shoulder-Surfing**: Drivers operating around passengers can tap the **Eye Icon** in the top app bar to mask confidential shift revenue (`**** ETB`).
* **Selective Masking**: Masks total aggregate balances while leaving individual operational passenger payments visible for verification.
* **Phone Number Redaction**: Passenger phone numbers are automatically redacted (`2519****8747`) for passenger privacy.

### 7. 🌐 Full English & Amharic (አማርኛ) Localization
* Complete runtime language switching between English and Amharic.
* Every UI screen, modal, badge, button, and report heading is localized into formal, native Amharic.

### 8. 📊 Shift Analytics & One-Click CSV Export
* Daily and cumulative revenue breakdown (Total Revenue, Cash vs Telebirr split, average trip fare, highest trip).
* Daily target progress bar with celebratory achievement banners.
* 100% client-side **CSV export** for accounting, fleet owners, or tax records.

---

## 🏛️ System Architecture

TripBirr combines an offline-first native Android container with a high-performance React 19 / TypeScript single-page application bundled locally via `WebViewAssetLoader` / `file:///android_asset/web/`.

```mermaid
flowchart TD
    SMS[Incoming SMS from Shortcode 127] --> BIND[Android Telephony Subsystem]
    BIND --> REC[Native Kotlin SmsReceiver]

    subgraph Native Android Layer [Kotlin / Native Android 7.0+]
        REC --> FILTER{Filter: Sender == 127?}
        FILTER -- No --> DROP1[Drop & Ignore]
        FILTER -- Yes --> RCV_CHECK{Contains 'received' or 'ተቀብለዋል'?}
        RCV_CHECK -- No / Outgoing / Recharge --> DROP2[Drop & Ignore]
        RCV_CHECK -- Yes --> NOTIF[System Heads-Up Notification]
        RCV_CHECK -- Yes --> SQL_Q[(Native SQLite Queue: native_sms_queue)]
        SQL_Q --> BRIDGE[TripBirrNative JavascriptInterface]
        BRIDGE --> TTS[Android Text-to-Speech Engine]
    end

    subgraph Web App Runtime [React 19 + TypeScript + Vite Hybrid App]
        BRIDGE --> EVENT[TripBirrSmsReceived CustomEvent]
        EVENT --> STORE[Zustand useTripBirrStore]
        STORE --> PARSER[Telebirr SMS Parser & Deduplicator]
        PARSER --> LOCAL_DB[(Local Storage / Financial Ledger)]
        LOCAL_DB --> UI[UI Screens: Home, Trips, Ledger, Reports, Settings]
        UI --> NOTIF_CARD[Swipeable Notification Banner]
    end

    subgraph Cloud Layer [Supabase / Postgres Cloud]
        LOCAL_DB <-->|Pull-to-Refresh & Background Sync| SYNC_SVC[Sync Service]
        SYNC_SVC <--> CLOUD_DB[(Supabase Database & Auth)]
    end
```

### Data Pipeline & Financial Guarantees
1. **Deduplication Engine**: Messages are verified against existing unique Telebirr transaction IDs. If omitted or truncated, a deterministic fallback fingerprint is generated using `FNV-1a(sender | rawBody | timestamp)`.
2. **Integer Minor Units**: All monetary values are parsed and stored as 64-bit integer minor units (Ethiopian Santim / cents, e.g., `5000` for `ETB 50.00`). This completely eliminates floating-point rounding errors and precision drift in financial calculations.
3. **Zero Custody Model**: TripBirr never asks for the user's Telebirr PIN, mobile banking password, or debit credentials. It reads only passive incoming notification broadcasts on the device.

---

## 🧩 Reusable Engineering Skills

The architectural patterns developed for TripBirr have been extracted into four modular, reusable **Antigravity Skills** located in [`.agents/skills/`](.agents/skills/):

| Skill | Description | Location |
| :--- | :--- | :--- |
| [**`offline-hybrid-webview`**](.agents/skills/offline-hybrid-webview/SKILL.md) | Architect, package, and bridge React/Vite SPAs inside native React Native WebViews with local file asset loading, back button handling, TTS, and GPS. | [View Skill](.agents/skills/offline-hybrid-webview/SKILL.md) |
| [**`sms-financial-parser`**](.agents/skills/sms-financial-parser/SKILL.md) | Parse, normalize, and deduplicate mobile money SMS receipts (Telebirr 127, CBE, M-Pesa) with integer cents math and an on-device simulator. | [View Skill](.agents/skills/sms-financial-parser/SKILL.md) |
| [**`offline-first-sync`**](.agents/skills/offline-first-sync/SKILL.md) | Local-first persistence, monotonic versioning, conflict-tolerant Supabase cloud synchronization, deletion tombstones, and account migration. | [View Skill](.agents/skills/offline-first-sync/SKILL.md) |
| [**`mobile-gesture-ux`**](.agents/skills/mobile-gesture-ux/SKILL.md) | Fluid touch swipe-to-dismiss cards, CSS `touch-action: pan-y`, safe-area viewport adaptation, and high-contrast bilingual driver layouts. | [View Skill](.agents/skills/mobile-gesture-ux/SKILL.md) |

---

## 📱 User Interface & Screens

| Screen | Description |
| :--- | :--- |
| **🏠 Home / Overview** | Daily target progress, live shift revenue (with privacy masking), one-tap start/end trip, recent payments ordered by date, and SMS testbench simulator access. |
| **🚖 Trips** | Active and completed transit runs, passenger attribution lists, and interactive Leaflet map featuring hybrid road corridor tracing. Supports safe trip deletion with payment decoupling. |
| **💳 Transactions** | Searchable financial ledger with filters for Telebirr vs Cash, unassigned payments, and instant copy/verify tools. Transactions cannot be deleted to guarantee ledger integrity. |
| **📈 Reports & CSV** | Daily and historical financial summaries, per-trip analytics, highest/lowest earnings, and one-tap CSV export. |
| **⚙️ Settings & Profile** | Language toggle (English / አማርኛ), Dark/Light mode, Driver & Vehicle information, audio/TTS settings, Cloud account authentication, and diagnostic logs. |

---

## 🛠️ Tech Stack

* **Frontend**: [React 19](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/), [Tailwind CSS 4](https://tailwindcss.com/)
* **State Management**: [Zustand 5](https://github.com/pmndrs/zustand) with local persistence & optimistic updates
* **Cloud Database & Auth**: [Supabase](https://supabase.com/) (Postgres, RLS policies, custom driver authentication)
* **Icons & UI Elements**: [Lucide React](https://lucide.dev/), [Motion](https://motion.dev/)
* **Maps & Routing**: [Leaflet](https://leafletjs.com/), OpenStreetMap, OSRM road geometry engine
* **Native Android Wrapper**: Kotlin, React Native WebView, Android Text-to-Speech, BroadcastReceiver

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher)
* [npm](https://www.npmjs.com/) (v9 or higher)
* *(Optional for native Android build)*: [Android Studio](https://developer.android.com/studio) or Android SDK with JDK 17

### 1. Web Development & Testing

```bash
# Clone the repository
git clone https://github.com/localmaximumx/tripbirr.git
cd tripbirr

# Install dependencies
npm install

# Start local Vite development server
npm run dev

# Run TypeScript compilation check
npx tsc --noEmit

# Run unit verification tests (SMS parsing, financial math, deduplication)
npx tsx src/__tests__/smsAndDatabaseSuite.ts
```

### 2. Building the Web Bundle for Android

```bash
# Build production web bundle
npm run build

# Synchronize build assets into native Android assets:
# react-native/android/app/src/main/assets/web/
```

### 3. Compiling the Android APK

```bash
cd react-native/android

# On Linux / macOS:
./gradlew assembleRelease

# On Windows:
.\gradlew.bat assembleRelease
```

The signed release APK will be generated at:
`react-native/android/app/build/outputs/apk/release/app-release.apk`

---

## 🔒 Security, Privacy & Android Permissions

TripBirr requests only the bare minimum Android permissions required to serve as a companion fare ledger:

| Permission | Purpose |
| :--- | :--- |
| `android.permission.RECEIVE_SMS` | Captures incoming passenger fare confirmation texts from shortcode `127`. Ignores all non-127 messages. |
| `android.permission.POST_NOTIFICATIONS` | Displays instant heads-up banners with passenger name and amount on Android 13+. |
| `android.permission.ACCESS_FINE_LOCATION` | Records start and end coordinates for trips (optional; manual Addis Ababa landmark selection is always available). |
| `android.permission.ACCESS_COARSE_LOCATION` | Approximate location for road corridor routing. |

> **Privacy Guarantee**: All core trip recording, passenger payment attribution, and ledger calculations run **100% locally on the device**. Cloud synchronization to Supabase is user-driven and opt-in, protected with strict Row-Level Security (RLS) policies.

---

## 📄 License

TripBirr is open-source software licensed under the **[Apache License 2.0](LICENSE)**.

```
Copyright 2026 TripBirr Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```

---

## ⚠️ Disclaimer

*TripBirr is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Ethio Telecom or Telebirr. All trademarks, service marks, and company names are the property of their respective owners.*
