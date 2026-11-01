import { open } from '@op-engineering/op-sqlite';
import { SQLITE_MIGRATIONS } from '../../../src/database/migrations';

const db = open({ name: 'tripbirr_offline.sqlite' });

/**
 * Initializes the on-device SQLite database using @op-engineering/op-sqlite
 * and executes all versioned schema migrations.
 */
export function initializeNativeSqliteDatabase(): void {
  db.execute('PRAGMA foreign_keys = ON;');
  db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRes = db.execute('SELECT version FROM schema_migrations;');
  const appliedVersions = new Set<number>(
    (appliedRes.rows?._array || []).map((r: { version: number }) => r.version)
  );

  for (const migration of SQLITE_MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
      db.execute('BEGIN TRANSACTION;');
      try {
        const statements = migration.upSql
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean);
        for (const stmt of statements) {
          db.execute(`${stmt};`);
        }
        db.execute(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          [migration.version, migration.name, new Date().toISOString()]
        );
        db.execute('COMMIT;');
      } catch (err) {
        db.execute('ROLLBACK;');
        throw err;
      }
    }
  }
}

export { db as sqliteDb };
