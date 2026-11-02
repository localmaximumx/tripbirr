---
name: sms-financial-parser
description: >-
  Design, implement, test, and debug automated financial SMS parsers, receipt normalization pipelines,
  idempotent deduplication fingerprinting, and on-device testbench simulators for mobile payment notifications.
  Use when parsing bank/telecom payment SMS (Telebirr 127, CBE Birr, M-Pesa), building financial transaction
  ingestion systems, or adding on-device SMS simulation tools.
---

# SMS Financial Parser & Testbench Architecture

This skill provides patterns and best practices for intercepting, parsing, and verifying incoming mobile money transaction SMS messages (e.g. Telebirr 127, CBE, M-Pesa) in real-time, handling edge cases, preventing double-processing via deterministic fingerprinting, and providing an on-device simulator for developer and user testing.

---

## 1. Pipeline Architecture

```
┌────────────────────────────────────────────────────────┐
│ Incoming Cellular SMS (e.g. Telebirr "127")            │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Native Android BroadcastReceiver                      │
│ • Validates originating address (e.g., "127", "telebirr")│
│ • Extracts raw body, timestamp, and metadata           │
│ • Queues in offline persistent database if app closed  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Deterministic Deduplication Fingerprint               │
│ fingerprint = SHA256(sender + rawBody + timestamp)    │
│ • Check if fingerprint already processed               │
│ • Reject / skip duplicate notifications                │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Multi-Pattern Regex Normalization Engine               │
│ • Extract amount (convert to integer minor units)     │
│ • Extract payer name (normalize reversed formats)      │
│ • Extract transaction reference ID                     │
│ • Extract post-transaction account balance            │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Transaction Creation & Notification Event             │
│ • Save to local store with status: VALID               │
│ • Trigger Native Audio Voice Announcement (TTS)        │
│ • Display non-intrusive heads-up toast                 │
└────────────────────────────────────────────────────────┘
```

---

## 2. Deterministic Deduplication Fingerprint

Never rely solely on transaction IDs extracted from the SMS body, because some SMS formats omit reference IDs or provide non-unique confirmations.

Always generate a deterministic fingerprint from the raw sender, body, and arrival date:

```typescript
// src/services/smsFingerprint.ts

export function generateSmsFingerprint(
  sender: string,
  rawBody: string,
  timestampMs?: number
): string {
  // Normalize whitespace to prevent false negatives from carrier formatting differences
  const normalizedBody = rawBody.trim().replace(/\s+/g, ' ');
  const normalizedSender = sender.trim().toUpperCase();
  
  const content = `${normalizedSender}|${normalizedBody}`;
  
  // Quick 32-bit FNV-1a or crypto hash
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `sms_${(hash >>> 0).toString(16)}`;
}
```

---

## 3. High-Resilience Financial Parsing Regexes

### Handling Minor Units (Integer Cents)
Always parse monetary amounts into integer minor units (e.g., `5000` for `50.00 ETB`) to prevent floating point inaccuracies (`0.1 + 0.2 === 0.30000000000000004`):

```typescript
export function parseAmountToMinorUnits(amountStr: string): number {
  const clean = amountStr.replace(/,/g, '').trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}
```

### Telebirr 127 Standard & Reversed Format Parsers

```typescript
export interface ParsedSmsTransaction {
  amountMinorUnits: number;
  senderName: string;
  transactionRef: string;
  payerPhone?: string;
  balanceMinorUnits?: number;
  transactionTime?: string;
}

export function parseTelebirrSms(body: string): ParsedSmsTransaction | null {
  // Pattern 1: Standard received payment:
  // "You have received ETB 150.00 from ABEBE KEBEDE (251911******) on 2026-11-02 14:30:15. Transaction ID: TA12345678. Current balance is ETB 1,250.00."
  const stdPattern = /received\s+(?:ETB|Birr)?\s*([\d,]+(?:\.\d{1,2})?)\s+from\s+([A-Za-z\s'.-]+?)(?:\s*\(([\d*]+)\))?\s+on\s+([0-9-]+\s+[0-9:]+).*?Transaction\s*(?:ID|No\.?)[:\s]*([A-Za-z0-9]+)/i;
  
  const match = body.match(stdPattern);
  if (match) {
    const [, amountStr, rawName, phone, dateStr, refId] = match;
    return {
      amountMinorUnits: parseAmountToMinorUnits(amountStr),
      senderName: cleanSenderName(rawName),
      transactionRef: refId.trim(),
      payerPhone: phone || undefined,
      transactionTime: dateStr,
    };
  }

  // Pattern 2: Amharic Telebirr format:
  // "ከ ABEBE KEBEDE (251911******) 150.00 ብር ደርሶዎታል። የግብይት ቁጥር TA12345678"
  const amharicPattern = /ከ\s+([A-Za-z\s'.-]+?)(?:\s*\(([\d*]+)\))?\s+([\d,]+(?:\.\d{1,2})?)\s*ብር\s*ደርሶዎታል።.*?የግብይት\s*ቁጥር[:\s]*([A-Za-z0-9]+)/u;
  const amMatch = body.match(amharicPattern);
  if (amMatch) {
    const [, rawName, phone, amountStr, refId] = amMatch;
    return {
      amountMinorUnits: parseAmountToMinorUnits(amountStr),
      senderName: cleanSenderName(rawName),
      transactionRef: refId.trim(),
      payerPhone: phone || undefined,
    };
  }

  return null;
}

function cleanSenderName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}
```

---

## 4. On-Device SMS Simulator & Testbench

Deploying SMS-driven mobile apps requires rapid testing without sending physical telecom SMS messages. Build an on-device drawer or bottom sheet with preset samples:

```typescript
// Preset samples for rapid on-device testing
export const TESTBENCH_SAMPLES = [
  {
    label: 'Standard Telebirr 150 ETB',
    body: 'You have received ETB 150.00 from MERON HAILE (251922******) on 2026-11-02 18:20:10. Transaction ID: TB98765432. Balance is ETB 850.00.',
    sender: '127',
  },
  {
    label: 'Amharic Telebirr 85 ETB',
    body: 'ከ KEBEDE ALEMU (251933******) 85.00 ብር ደርሶዎታል። የግብይት ቁጥር TB11223344.',
    sender: '127',
  },
  {
    label: 'Reversed Name Format',
    body: 'You have received 200.00 Birr from DANIEL, SOLOMON. Ref: TX998877.',
    sender: '127',
  },
];
```

The simulator button directly invokes the store's `processIncomingSms()` pipeline, testing:
1. Parsing accuracy.
2. Voice audio readout.
3. Heads-up popup display.
4. Active trip association heuristics.
5. Ledger balance calculation.
