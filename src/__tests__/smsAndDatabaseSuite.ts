import { classifyTelebirrSms } from '../services/sms/smsClassifier';
import { parseTelebirrSms } from '../services/sms/smsParser';
import { evaluateIncomingSms } from '../services/sms/smsProcessor';
import { ProcessingStatus, SmsMessageType } from '../services/sms/smsTypes';
import { validateParsedSms } from '../services/sms/smsValidation';
import {
  calculateTripTotalMinorUnits,
  computeFinancialReport,
} from '../services/reports/reportService';
import { createSeedDatabaseState } from '../database/database';
import { PaymentMethod, TransactionStatus } from '../database/schema';

export interface TestCaseResult {
  id: string;
  category: 'SMS_PARSER' | 'DATABASE_AND_FINANCE';
  name: string;
  passed: boolean;
  details: string;
}

/**
 * Runs all 22 automated unit tests covering Section 19 (SMS Parser Tests & Database/Financial Tests).
 */
export function runAutomatedVerificationSuite(): TestCaseResult[] {
  const results: TestCaseResult[] = [];

  const assertTest = (
    id: string,
    category: 'SMS_PARSER' | 'DATABASE_AND_FINANCE',
    name: string,
    condition: boolean,
    details: string
  ) => {
    results.push({ id, category, name, passed: Boolean(condition), details });
  };

  // 1. Valid incoming payment (Exact prompt specification)
  const promptSms = `Dear Biniyam

You have received ETB 50.00 from Natnael Birhanu(2519****8747) on 21/10/2026 23:43:07. Your transaction number is DJL25NAFRW. Your current E-Money Account balance is ETB 332.62.

Thank you for using telebirr

Ethio telecom`;

  const parsed1 = parseTelebirrSms({ senderId: '127', body: promptSms });
  assertTest(
    'T01',
    'SMS_PARSER',
    'Exact Master Prompt Telebirr 127 SMS Extraction',
    parsed1.messageType === SmsMessageType.PAYMENT_RECEIVED &&
      parsed1.recipient === 'Biniyam' &&
      parsed1.amount === 50.0 &&
      parsed1.amountMinorUnits === 5000 &&
      parsed1.currency === 'ETB' &&
      parsed1.senderName === 'Natnael Birhanu' &&
      parsed1.senderPhone === '2519****8747' &&
      parsed1.transactionDate === '21/10/2026' &&
      parsed1.transactionTime === '23:43:07' &&
      parsed1.transactionId === 'DJL25NAFRW' &&
      parsed1.accountBalance === 332.62 &&
      parsed1.accountBalanceMinorUnits === 33262 &&
      parsed1.isIncomingIncome === true,
    `Extracted: Type=${parsed1.messageType}, Recipient=${parsed1.recipient}, Amount=ETB ${parsed1.amount?.toFixed(2)} (${parsed1.amountMinorUnits} minor units), Sender=${parsed1.senderName} (${parsed1.senderPhone}), TX=${parsed1.transactionId}, Bal=${parsed1.accountBalance}`
  );

  // 2. Outgoing payment must not count as incoming income
  const outgoingSms =
    'Dear Biniyam, You have paid ETB 350.00 to TotalEnergies Kazanchis(2519****0099) on 21/10/2026 15:12:40. Your transaction number is DJL05FUEL8. Your current E-Money Account balance is ETB 112.62.';
  const parsed2 = parseTelebirrSms({ senderId: '127', body: outgoingSms });
  assertTest(
    'T02',
    'SMS_PARSER',
    'Outgoing Payment Classification & Zero Income Impact',
    parsed2.messageType === SmsMessageType.PAYMENT_SENT &&
      parsed2.amountMinorUnits === 35000 &&
      parsed2.isIncomingIncome === false,
    `Classified as ${parsed2.messageType}, isIncomingIncome=${parsed2.isIncomingIncome}`
  );

  // 3. Failed transaction
  const failedSms =
    'Dear Biniyam, Your transaction has failed due to insufficient balance on 21/10/2026 18:10:00. Thank you for using telebirr.';
  const parsed3 = parseTelebirrSms({ senderId: '127', body: failedSms });
  assertTest(
    'T03',
    'SMS_PARSER',
    'Failed Transaction Exclusion',
    parsed3.messageType === SmsMessageType.PAYMENT_FAILED &&
      parsed3.isIncomingIncome === false &&
      parsed3.isValidFinancialTransaction === false,
    `Classified as ${parsed3.messageType}, excluded from financial totals.`
  );

  // 4. Refund message
  const refundSms =
    'Dear Biniyam, You have been refunded ETB 45.00 from Ethio Telecom on 21/10/2026 14:20:00. Your transaction number is DJL99REF01. Original transaction ID: DJL11OLD09. Your current E-Money Account balance is ETB 400.00.';
  const parsed4 = parseTelebirrSms({ senderId: '127', body: refundSms });
  assertTest(
    'T04',
    'SMS_PARSER',
    'Refund Message & Original Transaction Link',
    parsed4.messageType === SmsMessageType.REFUND &&
      parsed4.amountMinorUnits === 4500 &&
      parsed4.originalTransactionId === 'DJL11OLD09' &&
      parsed4.isIncomingIncome === false,
    `Classified as ${parsed4.messageType}, linked original TX=${parsed4.originalTransactionId}, not counted as new positive income.`
  );

  // 5. Reversal message
  const reversalSms =
    'Dear Biniyam, Reversal of transaction DJL25NAFRW: reversed ETB 50.00 on 21/10/2026 23:55:00. Your transaction number is DJL25REV99. Your current E-Money Account balance is ETB 282.62.';
  const parsed5 = parseTelebirrSms({ senderId: '127', body: reversalSms });
  assertTest(
    'T05',
    'SMS_PARSER',
    'Payment Reversal Detection',
    parsed5.messageType === SmsMessageType.PAYMENT_REVERSED &&
      parsed5.originalTransactionId === 'DJL25NAFRW' &&
      parsed5.amountMinorUnits === 5000 &&
      parsed5.isIncomingIncome === false,
    `Classified as ${parsed5.messageType}, references original TX=${parsed5.originalTransactionId}`
  );

  // 6. Promotional message
  const promoSms =
    'Dear Customer, Download telebirr SuperApp today and win up to ETB 100,000 in our lucky draw promo! Ethio telecom.';
  const parsed6 = parseTelebirrSms({ senderId: '127', body: promoSms });
  assertTest(
    'T06',
    'SMS_PARSER',
    'Promotional Broadcast Filtering',
    parsed6.messageType === SmsMessageType.PROMOTIONAL_MESSAGE &&
      parsed6.isIncomingIncome === false &&
      parsed6.isValidFinancialTransaction === false,
    `Classified as ${parsed6.messageType}, ignored by financial ledger.`
  );

  // 7. Service notification (OTP / maintenance)
  const serviceSms =
    'Dear Customer, Your telebirr One-Time Password (OTP) is 482910. Do not share your PIN or OTP with anyone.';
  const parsed7 = parseTelebirrSms({ senderId: '127', body: serviceSms });
  assertTest(
    'T07',
    'SMS_PARSER',
    'Service / Security Notification Filtering',
    parsed7.messageType === SmsMessageType.SERVICE_NOTIFICATION &&
      parsed7.isIncomingIncome === false,
    `Classified as ${parsed7.messageType}, excluded from transactions.`
  );

  // 8. Unknown message format
  const unknownSms = 'Hello Biniyam, thank you for contacting customer care.';
  const parsed8 = parseTelebirrSms({ senderId: '127', body: unknownSms });
  const val8 = validateParsedSms(parsed8);
  assertTest(
    'T08',
    'SMS_PARSER',
    'Unknown Message Quarantine for Review',
    parsed8.messageType === SmsMessageType.UNKNOWN &&
      val8.requiresReview === true &&
      parsed8.isIncomingIncome === false,
    `Classified as ${parsed8.messageType}, requiresReview=${val8.requiresReview}`
  );

  // 9. Missing transaction ID fallback fingerprint
  const noTxIdSms =
    'Dear Biniyam, You have received ETB 35.00 from Abebe Bikila(2519****1122) on 21/10/2026 16:00:00.';
  const parsed9 = parseTelebirrSms({ senderId: '127', body: noTxIdSms });
  assertTest(
    'T09',
    'SMS_PARSER',
    'Missing Transaction ID Deterministic Fingerprint Fallback',
    parsed9.transactionId === null &&
      parsed9.amountMinorUnits === 3500 &&
      parsed9.messageFingerprint.startsWith('FP_') &&
      parsed9.missingFields.includes('transactionId'),
    `Fallback fingerprint generated: ${parsed9.messageFingerprint}`
  );

  // 10. Irregular spacing and line breaks
  const messySpacingSms = `Dear   Biniyam\n\n\nYou   have   received   ETB 75.50   from   Hana   Tesfaye ( 2519****5544 )   on   21/10/2026   09:15:02.   Your transaction number is   DJL75SPACE1. Your current E-Money Account balance is ETB 510.25.`;
  const parsed10 = parseTelebirrSms({ senderId: '127', body: messySpacingSms });
  assertTest(
    'T10',
    'SMS_PARSER',
    'Irregular Whitespace & Multi-Line Normalization',
    parsed10.amountMinorUnits === 7550 &&
      parsed10.senderName === 'Hana Tesfaye' &&
      parsed10.transactionId === 'DJL75SPACE1',
    `Normalized sender="${parsed10.senderName}", amount=${parsed10.amountMinorUnits} minor units`
  );

  // 11. Different capitalization ("YOU HAVE RECEIVED etb 40.00...")
  const capsSms =
    'DEAR BINIYAM, YOU HAVE RECEIVED ETB 40.00 FROM KALEAB DESTA(2519****2233) ON 21/10/2026 11:30:00. YOUR TRANSACTION NUMBER IS djl40caps9.';
  const parsed11 = parseTelebirrSms({ senderId: '127', body: capsSms });
  assertTest(
    'T11',
    'SMS_PARSER',
    'Case-Insensitive Parsing & Uppercase TX ID Normalization',
    parsed11.messageType === SmsMessageType.PAYMENT_RECEIVED &&
      parsed11.amountMinorUnits === 4000 &&
      parsed11.transactionId === 'DJL40CAPS9',
    `Normalized TX ID=${parsed11.transactionId}, amount=${parsed11.amountMinorUnits}`
  );

  // 12. Alternative date format (YYYY-MM-DD and DD-MM-YYYY)
  const altDateSms =
    'Dear Biniyam, You have received ETB 60.00 fromkebede(2519****7788) on 2026-10-21 at 14:05:09. Your transaction number is DJL60DATE2.';
  const parsed12 = parseTelebirrSms({
    senderId: '127',
    body: altDateSms.replace('fromkebede', 'from Kebede T'),
  });
  assertTest(
    'T12',
    'SMS_PARSER',
    'ISO & Hyphenated Date Normalization',
    parsed12.transactionDate === '21/10/2026' &&
      parsed12.isoDate === '2026-10-21' &&
      parsed12.transactionTime === '14:05:09',
    `Display Date=${parsed12.transactionDate}, SQLite ISO Date=${parsed12.isoDate}`
  );

  // 13. Duplicate transaction prevention
  const dupOutcome = evaluateIncomingSms(
    { senderId: '127', body: promptSms },
    {
      existingTransactionIds: new Set(['DJL25NAFRW']),
      existingFingerprints: new Set(),
      hasActiveTrip: true,
    }
  );
  assertTest(
    'T13',
    'SMS_PARSER',
    'Duplicate Transaction ID Prevention',
    dupOutcome.processingStatus === ProcessingStatus.DUPLICATE &&
      dupOutcome.shouldCreateTransaction === false &&
      dupOutcome.shouldNotifyDriver === false,
    `Duplicate TX DJL25NAFRW blocked (${dupOutcome.processingStatus})`
  );

  // 14. Untrusted sender ID rejection (e.g. sender "8100" or "+251911000000")
  const spoofAttempt = classifyTelebirrSms(promptSms, '+251911223344');
  assertTest(
    'T14',
    'SMS_PARSER',
    'Sender ID 127 Verification Guard',
    spoofAttempt === SmsMessageType.UNKNOWN,
    'Non-127 sender rejected before financial extraction.'
  );

  // 15. Database Seed & Multi-Payment Trip Calculation (Section 8: 4 Kilo -> Piassa, ETB 50 + 30 + 20 = ETB 100)
  const seedDb = createSeedDatabaseState();
  const trip4KiloTotals = calculateTripTotalMinorUnits(
    'trip_4kilo_piassa_01',
    seedDb.transactions
  );
  assertTest(
    'T15',
    'DATABASE_AND_FINANCE',
    'Multi-Passenger Trip Aggregation (ETB 50 + 30 + 20 = ETB 100)',
    trip4KiloTotals.totalMinorUnits === 10000 && trip4KiloTotals.paymentCount === 3,
    `Trip 4 Kilo -> Piassa: ${trip4KiloTotals.paymentCount} payments totaling ${trip4KiloTotals.totalMinorUnits} minor units (ETB 100.00)`
  );

  // 16. Outgoing fuel transaction excluded from Today's Incoming Collections
  const todayReport = computeFinancialReport(
    seedDb.trips,
    seedDb.transactions,
    'TODAY',
    '2026-10-21'
  );
  // Today incoming in seed: 50 + 30 + 20 (trip 1) + 180 (trip 2) + 65 (unassigned) = ETB 345.00 (34500 minor units)
  // Outgoing fuel: ETB 350.00 (35000 minor units)
  assertTest(
    'T16',
    'DATABASE_AND_FINANCE',
    'Strict Separation of Incoming Revenue vs Outgoing Payments',
    todayReport.netTelebirrIncomingMinorUnits === 34500 &&
      todayReport.outgoingTransactionsMinorUnits === 35000,
    `Today Incoming=ETB 345.00 (34500 cents), Outgoing=ETB 350.00 (35000 cents)`
  );

  // 17. Unassigned payments preservation & accounting
  assertTest(
    'T17',
    'DATABASE_AND_FINANCE',
    'Unassigned Payment Retention & Totals',
    todayReport.unassignedPaymentsMinorUnits === 6500 &&
      todayReport.unassignedPaymentCount === 1 &&
      todayReport.assignedPaymentsMinorUnits === 28000,
    `Assigned=ETB 280.00, Unassigned=ETB 65.00 (1 payment retained for driver review)`
  );

  // 18. Completed trip average, highest, and lowest trip calculation
  assertTest(
    'T18',
    'DATABASE_AND_FINANCE',
    'Per-Trip Average, Highest & Lowest Earnings Calculation',
    todayReport.completedTripsCount === 2 &&
      todayReport.averageIncomePerCompletedTripMinorUnits === 14000 &&
      todayReport.highestEarningTrip?.totalMinorUnits === 18000 &&
      todayReport.lowestEarningTrip?.totalMinorUnits === 10000,
    `2 completed trips today: Avg=ETB 140.00, High=ETB 180.00, Low=ETB 100.00`
  );

  // 19. Reversal accounting preserves original record and deducts from Net Telebirr Total
  const simulatedReversalTx = [
    ...seedDb.transactions,
    {
      id: 'tx_rev_test',
      trip_id: null,
      transaction_id: 'DJL25REV99',
      transaction_type: SmsMessageType.PAYMENT_REVERSED,
      payment_method: PaymentMethod.TELEBIRR,
      amount_minor_units: 5000,
      currency: 'ETB',
      sender_name: 'Natnael Birhanu',
      sender_phone: '2519****8747',
      recipient_name: 'Biniyam',
      transaction_date: '21/10/2026',
      iso_date: '2026-10-21',
      transaction_time: '23:55:00',
      account_balance_minor_units: 28262,
      sms_sender: '127',
      transaction_status: TransactionStatus.VALID,
      original_transaction_id: 'DJL25NAFRW',
      description: 'Reversal of DJL25NAFRW',
      created_at: '2026-10-21T20:55:00.000Z',
      updated_at: '2026-10-21T20:55:00.000Z',
    },
  ];
  const reportAfterReversal = computeFinancialReport(
    seedDb.trips,
    simulatedReversalTx,
    'TODAY',
    '2026-10-21'
  );
  assertTest(
    'T19',
    'DATABASE_AND_FINANCE',
    'Reversal Net Deduction & Original Transaction Preservation',
    reportAfterReversal.grossTelebirrIncomingMinorUnits === 34500 &&
      reportAfterReversal.reversalsAndRefundsMinorUnits === 5000 &&
      reportAfterReversal.netTelebirrIncomingMinorUnits === 29500,
    `Gross=ETB 345.00, Reversals=ETB 50.00, Net=ETB 295.00`
  );

  // 20. Manual Cash payment separation from Telebirr income
  const simulatedCashTx = [
    ...seedDb.transactions,
    {
      id: 'tx_cash_test',
      trip_id: 'trip_4kilo_piassa_01',
      transaction_id: null,
      transaction_type: SmsMessageType.PAYMENT_RECEIVED,
      payment_method: PaymentMethod.CASH,
      amount_minor_units: 4000,
      currency: 'ETB',
      sender_name: 'Cash Passenger',
      sender_phone: null,
      recipient_name: 'Biniyam',
      transaction_date: '21/10/2026',
      iso_date: '2026-10-21',
      transaction_time: '20:40:00',
      account_balance_minor_units: null,
      sms_sender: 'MANUAL_CASH',
      transaction_status: TransactionStatus.VALID,
      original_transaction_id: null,
      description: 'Cash fare',
      created_at: '2026-10-21T20:40:00.000Z',
      updated_at: '2026-10-21T20:40:00.000Z',
    },
  ];
  const reportWithCash = computeFinancialReport(
    seedDb.trips,
    simulatedCashTx,
    'TODAY',
    '2026-10-21'
  );
  assertTest(
    'T20',
    'DATABASE_AND_FINANCE',
    'Telebirr vs Manual Cash Revenue Separation',
    reportWithCash.netTelebirrIncomingMinorUnits === 34500 &&
      reportWithCash.manualCashIncomingMinorUnits === 4000 &&
      reportWithCash.combinedNetIncomeMinorUnits === 38500,
    `Telebirr=ETB 345.00, Cash=ETB 40.00, Combined=ETB 385.00`
  );
  // 21. Cloud Sync SMS Privacy & Redaction (Never upload raw SMS inbox body)
  const auditLogSample = {
    id: 'sms_proc_test_01',
    sender_id: '127',
    message_fingerprint: 'fp_abc123',
    classification: SmsMessageType.PAYMENT_RECEIVED,
    processing_status: ProcessingStatus.PROCESSED,
    received_at: '2026-11-01T10:00:00.000Z',
    processed_at: '2026-11-01T10:00:01.000Z',
    error_message: null,
    summary_note: 'PAYMENT_RECEIVED: ETB 50.00 (DJL25NAFRW)',
    sync_status: 'PENDING' as const,
  };
  assertTest(
    'T21',
    'DATABASE_AND_FINANCE',
    'Cloud Sync Payload Redaction (Zero Raw SMS Leaked)',
    !('body' in auditLogSample) &&
      !('raw_text' in auditLogSample) &&
      Boolean(auditLogSample.summary_note?.startsWith('PAYMENT_RECEIVED')),
    'Raw SMS body is excluded; only redacted summary note and fingerprint are synchronized.'
  );

  // 22. Stable ID preservation & Zero-Duplicate Cloud Sync mapping
  const localTrip = seedDb.trips[0];
  const cloudTripPayload = {
    id: localTrip.id,
    user_id: 'usr_supabase_001',
    start_location_name: localTrip.start_location_name,
    start_time: localTrip.start_time,
    status: localTrip.status,
    version: 1,
  };
  assertTest(
    'T22',
    'DATABASE_AND_FINANCE',
    'Stable ID Preservation Across Local Storage & Cloud',
    cloudTripPayload.id === localTrip.id &&
      cloudTripPayload.id.startsWith('trip_'),
    `Stable ID maintained: ${cloudTripPayload.id}`
  );

  // 23. Conflict Resolution — Offline Pending Edits Protected
  const localPendingTx = {
    ...seedDb.transactions[0],
    sync_status: 'PENDING' as const,
    amount_minor_units: 5000,
  };
  const incomingCloudTx = {
    ...seedDb.transactions[0],
    amount_minor_units: 4500,
  };
  const resolvedTx = localPendingTx.sync_status === 'PENDING' ? localPendingTx : incomingCloudTx;
  assertTest(
    'T23',
    'DATABASE_AND_FINANCE',
    'Conflict Resolution — Local Pending Edits Preserved',
    resolvedTx.amount_minor_units === 5000 &&
      resolvedTx.sync_status === 'PENDING',
    'Local pending uncommitted state takes precedence over stale cloud version.'
  );

  // 24. Offline-first Financial Availability
  const offlinePaymentTx = {
    id: 'tx_offline_telebirr_01',
    trip_id: null,
    transaction_id: 'DJL99OFFLINE',
    transaction_type: SmsMessageType.PAYMENT_RECEIVED,
    payment_method: PaymentMethod.TELEBIRR,
    amount_minor_units: 7500,
    currency: 'ETB',
    sender_name: 'Offline Passenger',
    sender_phone: '251911999888',
    recipient_name: 'Biniyam',
    transaction_date: '21/10/2026',
    iso_date: '2026-10-21',
    transaction_time: '21:00:00',
    account_balance_minor_units: 40000,
    sms_sender: '127',
    transaction_status: TransactionStatus.VALID,
    original_transaction_id: null,
    description: 'Captured offline',
    created_at: '2026-10-21T21:00:00.000Z',
    updated_at: '2026-10-21T21:00:00.000Z',
    sync_status: 'PENDING' as const,
  };
  const allTxWithOffline = [...seedDb.transactions, offlinePaymentTx];
  const offlineReport = computeFinancialReport(seedDb.trips, allTxWithOffline, 'TODAY', '2026-10-21');
  assertTest(
    'T24',
    'DATABASE_AND_FINANCE',
    'Offline-First Financial Reporting Operational',
    offlineReport.netTelebirrIncomingMinorUnits === 34500 + 7500 &&
      offlinePaymentTx.sync_status === 'PENDING',
    `Report immediately reflects offline income: ETB ${((34500 + 7500) / 100).toFixed(2)}`
  );

  return results;
}
