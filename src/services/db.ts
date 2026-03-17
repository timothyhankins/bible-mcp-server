import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");
export const DATA_DIR = join(PROJECT_ROOT, "data");
export const DB_PATH = join(DATA_DIR, "bible.db");

let _db: Database.Database | null = null;

/**
 * Get (or create) the singleton SQLite database connection.
 */
export function getDb(): Database.Database {
  if (_db) return _db;

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  return _db;
}

/**
 * Initialize all tables. Safe to call multiple times — uses IF NOT EXISTS.
 */
export function initializeDb(): void {
  const db = getDb();

  // Cross-references table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cross_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_book TEXT NOT NULL,
      from_chapter INTEGER NOT NULL,
      from_verse INTEGER NOT NULL,
      to_book TEXT NOT NULL,
      to_chapter INTEGER NOT NULL,
      to_verse INTEGER NOT NULL,
      votes INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cross_refs_from
    ON cross_refs (from_book, from_chapter, from_verse);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cross_refs_to
    ON cross_refs (to_book, to_chapter, to_verse);
  `);

  // Lexicon table (Strongs entries)
  db.exec(`
    CREATE TABLE IF NOT EXISTS lexicon (
      strongs_id TEXT PRIMARY KEY,
      language TEXT NOT NULL CHECK (language IN ('hebrew', 'greek')),
      lemma TEXT,
      transliteration TEXT,
      gloss TEXT,
      definition TEXT,
      kjv_usage TEXT
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_lexicon_language
    ON lexicon (language);
  `);

  // Full-text search on gloss + definition (standalone, not content-synced)
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS lexicon_fts
    USING fts5(strongs_id, gloss, definition);
  `);
}

/**
 * Check whether a given table has data loaded.
 */
export function tableHasData(table: string): boolean {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as {
    count: number;
  };
  return row.count > 0;
}

/**
 * Check if --rebuild-db flag was passed.
 */
export function shouldRebuild(): boolean {
  return process.argv.includes("--rebuild-db");
}
