import { SmsMessageType } from './smsTypes';
import { SMS_CLASSIFICATION_PATTERNS, TELEBIRR_OFFICIAL_SENDER_ID } from './smsPatterns';

/**
 * Normalizes sender ID and checks if it matches Telebirr's official short code `127`.
 */
export function isTelebirrSender(senderId: string): boolean {
  const normalized = (senderId || '').trim().toUpperCase();
  return normalized === TELEBIRR_OFFICIAL_SENDER_ID || normalized === 'TELEBIRR';
}

/**
 * Inspects and classifies a Telebirr SMS message body into a specific SmsMessageType.
 * Priority order prevents reversals, refunds, or failed messages from being misclassified
 * as incoming payments.
 */
export function classifyTelebirrSms(body: string, senderId: string = '127'): SmsMessageType {
  if (!body || typeof body !== 'string') {
    return SmsMessageType.UNKNOWN;
  }

  if (!isTelebirrSender(senderId)) {
    return SmsMessageType.UNKNOWN;
  }

  const normalizedBody = body.replace(/\s+/g, ' ').trim();

  // 1. Check failures first so "failed to receive/send" never counts as a transaction
  for (const regex of SMS_CLASSIFICATION_PATTERNS.PAYMENT_FAILED) {
    if (regex.test(normalizedBody)) {
      return SmsMessageType.PAYMENT_FAILED;
    }
  }

  // 2. Check reversals and refunds before positive/outgoing patterns
  for (const regex of SMS_CLASSIFICATION_PATTERNS.PAYMENT_REVERSED) {
    if (regex.test(normalizedBody)) {
      return SmsMessageType.PAYMENT_REVERSED;
    }
  }

  for (const regex of SMS_CLASSIFICATION_PATTERNS.REFUND) {
    if (regex.test(normalizedBody)) {
      return SmsMessageType.REFUND;
    }
  }

  // 3. Check promotional messages before generic balance/payment words
  for (const regex of SMS_CLASSIFICATION_PATTERNS.PROMOTIONAL_MESSAGE) {
    if (regex.test(normalizedBody)) {
      return SmsMessageType.PROMOTIONAL_MESSAGE;
    }
  }

  // 4. Check service notifications (OTP, PIN change, maintenance)
  for (const regex of SMS_CLASSIFICATION_PATTERNS.SERVICE_NOTIFICATION) {
    if (regex.test(normalizedBody)) {
      return SmsMessageType.SERVICE_NOTIFICATION;
    }
  }

  // 4b. Check airtime / package recharges
  for (const regex of SMS_CLASSIFICATION_PATTERNS.RECHARGE) {
    if (regex.test(normalizedBody)) {
      return SmsMessageType.RECHARGE;
    }
  }

  // 5. Check outgoing payments and transfers FIRST to avoid false positive income
  for (const regex of SMS_CLASSIFICATION_PATTERNS.PAYMENT_SENT) {
    if (regex.test(normalizedBody)) {
      return SmsMessageType.PAYMENT_SENT;
    }
  }

  for (const regex of SMS_CLASSIFICATION_PATTERNS.TRANSFER_SENT) {
    if (regex.test(normalizedBody)) {
      return SmsMessageType.TRANSFER_SENT;
    }
  }

  // 6. Check incoming payments and transfers
  for (const regex of SMS_CLASSIFICATION_PATTERNS.PAYMENT_RECEIVED) {
    if (regex.test(normalizedBody)) {
      return SmsMessageType.PAYMENT_RECEIVED;
    }
  }

  for (const regex of SMS_CLASSIFICATION_PATTERNS.TRANSFER_RECEIVED) {
    if (regex.test(normalizedBody)) {
      return SmsMessageType.TRANSFER_RECEIVED;
    }
  }

  // 7. Standalone balance update (when no payment/transfer verb matched)
  for (const regex of SMS_CLASSIFICATION_PATTERNS.ACCOUNT_BALANCE_UPDATE) {
    if (regex.test(normalizedBody)) {
      return SmsMessageType.ACCOUNT_BALANCE_UPDATE;
    }
  }

  return SmsMessageType.UNKNOWN;
}
