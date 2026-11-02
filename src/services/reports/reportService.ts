import {
  PaymentMethod,
  TransactionRecord,
  TransactionStatus,
  TripRecord,
  TripStatus,
} from '../../database/schema';
import { SmsMessageType } from '../sms/smsTypes';

export type ReportDateRangePreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'ALL_TIME'
  | 'CUSTOM';

export interface TripIncomeSummary {
  trip: TripRecord;
  telebirrMinorUnits: number;
  cashMinorUnits: number;
  totalMinorUnits: number;
  paymentCount: number;
}

export interface DailyEarningsPoint {
  isoDate: string;
  label: string;
  telebirrMinorUnits: number;
  cashMinorUnits: number;
  netMinorUnits: number;
  paymentCount: number;
}

export interface FinancialReportSummary {
  grossTelebirrIncomingMinorUnits: number;
  reversalsAndRefundsMinorUnits: number;
  netTelebirrIncomingMinorUnits: number;
  manualCashIncomingMinorUnits: number;
  combinedNetIncomeMinorUnits: number;
  outgoingTransactionsMinorUnits: number;
  incomingPaymentCount: number;
  completedTripsCount: number;
  assignedPaymentsMinorUnits: number;
  unassignedPaymentsMinorUnits: number;
  unassignedPaymentCount: number;
  averageIncomePerCompletedTripMinorUnits: number;
  averageDailyIncomeMinorUnits: number;
  highestEarningTrip: TripIncomeSummary | null;
  lowestEarningTrip: TripIncomeSummary | null;
  tripBreakdowns: TripIncomeSummary[];
  dailySeries: DailyEarningsPoint[];
}

/**
 * Checks whether a transaction record represents positive incoming driver revenue.
 * Strictly excludes outgoing payments, failed transactions, reversals, refunds, and unknown messages.
 */
export function isPositiveIncomingTransaction(tx: TransactionRecord): boolean {
  return (
    (tx.transaction_type === SmsMessageType.PAYMENT_RECEIVED ||
      tx.transaction_type === SmsMessageType.TRANSFER_RECEIVED) &&
    tx.amount_minor_units > 0 &&
    tx.transaction_status !== TransactionStatus.FAILED
  );
}

/**
 * Checks whether a transaction record is a reversal or refund that offsets gross incoming revenue.
 */
export function isReversalOrRefundTransaction(tx: TransactionRecord): boolean {
  return (
    tx.transaction_type === SmsMessageType.PAYMENT_REVERSED ||
    tx.transaction_type === SmsMessageType.REFUND
  );
}

/**
 * Checks whether a transaction record is an outgoing payment or transfer.
 */
export function isOutgoingTransaction(tx: TransactionRecord): boolean {
  return (
    tx.transaction_type === SmsMessageType.PAYMENT_SENT ||
    tx.transaction_type === SmsMessageType.TRANSFER_SENT
  );
}

/**
 * Computes net valid revenue for a specific transaction list.
 * Note: If an original incoming transaction was marked REVERSED because a separate
 * PAYMENT_REVERSED record was saved, we deduct via the PAYMENT_REVERSED record (or exclude REVERSED status)
 * without double-deducting.
 */
export function calculateTripTotalMinorUnits(
  tripId: string,
  allTransactions: TransactionRecord[]
): {
  telebirrMinorUnits: number;
  cashMinorUnits: number;
  totalMinorUnits: number;
  paymentCount: number;
  transactions: TransactionRecord[];
} {
  const associated = allTransactions.filter((tx) => tx.trip_id === tripId);

  let telebirrMinorUnits = 0;
  let cashMinorUnits = 0;
  let paymentCount = 0;

  for (const tx of associated) {
    if (
      isPositiveIncomingTransaction(tx) &&
      tx.transaction_status === TransactionStatus.VALID
    ) {
      if (tx.payment_method === PaymentMethod.CASH) {
        cashMinorUnits += tx.amount_minor_units;
      } else {
        telebirrMinorUnits += tx.amount_minor_units;
      }
      paymentCount += 1;
    }
  }

  return {
    telebirrMinorUnits,
    cashMinorUnits,
    totalMinorUnits: telebirrMinorUnits + cashMinorUnits,
    paymentCount,
    transactions: associated,
  };
}

/**
 * Resolves start and end YYYY-MM-DD strings for a given preset relative to the reference date.
 */
export function resolveDateRangeBounds(
  preset: ReportDateRangePreset,
  referenceIsoDate: string = '2026-10-21',
  customStart?: string,
  customEnd?: string
): { startIso: string; endIso: string } {
  const refDate = new Date(`${referenceIsoDate}T12:00:00Z`);

  const toIso = (d: Date) => d.toISOString().slice(0, 10);

  if (preset === 'TODAY') {
    return { startIso: referenceIsoDate, endIso: referenceIsoDate };
  }
  if (preset === 'YESTERDAY') {
    const y = new Date(refDate);
    y.setUTCDate(y.getUTCDate() - 1);
    const yIso = toIso(y);
    return { startIso: yIso, endIso: yIso };
  }
  if (preset === 'LAST_7_DAYS') {
    const s = new Date(refDate);
    s.setUTCDate(s.getUTCDate() - 6);
    return { startIso: toIso(s), endIso: referenceIsoDate };
  }
  if (preset === 'LAST_30_DAYS') {
    const s = new Date(refDate);
    s.setUTCDate(s.getUTCDate() - 29);
    return { startIso: toIso(s), endIso: referenceIsoDate };
  }
  if (preset === 'CUSTOM') {
    return {
      startIso: customStart || '2026-01-01',
      endIso: customEnd || referenceIsoDate,
    };
  }
  return { startIso: '2020-01-01', endIso: '2099-12-31' };
}

/**
 * Generates comprehensive financial statistics from SQLite records for the selected date range.
 */
export function computeFinancialReport(
  trips: TripRecord[],
  transactions: TransactionRecord[],
  preset: ReportDateRangePreset,
  referenceIsoDate: string = '2026-10-21',
  customStart?: string,
  customEnd?: string
): FinancialReportSummary {
  const { startIso, endIso } = resolveDateRangeBounds(
    preset,
    referenceIsoDate,
    customStart,
    customEnd
  );

  const filteredTx = transactions.filter(
    (tx) => tx.iso_date >= startIso && tx.iso_date <= endIso
  );

  const filteredCompletedTrips = trips.filter((t) => {
    if (t.status !== TripStatus.COMPLETED) return false;
    const tripIsoDate = t.start_time.slice(0, 10);
    return tripIsoDate >= startIso && tripIsoDate <= endIso;
  });

  let grossTelebirrIncomingMinorUnits = 0;
  let reversalsAndRefundsMinorUnits = 0;
  let manualCashIncomingMinorUnits = 0;
  let outgoingTransactionsMinorUnits = 0;
  let incomingPaymentCount = 0;
  let assignedPaymentsMinorUnits = 0;
  let unassignedPaymentsMinorUnits = 0;
  let unassignedPaymentCount = 0;

  const dailyMap = new Map<
    string,
    { telebirr: number; cash: number; reversals: number; count: number }
  >();

  for (const tx of filteredTx) {
    const dayBucket = dailyMap.get(tx.iso_date) || {
      telebirr: 0,
      cash: 0,
      reversals: 0,
      count: 0,
    };

    if (isPositiveIncomingTransaction(tx)) {
      if (tx.payment_method === PaymentMethod.TELEBIRR) {
        grossTelebirrIncomingMinorUnits += tx.amount_minor_units;
        if (tx.transaction_status === TransactionStatus.VALID) {
          dayBucket.telebirr += tx.amount_minor_units;
          dayBucket.count += 1;
          incomingPaymentCount += 1;

          if (tx.trip_id) {
            assignedPaymentsMinorUnits += tx.amount_minor_units;
          } else {
            unassignedPaymentsMinorUnits += tx.amount_minor_units;
            unassignedPaymentCount += 1;
          }
        }
      } else if (
        tx.payment_method === PaymentMethod.CASH &&
        tx.transaction_status === TransactionStatus.VALID
      ) {
        manualCashIncomingMinorUnits += tx.amount_minor_units;
        dayBucket.cash += tx.amount_minor_units;
        dayBucket.count += 1;
        incomingPaymentCount += 1;

        if (tx.trip_id) {
          assignedPaymentsMinorUnits += tx.amount_minor_units;
        } else {
          unassignedPaymentsMinorUnits += tx.amount_minor_units;
          unassignedPaymentCount += 1;
        }
      }
    } else if (isReversalOrRefundTransaction(tx)) {
      reversalsAndRefundsMinorUnits += tx.amount_minor_units;
      dayBucket.reversals += tx.amount_minor_units;
    } else if (isOutgoingTransaction(tx)) {
      outgoingTransactionsMinorUnits += tx.amount_minor_units;
    }

    dailyMap.set(tx.iso_date, dayBucket);
  }

  const netTelebirrIncomingMinorUnits = Math.max(
    0,
    grossTelebirrIncomingMinorUnits - reversalsAndRefundsMinorUnits
  );
  const combinedNetIncomeMinorUnits =
    netTelebirrIncomingMinorUnits + manualCashIncomingMinorUnits;

  const tripBreakdowns: TripIncomeSummary[] = filteredCompletedTrips.map((trip) => {
    const totals = calculateTripTotalMinorUnits(trip.id, transactions);
    return {
      trip,
      telebirrMinorUnits: totals.telebirrMinorUnits,
      cashMinorUnits: totals.cashMinorUnits,
      totalMinorUnits: totals.totalMinorUnits,
      paymentCount: totals.paymentCount,
    };
  });

  const completedTripsCount = tripBreakdowns.length;
  const totalCompletedTripEarnings = tripBreakdowns.reduce(
    (acc, item) => acc + item.totalMinorUnits,
    0
  );

  const averageIncomePerCompletedTripMinorUnits =
    completedTripsCount > 0
      ? Math.round(totalCompletedTripEarnings / completedTripsCount)
      : 0;

  let highestEarningTrip: TripIncomeSummary | null = null;
  let lowestEarningTrip: TripIncomeSummary | null = null;

  for (const tb of tripBreakdowns) {
    if (!highestEarningTrip || tb.totalMinorUnits > highestEarningTrip.totalMinorUnits) {
      highestEarningTrip = tb;
    }
    if (!lowestEarningTrip || tb.totalMinorUnits < lowestEarningTrip.totalMinorUnits) {
      lowestEarningTrip = tb;
    }
  }

  const dailySeries: DailyEarningsPoint[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([isoDate, data]) => {
      const [, month, day] = isoDate.split('-');
      return {
        isoDate,
        label: `${day}/${month}`,
        telebirrMinorUnits: data.telebirr,
        cashMinorUnits: data.cash,
        netMinorUnits: data.telebirr + data.cash,
        paymentCount: data.count,
      };
    });

  const activeDaysCount = Math.max(1, dailySeries.length);
  const averageDailyIncomeMinorUnits = Math.round(
    combinedNetIncomeMinorUnits / activeDaysCount
  );

  return {
    grossTelebirrIncomingMinorUnits,
    reversalsAndRefundsMinorUnits,
    netTelebirrIncomingMinorUnits,
    manualCashIncomingMinorUnits,
    combinedNetIncomeMinorUnits,
    outgoingTransactionsMinorUnits,
    incomingPaymentCount,
    completedTripsCount,
    assignedPaymentsMinorUnits,
    unassignedPaymentsMinorUnits,
    unassignedPaymentCount,
    averageIncomePerCompletedTripMinorUnits,
    averageDailyIncomeMinorUnits,
    highestEarningTrip,
    lowestEarningTrip,
    tripBreakdowns,
    dailySeries,
  };
}

/**
 * Generates a clean CSV string for exporting driver transactions and trip associations.
 */
export function generateReportCsv(
  transactions: TransactionRecord[],
  trips: TripRecord[]
): string {
  const tripMap = new Map<string, TripRecord>();
  for (const t of trips) {
    tripMap.set(t.id, t);
  }

  const headers = [
    'Telebirr Transaction ID',
    'Type',
    'Payment Method',
    'Status',
    'Amount (ETB)',
    'Sender / Counterparty',
    'Phone Number',
    'Date',
    'Time',
    'Trip Route',
    'Account Balance (ETB)',
  ];

  const escapeCsvCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = transactions.map((tx) => {
    const trip = tx.trip_id ? tripMap.get(tx.trip_id) : null;
    const route = trip
      ? `${trip.start_location_name} -> ${trip.end_location_name || 'In Progress'}`
      : 'Unassigned';
    const majorAmt = (tx.amount_minor_units / 100).toFixed(2);
    const majorBal =
      tx.account_balance_minor_units !== null
        ? (tx.account_balance_minor_units / 100).toFixed(2)
        : '';

    return [
      tx.transaction_id || '',
      tx.transaction_type,
      tx.payment_method,
      tx.transaction_status,
      majorAmt,
      tx.sender_name || '',
      tx.sender_phone || '',
      tx.transaction_date,
      tx.transaction_time,
      route,
      majorBal,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
}

export const generateTransactionsCsv = generateReportCsv;

export function generateTripsCsv(
  trips: TripRecord[],
  transactions: TransactionRecord[]
): string {
  const escapeCsvCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = [
    'Status',
    'Start Location',
    'End Location',
    'Start Time',
    'End Time',
    'Payment Count',
    'Telebirr (ETB)',
    'Cash (ETB)',
    'Total Earnings (ETB)',
  ];

  const rows = trips.map((trip) => {
    const summary = calculateTripTotalMinorUnits(trip.id, transactions);
    return [
      trip.status,
      trip.start_location_name,
      trip.end_location_name || 'In progress',
      trip.start_time,
      trip.end_time || '',
      summary.paymentCount,
      (summary.telebirrMinorUnits / 100).toFixed(2),
      (summary.cashMinorUnits / 100).toFixed(2),
      (summary.totalMinorUnits / 100).toFixed(2),
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
}

export function generateDailySummaryCsv(
  input: DailyEarningsPoint[] | FinancialReportSummary
): string {
  const series = Array.isArray(input) ? input : input.dailySeries;
  const escapeCsvCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = [
    'ISO Date',
    'Label',
    'Payment Count',
    'Telebirr (ETB)',
    'Cash (ETB)',
    'Combined Net Income (ETB)',
  ];

  const rows = series.map((day) =>
    [
      day.isoDate,
      day.label,
      day.paymentCount,
      (day.telebirrMinorUnits / 100).toFixed(2),
      (day.cashMinorUnits / 100).toFixed(2),
      (day.netMinorUnits / 100).toFixed(2),
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
}

export async function triggerCsvDownload(filename: string, csvContent: string): Promise<boolean> {
  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

  // 1. First priority: Android Native Bridge (TripBirrNative.exportCsv)
  try {
    const nativeBridge = (window as any).TripBirrNative;
    if (nativeBridge && typeof nativeBridge.exportCsv === 'function') {
      const res = nativeBridge.exportCsv(cleanFilename, csvContent);
      if (res) return true;
    }
  } catch (err) {
    console.warn('Native exportCsv error, falling back:', err);
  }

  // 2. Second priority: Modern Web Share API (if supported with Files)
  try {
    if (typeof navigator !== 'undefined' && navigator.canShare && typeof File !== 'undefined') {
      const file = new File([csvContent], cleanFilename, { type: 'text/csv' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: cleanFilename,
          text: `TripBirr CSV Export: ${cleanFilename}`,
        });
        return true;
      }
    }
  } catch (_e) {
    // Sharing dialog dismissed or canceled by user, proceed to direct download
  }

  // 3. Third priority: HTML5 Blob download (with 30s delayed revoke so mobile browsers finish)
  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', cleanFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 30000);
    return true;
  } catch (err) {
    console.warn('Blob download failed, trying data URI fallback:', err);
  }

  // 4. Fourth priority: RFC 2397 Data URI fallback
  try {
    const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    const link = document.createElement('a');
    link.href = encodedUri;
    link.setAttribute('download', cleanFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (_e) {
    return false;
  }
}
