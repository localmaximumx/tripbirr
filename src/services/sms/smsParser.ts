import { ParsedTelebirrSms, RawSmsInput, SmsMessageType } from './smsTypes';
import { SMS_EXTRACTION_PATTERNS } from './smsPatterns';
import { classifyTelebirrSms } from './smsClassifier';

/**
 * Converts a decimal currency string (e.g., "50.00" or "1,250.5") to integer minor units (cents)
 * without floating-point rounding drift.
 * Example: "50.00" -> 5000
 */
export function parseAmountToMinorUnits(rawAmount: string): { major: number; minor: number } | null {
  if (!rawAmount) return null;
  const cleaned = rawAmount.replace(/,/g, '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) {
    return null;
  }

  const [wholePart, fracPart = ''] = cleaned.split('.');
  const whole = parseInt(wholePart, 10);
  const paddedFrac = (fracPart + '00').slice(0, 2);
  const cents = parseInt(paddedFrac, 10);

  if (Number.isNaN(whole) || Number.isNaN(cents)) {
    return null;
  }

  const minor = whole * 100 + cents;
  if (minor <= 0) {
    return null;
  }

  return {
    major: minor / 100,
    minor,
  };
}

/**
 * Normalizes date strings like "21/10/2026", "21-10-2026", or "2026-10-21"
 * into both display DD/MM/YYYY and SQLite-sortable ISO YYYY-MM-DD.
 */
export function normalizeTransactionDate(rawDate: string | null): {
  displayDate: string | null;
  isoDate: string | null;
} {
  if (!rawDate) return { displayDate: null, isoDate: null };
  const trimmed = rawDate.trim();

  // Format: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return {
      displayDate: `${day}/${month}/${year}`,
      isoDate: `${year}-${month}-${day}`,
    };
  }

  // Format: YYYY/MM/DD or YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return {
      displayDate: `${day}/${month}/${year}`,
      isoDate: `${year}-${month}-${day}`,
    };
  }

  return { displayDate: trimmed, isoDate: null };
}

/**
 * Generates a deterministic fingerprint for duplicate detection when transaction ID is missing
 * or for sms_processing_records deduplication.
 */
export function computeSmsFingerprint(input: {
  senderId: string;
  transactionId: string | null;
  messageType: SmsMessageType;
  amountMinorUnits: number | null;
  senderPhone: string | null;
  transactionDate: string | null;
  transactionTime: string | null;
  normalizedBody: string;
}): string {
  if (input.transactionId) {
    return `TX_${input.transactionId.toUpperCase()}`;
  }

  const compositeKey = [
    input.senderId.trim(),
    input.messageType,
    input.amountMinorUnits ?? 'NO_AMT',
    input.senderPhone ?? 'NO_PHONE',
    input.transactionDate ?? 'NO_DATE',
    input.transactionTime ?? 'NO_TIME',
    input.normalizedBody.toLowerCase(),
  ].join('|');

  // FNV-1a 32-bit deterministic hash
  let hash = 0x811c9dc5;
  for (let i = 0; i < compositeKey.length; i++) {
    hash ^= compositeKey.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `FP_${(hash >>> 0).toString(16).padStart(8, '0').toUpperCase()}`;
}

/**
 * Parses a raw Telebirr SMS into structured financial data.
 * Pure, side-effect-free function completely decoupled from UI and database layers.
 */
export function parseTelebirrSms(input: RawSmsInput): ParsedTelebirrSms {
  const senderId = (input.senderId || '').trim();
  const rawBody = input.body || '';
  const singleLineBody = rawBody.replace(/\s+/g, ' ').trim();

  const messageType = classifyTelebirrSms(rawBody, senderId);

  // 1. Extract Recipient ("Dear Biniyam")
  const recipientMatch = rawBody.match(SMS_EXTRACTION_PATTERNS.recipient);
  const recipient = recipientMatch ? recipientMatch[1].trim() : null;

  // 2. Extract Transaction Amount & Currency
  // Strip out the balance sentence before fallback amount matching so balance is never confused with transaction amount
  const bodyWithoutBalance = singleLineBody.replace(SMS_EXTRACTION_PATTERNS.accountBalance, '');
  let amount: number | null = null;
  let amountMinorUnits: number | null = null;
  let currency = 'ETB';

  const primaryAmountMatch = bodyWithoutBalance.match(SMS_EXTRACTION_PATTERNS.transactionAmount);
  const fallbackAmountMatch = !primaryAmountMatch
    ? bodyWithoutBalance.match(SMS_EXTRACTION_PATTERNS.fallbackAmount)
    : null;

  const matchedAmountGroup = primaryAmountMatch || fallbackAmountMatch;
  if (matchedAmountGroup) {
    const parsedAmt = parseAmountToMinorUnits(matchedAmountGroup[2]);
    if (parsedAmt) {
      amount = parsedAmt.major;
      amountMinorUnits = parsedAmt.minor;
      currency = 'ETB';
    }
  }

  // 3. Extract Sender Name & Sender Phone
  let senderName: string | null = null;
  let senderPhone: string | null = null;

  const counterpartyWithPhoneMatch = singleLineBody.match(
    SMS_EXTRACTION_PATTERNS.counterpartyWithPhone
  );
  if (counterpartyWithPhoneMatch) {
    senderName = counterpartyWithPhoneMatch[1].trim();
    senderPhone = counterpartyWithPhoneMatch[2].trim();
  } else {
    const counterpartyNoPhoneMatch = singleLineBody.match(
      SMS_EXTRACTION_PATTERNS.counterpartyWithoutPhone
    );
    if (counterpartyNoPhoneMatch) {
      senderName = counterpartyNoPhoneMatch[1].trim();
    }
    const standalonePhoneMatch = singleLineBody.match(SMS_EXTRACTION_PATTERNS.phoneInParens);
    if (standalonePhoneMatch) {
      senderPhone = standalonePhoneMatch[1].trim();
    }
  }

  // 4. Extract Date & Time
  const dateTimeMatch = singleLineBody.match(SMS_EXTRACTION_PATTERNS.dateTime);
  const rawDate = dateTimeMatch ? dateTimeMatch[1].trim() : null;
  const rawTime = dateTimeMatch && dateTimeMatch[2] ? dateTimeMatch[2].trim() : null;
  const { displayDate: transactionDate, isoDate } = normalizeTransactionDate(rawDate);
  const transactionTime = rawTime
    ? rawTime.length === 5
      ? `${rawTime}:00`
      : rawTime
    : null;

  // 5. Extract Transaction ID & Original Transaction ID (for reversals/refunds)
  const txIdMatch = singleLineBody.match(SMS_EXTRACTION_PATTERNS.transactionId);
  const transactionId = txIdMatch ? txIdMatch[1].trim().toUpperCase() : null;

  const origTxMatch = singleLineBody.match(SMS_EXTRACTION_PATTERNS.originalTransactionId);
  let originalTransactionId = origTxMatch ? origTxMatch[1].trim().toUpperCase() : null;
  if (
    !originalTransactionId &&
    (messageType === SmsMessageType.PAYMENT_REVERSED || messageType === SmsMessageType.REFUND) &&
    transactionId
  ) {
    originalTransactionId = transactionId;
  }

  // 6. Extract Account Balance
  let accountBalance: number | null = null;
  let accountBalanceMinorUnits: number | null = null;
  const balanceMatch = singleLineBody.match(SMS_EXTRACTION_PATTERNS.accountBalance);
  if (balanceMatch) {
    const parsedBal = parseAmountToMinorUnits(balanceMatch[1]);
    if (parsedBal) {
      accountBalance = parsedBal.major;
      accountBalanceMinorUnits = parsedBal.minor;
    } else if (balanceMatch[1].replace(/,/g, '').trim() === '0.00') {
      accountBalance = 0;
      accountBalanceMinorUnits = 0;
    }
  }

  // 7. Identify missing fields for financial messages
  const missingFields: string[] = [];
  const isFinancialCandidate = [
    SmsMessageType.PAYMENT_RECEIVED,
    SmsMessageType.TRANSFER_RECEIVED,
    SmsMessageType.PAYMENT_SENT,
    SmsMessageType.TRANSFER_SENT,
    SmsMessageType.PAYMENT_REVERSED,
    SmsMessageType.REFUND,
  ].includes(messageType);

  if (isFinancialCandidate) {
    if (amountMinorUnits === null) missingFields.push('amount');
    if (!transactionId) missingFields.push('transactionId');
    if (!senderName) missingFields.push('senderName');
    if (!transactionDate) missingFields.push('transactionDate');
    if (!transactionTime) missingFields.push('transactionTime');
  }

  const isIncomingIncome =
    (messageType === SmsMessageType.PAYMENT_RECEIVED ||
      messageType === SmsMessageType.TRANSFER_RECEIVED) &&
    amountMinorUnits !== null &&
    amountMinorUnits > 0;

  const isValidFinancialTransaction =
    isFinancialCandidate && amountMinorUnits !== null && amountMinorUnits > 0;

  const messageFingerprint = computeSmsFingerprint({
    senderId,
    transactionId,
    messageType,
    amountMinorUnits,
    senderPhone,
    transactionDate,
    transactionTime,
    normalizedBody: singleLineBody,
  });

  return {
    smsSenderId: senderId,
    messageType,
    recipient,
    amount,
    amountMinorUnits,
    currency,
    senderName,
    senderPhone,
    transactionDate,
    isoDate,
    transactionTime,
    transactionId,
    originalTransactionId,
    accountBalance,
    accountBalanceMinorUnits,
    messageFingerprint,
    missingFields,
    isValidFinancialTransaction,
    isIncomingIncome,
  };
}
