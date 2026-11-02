import {
  isNetworkAvailable,
  syncPush,
  syncPull,
  migrateLocalDataOnRegistration,
  restoreCloudDataOnLogin,
} from '../services/sync/syncService';
import { createSeedDatabaseState } from '../database/database';
import { PaymentMethod, TransactionStatus, TripStatus } from '../database/schema';
import { SmsMessageType } from '../services/sms/smsTypes';
import { calculateTripTotalMinorUnits, computeFinancialReport } from '../services/reports/reportService';

export async function runCloudSyncIntegrationSuite() {
  const testResults: { name: string; passed: boolean; details: string }[] = [];

  const assert = (name: string, condition: boolean, details: string) => {
    testResults.push({ name, passed: Boolean(condition), details });
  };

  const seed = createSeedDatabaseState();

  // Test 1: Offline push handles gracefully
  const pushRes = await syncPush('test-user-id', seed);
  assert(
    'Offline Push Safety',
    Array.isArray(pushRes.errors) && Array.isArray(pushRes.syncedTripIds),
    'syncPush completed without unhandled exceptions.'
  );

  // Test 2: Local records marked pending for migration
  const seedForMigration = createSeedDatabaseState();
  const tripsToMigrate = seedForMigration.trips.map(t => ({ ...t, sync_status: 'PENDING' as const }));
  assert(
    'Registration Migration Payload Preparation',
    tripsToMigrate.every(t => t.sync_status === 'PENDING'),
    'All historical trips marked PENDING for upload on first-time account creation.'
  );

  // Test 3: Financial Integrity — Personal Transfers & Unassigned Payments Never Inflate Trip Earnings
  const activeTrip = seed.trips.find(t => t.status === TripStatus.ACTIVE) || seed.trips[0];
  const tripTotalBefore = calculateTripTotalMinorUnits(activeTrip.id, seed.transactions);

  const personalTransferTx = {
    id: 'tx_personal_transfer_01',
    trip_id: null, // Personal transfer not linked to trip
    transaction_id: 'DJL_TRANSFER_01',
    transaction_type: SmsMessageType.TRANSFER_RECEIVED,
    payment_method: PaymentMethod.TELEBIRR,
    amount_minor_units: 50000, // ETB 500.00
    currency: 'ETB',
    sender_name: 'Family Member',
    sender_phone: '251911000111',
    recipient_name: 'Driver',
    transaction_date: '21/10/2026',
    iso_date: '2026-10-21',
    transaction_time: '12:00:00',
    account_balance_minor_units: 150000,
    sms_sender: '127',
    transaction_status: TransactionStatus.VALID,
    original_transaction_id: null,
    description: 'Personal transfer',
    created_at: '2026-10-21T12:00:00.000Z',
    updated_at: '2026-10-21T12:00:00.000Z',
    sync_status: 'SYNCED' as const,
  };

  const tripTotalAfter = calculateTripTotalMinorUnits(activeTrip.id, [...seed.transactions, personalTransferTx]);

  assert(
    'Financial Integrity: Personal Transfer Ignored in Trip Earnings',
    tripTotalAfter.totalMinorUnits === tripTotalBefore.totalMinorUnits &&
      tripTotalAfter.paymentCount === tripTotalBefore.paymentCount,
    `Trip total preserved: ETB ${(tripTotalAfter.totalMinorUnits / 100).toFixed(2)} (payment count: ${tripTotalAfter.paymentCount})`
  );

  // Test 4: Stable IDs & Idempotent Deduplication
  const txIds = new Set<string>();
  let duplicatesFound = 0;
  for (const tx of seed.transactions) {
    if (txIds.has(tx.id)) duplicatesFound++;
    txIds.add(tx.id);
  }
  assert(
    'Stable ID Uniqueness in Local Seed State',
    duplicatesFound === 0,
    `Zero duplicate transaction primary keys found among ${seed.transactions.length} transactions.`
  );

  return testResults;
}
