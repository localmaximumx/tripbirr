import {
  ParsedTelebirrSms,
  ProcessingStatus,
  RawSmsInput,
  SmsMessageType,
  ValidationResult,
} from './smsTypes';
import { parseTelebirrSms } from './smsParser';
import { validateParsedSms } from './smsValidation';

export interface ProcessedSmsOutcome {
  parsed: ParsedTelebirrSms;
  validation: ValidationResult;
  processingStatus: ProcessingStatus;
  shouldCreateTransaction: boolean;
  shouldNotifyDriver: boolean;
  suggestedTripAssociation: boolean;
}

/**
 * Coordinates the end-to-end SMS pipeline (Classify -> Parse -> Validate -> Deduplicate check)
 * without coupling to React components.
 */
export function evaluateIncomingSms(
  rawInput: RawSmsInput,
  options: {
    existingTransactionIds: Set<string>;
    existingFingerprints: Set<string>;
    hasActiveTrip: boolean;
  }
): ProcessedSmsOutcome {
  const parsed = parseTelebirrSms(rawInput);
  const validation = validateParsedSms(parsed);

  // 1. Check duplicate by primary Transaction ID first
  if (
    parsed.transactionId &&
    options.existingTransactionIds.has(parsed.transactionId.toUpperCase())
  ) {
    return {
      parsed,
      validation,
      processingStatus: ProcessingStatus.DUPLICATE,
      shouldCreateTransaction: false,
      shouldNotifyDriver: false,
      suggestedTripAssociation: false,
    };
  }

  // 2. Check duplicate by fallback deterministic fingerprint
  if (options.existingFingerprints.has(parsed.messageFingerprint)) {
    return {
      parsed,
      validation,
      processingStatus: ProcessingStatus.DUPLICATE,
      shouldCreateTransaction: false,
      shouldNotifyDriver: false,
      suggestedTripAssociation: false,
    };
  }

  // 3. Handle non-financial messages (Promotional, Service, Balance Enquiry)
  if (
    [
      SmsMessageType.PROMOTIONAL_MESSAGE,
      SmsMessageType.SERVICE_NOTIFICATION,
      SmsMessageType.ACCOUNT_BALANCE_UPDATE,
      SmsMessageType.RECHARGE,
    ].includes(parsed.messageType)
  ) {
    return {
      parsed,
      validation,
      processingStatus: ProcessingStatus.IGNORED_NON_FINANCIAL,
      shouldCreateTransaction: false,
      shouldNotifyDriver: false,
      suggestedTripAssociation: false,
    };
  }

  // 4. Handle failed payment messages (record as FAILED or log, never increase income)
  if (parsed.messageType === SmsMessageType.PAYMENT_FAILED) {
    return {
      parsed,
      validation,
      processingStatus: ProcessingStatus.IGNORED_NON_FINANCIAL,
      shouldCreateTransaction: false,
      shouldNotifyDriver: false,
      suggestedTripAssociation: false,
    };
  }

  // 5. Handle unknown or invalid financial messages
  if (!validation.isValid) {
    return {
      parsed,
      validation,
      processingStatus: validation.requiresReview
        ? ProcessingStatus.NEEDS_REVIEW
        : ProcessingStatus.FAILED_VALIDATION,
      shouldCreateTransaction: false,
      shouldNotifyDriver: false,
      suggestedTripAssociation: false,
    };
  }

  // 6. Valid financial transaction (Incoming, Outgoing, Refund, or Reversal)
  const isIncoming = parsed.isIncomingIncome;

  return {
    parsed,
    validation,
    processingStatus: ProcessingStatus.PROCESSED,
    shouldCreateTransaction:
      isIncoming ||
      parsed.messageType === SmsMessageType.PAYMENT_REVERSED ||
      parsed.messageType === SmsMessageType.REFUND,
    shouldNotifyDriver: isIncoming,
    suggestedTripAssociation: isIncoming && options.hasActiveTrip,
  };
}
