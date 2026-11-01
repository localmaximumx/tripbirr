export enum SmsMessageType {
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_SENT = 'PAYMENT_SENT',
  TRANSFER_RECEIVED = 'TRANSFER_RECEIVED',
  TRANSFER_SENT = 'TRANSFER_SENT',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_REVERSED = 'PAYMENT_REVERSED',
  REFUND = 'REFUND',
  ACCOUNT_BALANCE_UPDATE = 'ACCOUNT_BALANCE_UPDATE',
  SERVICE_NOTIFICATION = 'SERVICE_NOTIFICATION',
  PROMOTIONAL_MESSAGE = 'PROMOTIONAL_MESSAGE',
  RECHARGE = 'RECHARGE',
  UNKNOWN = 'UNKNOWN',
}

export enum ProcessingStatus {
  PROCESSED = 'PROCESSED',
  DUPLICATE = 'DUPLICATE',
  IGNORED_NON_FINANCIAL = 'IGNORED_NON_FINANCIAL',
  FAILED_VALIDATION = 'FAILED_VALIDATION',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
}

export interface RawSmsInput {
  senderId: string;
  body: string;
  receivedAt?: string; // ISO UTC timestamp
}

export interface ParsedTelebirrSms {
  smsSenderId: string;
  messageType: SmsMessageType;
  recipient: string | null;
  amount: number | null;
  amountMinorUnits: number | null; // Integer cents, e.g., ETB 50.00 -> 5000
  currency: string;
  senderName: string | null;
  senderPhone: string | null;
  transactionDate: string | null; // DD/MM/YYYY or normalized
  isoDate: string | null; // YYYY-MM-DD for reliable SQLite range queries
  transactionTime: string | null; // HH:mm:ss
  transactionId: string | null;
  originalTransactionId: string | null;
  accountBalance: number | null;
  accountBalanceMinorUnits: number | null;
  messageFingerprint: string;
  missingFields: string[];
  isValidFinancialTransaction: boolean;
  isIncomingIncome: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  isSenderValid: boolean;
  errors: string[];
  warnings: string[];
  requiresReview: boolean;
}
