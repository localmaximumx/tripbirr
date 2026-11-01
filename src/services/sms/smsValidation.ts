import { ParsedTelebirrSms, SmsMessageType, ValidationResult } from './smsTypes';
import { isTelebirrSender } from './smsClassifier';

/**
 * Validates a parsed Telebirr SMS object before persisting to SQLite.
 * Enforces strict financial accuracy rules:
 * - Only sender 127 is accepted
 * - Unknown, promotional, service, or failed messages are never marked as valid financial transactions
 * - Missing transaction IDs trigger a warning and fallback fingerprint deduplication
 */
export function validateParsedSms(parsed: ParsedTelebirrSms): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let requiresReview = false;

  const isSenderValid = isTelebirrSender(parsed.smsSenderId);
  if (!isSenderValid) {
    errors.push(`Untrusted SMS sender ID "${parsed.smsSenderId}". Expected "127".`);
  }

  if (parsed.messageType === SmsMessageType.UNKNOWN) {
    requiresReview = true;
    errors.push('Unrecognized SMS format from sender 127. Flagged for review.');
  }

  const nonFinancialTypes = [
    SmsMessageType.PROMOTIONAL_MESSAGE,
    SmsMessageType.SERVICE_NOTIFICATION,
    SmsMessageType.ACCOUNT_BALANCE_UPDATE,
    SmsMessageType.PAYMENT_FAILED,
  ];

  if (nonFinancialTypes.includes(parsed.messageType)) {
    return {
      isValid: false,
      isSenderValid,
      errors,
      warnings: [`Non-income message type: ${parsed.messageType}`],
      requiresReview: false,
    };
  }

  // Validate financial transaction fields
  if (parsed.isValidFinancialTransaction) {
    if (!parsed.amountMinorUnits || parsed.amountMinorUnits <= 0) {
      errors.push('Invalid or missing transaction amount.');
    }

    if (!parsed.transactionId) {
      warnings.push('Missing Telebirr transaction ID; using deterministic fingerprint fallback.');
      requiresReview = true;
    }

    if (!parsed.senderName) {
      warnings.push('Counterparty name not found in SMS.');
    }

    if (!parsed.transactionDate || !parsed.transactionTime) {
      warnings.push('Transaction timestamp missing from SMS body; falling back to reception time.');
    }
  } else if (parsed.messageType !== SmsMessageType.UNKNOWN) {
    errors.push('Financial SMS is missing a valid positive amount.');
    requiresReview = true;
  }

  return {
    isValid: isSenderValid && errors.length === 0 && parsed.isValidFinancialTransaction,
    isSenderValid,
    errors,
    warnings,
    requiresReview,
  };
}
