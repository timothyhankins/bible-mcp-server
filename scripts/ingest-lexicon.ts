/**
 * Parse TBESH (Hebrew) and TBESG (Greek) lexicon files into SQLite.
 *
 * Data lines start with H/G followed by digits. Format (TSV):
 *   eStrong#  dStrong info  uStrong  lemma  transliteration  morph  gloss  definition
 *
 * We extract: strongs_id (col 0), lemma (col 3), transliteration (col 4),
 * gloss (col 6), definition (col 7).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb, initializeDb, DATA_DIR } from "../src/services/db.js";

function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStrongsId(raw: string): string {
  // H2617a → H2617A, G0026 → G0026
  // Keep the letter prefix + digits + optional disambiguator letter (uppercased)
  const match = raw.match(/^([GH])(\d+)([a-zA-Z]?)$/);
  if (!match) return raw.toUpperCase();
  const [, prefix, num, suffix] = match;
  return `${prefix}${num}${suffix.toUpperCase()}`;
}

function ingestFile(filePath: string, language: "hebrew" | "greek"): number {
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split("\n");
  const db = getDb();
  const prefix = language === "greek" ? "G" : "H";

  const insert = db.prepare(`
    INSERT OR REPLACE INTO lexicon (strongs_id, language, lemma, transliteration, gloss, definition, kjv_usage)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;

  const insertMany = db.transaction(() => {
    for (const line of lines) {
      if (!line.startsWith(prefix)) continue;

      const cols = line.split("\t");
      if (cols.length < 7) continue;

      const strongsId = normalizeStrongsId(cols[0].trim());
      const lemma = cols[3]?.trim() || null;
      const transliteration = cols[4]?.trim() || null;
      const gloss = cols[6]?.trim() || null;
      const definitionRaw = cols[7]?.trim() || null;
      const definition = definitionRaw ? stripHtml(definitionRaw) : null;

      // Skip morphology-only entries and entries without a gloss
      if (!gloss && !definition) continue;

      insert.run(strongsId, language, lemma, transliteration, gloss, definition, null);
      inserted++;
    }
  });

  insertMany();
  return inserted;
}

export function ingestLexicons(): void {
  const db = getDb();
  db.exec("DELETE FROM lexicon");

  const greekCount = ingestFile(join(DATA_DIR, "TBESG.txt"), "greek");
  console.log(`Greek lexicon: ${greekCount} entries`);

  const hebrewCount = ingestFile(join(DATA_DIR, "TBESH.txt"), "hebrew");
  console.log(`Hebrew lexicon: ${hebrewCount} entries`);

  // Rebuild FTS index
  db.exec("DELETE FROM lexicon_fts");
  db.exec(`
    INSERT INTO lexicon_fts (strongs_id, gloss, definition)
    SELECT strongs_id, gloss, definition FROM lexicon
  `);
  console.log("FTS index rebuilt.");
}

// Run directly if this is the main module
const isMain = process.argv[1]?.endsWith("ingest-lexicon.ts") || process.argv[1]?.endsWith("ingest-lexicon.js");
if (isMain) {
  initializeDb();
  ingestLexicons();
  console.log("Lexicon ingestion complete.");
}
