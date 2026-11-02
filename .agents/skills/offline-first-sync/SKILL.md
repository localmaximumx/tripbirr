---
name: offline-first-sync
description: >-
  Implement offline-first client architecture with optimistic local persistence, conflict-tolerant
  cloud synchronization (Supabase/Postgres), monotonic versioning, deletion tombstones, and seamless
  anonymous-to-authenticated account migration. Use when architecting offline-first mobile/web applications,
  reconciling local and cloud state, or building zero-latency UI updates.
---

# Offline-First Persistence & Conflict-Tolerant Cloud Sync

This skill details how to build a zero-latency, local-first application where all user operations update local state instantly, and synchronization with a cloud database (such as Supabase / Postgres) happens quietly and resiliently in the background.

---

## 1. Principles of Offline-First Architecture

1. **Immediate Local Single Source of Truth**: User actions read and write to local storage (Zustand with localStorage or IndexedDB) synchronously. The UI never shows network loading spinners for CRUD actions.
2. **Every Record is Self-Describing for Sync**:
   ```typescript
   export interface SyncableRecord {
     id: string;
     user_id: string | null;
     sync_status: 'PENDING' | 'SYNCED' | 'FAILED';
     version: number;
     created_at: string; // ISO 8601
     updated_at: string; // ISO 8601
   }
   ```
3. **Monotonic Versioning**: Every local modification must increment `version = (current.version ?? 1) + 1` and update `updated_at`.
4. **Offline Deletion Tombstones**: Deleting a record locally must log the deletion in a dedicated tombstone table (e.g. `trip_deletions`) so the delete is propagated to the cloud rather than the cloud resurrecting the deleted item on next sync.

---

## 2. Sync State Lifecycle Machine

```
┌────────────────────────────────┐
│ User Action (Create / Update)  │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│ Local Store Updated (0ms delay)│
│ • sync_status = 'PENDING'      │
│ • version = version + 1        │
│ • updated_at = nowIso          │
└───────────────┬────────────────┘
                │
       Background trigger
                │
                ▼
┌────────────────────────────────┐
│ Push Local Pending to Cloud    │
│ • Upsert records by primary id │
│ • Execute queued tombstone     │
│   deletions on cloud           │
└───────────────┬────────────────┘
                │
        Success │ Failure
    ┌───────────┴───────────┐
    ▼                       ▼
┌───────────────┐       ┌───────────────┐
│ sync_status:  │       │ sync_status:  │
│ 'SYNCED'      │       │ 'FAILED'      │
│ (wait next)   │       │ (retry backoff│
└───────────────┘       └───────────────┘
```

---

## 3. Safe Deletion & Tombstone Recording

When an entity is deleted offline, do not simply remove it from the local array without a trace. Record the deletion so the cloud server executes the deletion upon reconnecting:

```typescript
// src/services/syncService.ts

export async function recordTripDeletion(tripId: string, userId: string | null) {
  // 1. Save to local tombstone queue
  const pendingDeletions = JSON.parse(localStorage.getItem('pending_deletions') || '[]');
  pendingDeletions.push({ id: tripId, user_id: userId, deleted_at: new Date().toISOString() });
  localStorage.setItem('pending_deletions', JSON.stringify(pendingDeletions));

  // 2. If online and authenticated, attempt immediate cloud delete
  if (navigator.onLine && userId) {
    try {
      await supabase.from('trips').delete().eq('id', tripId);
      // Remove from pending deletions queue on success
      const updated = pendingDeletions.filter((d: any) => d.id !== tripId);
      localStorage.setItem('pending_deletions', JSON.stringify(updated));
    } catch (err) {
      console.warn('Deferred offline deletion to next sync pass');
    }
  }
}
```

---

## 4. Anonymous-to-Authenticated Data Migration

A major point of friction in mobile apps is forcing users to sign up before trying the app. The offline-first approach allows instant usage without sign-up, followed by seamless data migration upon registration:

```typescript
// src/services/authMigration.ts

export async function migrateLocalDataOnRegistration(
  newCloudUserId: string,
  localState: { trips: TripRecord[]; transactions: TransactionRecord[]; settings: AppSettings },
  driverProfile: DriverProfile
) {
  const nowIso = new Date().toISOString();

  // 1. Assign all anonymous records to the new user ID
  const migratedTrips = localState.trips.map((trip) => ({
    ...trip,
    user_id: newCloudUserId,
    sync_status: 'PENDING' as const,
    updated_at: nowIso,
  }));

  const migratedTransactions = localState.transactions.map((tx) => ({
    ...tx,
    user_id: newCloudUserId,
    sync_status: 'PENDING' as const,
    updated_at: nowIso,
  }));

  // 2. Batch upsert into cloud database
  try {
    if (migratedTrips.length > 0) {
      await supabase.from('trips').upsert(migratedTrips);
    }
    if (migratedTransactions.length > 0) {
      await supabase.from('transactions').upsert(migratedTransactions);
    }

    return {
      success: true,
      updatedState: {
        trips: migratedTrips.map((t) => ({ ...t, sync_status: 'SYNCED' as const })),
        transactions: migratedTransactions.map((tx) => ({ ...tx, sync_status: 'SYNCED' as const })),
      },
    };
  } catch (err) {
    console.error('Migration failed, local data remains intact:', err);
    return { success: false, error: err };
  }
}
```

---

## 5. Decoupling Related Records on Cascade

When a parent entity (e.g., a `Trip`) is deleted, business rules often dictate that child records (e.g., `Transactions`) must not be permanently lost:
1. Update child records to `trip_id: null`.
2. Tag them with status `UNASSIGNED` / `ያልተገናኘ`.
3. Increment version and mark `sync_status = 'PENDING'` so the decoupled association propagates cleanly to the cloud.
