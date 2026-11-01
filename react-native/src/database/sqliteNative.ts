let _db: any = null;

export function getSqliteDb() {
  if (!_db) {
    try {
      const { open } = require('@op-engineering/op-sqlite');
      _db = open({ name: 'tripbirr_offline.sqlite' });
    } catch (e) {
      console.warn('Native op-sqlite open deferred or unavailable:', e);
    }
  }
  return _db;
}

/**
 * Initializes the on-device SQLite database using @op-engineering/op-sqlite.
 */
export function initializeNativeSqliteDatabase(): void {
  try {
    const db = getSqliteDb();
    if (!db) return;
    db.execute('PRAGMA foreign_keys = ON;');
  } catch (err) {
    console.warn('initializeNativeSqliteDatabase skipped (web client db active):', err);
  }
}

export const sqliteDb = {
  execute: (...args: any[]) => {
    const db = getSqliteDb();
    return db ? db.execute(...args) : null;
  },
};
