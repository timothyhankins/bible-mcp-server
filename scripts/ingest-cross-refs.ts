/**
 * Parse cross_references.txt and load into SQLite.
 *
 * Data format (TSV):
 *   From Verse\tTo Verse\tVotes
 *   Gen.1.1\tProv.8.22-Prov.8.30\t59
 *
 * Normalization: Gen.1.1 → GEN.1.1 (uppercase book code)
 *
 * For range references like Prov.8.22-Prov.8.30, we store only the
 * start verse of the "to" reference. The range info is preserved in
 * a to_verse_end column for display purposes.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb, initializeDb, DATA_DIR } from "../src/services/db.js";

// Book name mapping: mixed-case (openbible) → uppercase 3-letter (API.Bible)
const BOOK_MAP: Record<string, string> = {
  Gen: "GEN", Exod: "EXO", Lev: "LEV", Num: "NUM", Deut: "DEU",
  Josh: "JOS", Judg: "JDG", Ruth: "RUT", "1Sam": "1SA", "2Sam": "2SA",
  "1Kgs": "1KI", "2Kgs": "2KI", "1Chr": "1CH", "2Chr": "2CH",
  Ezra: "EZR", Neh: "NEH", Esth: "EST", Job: "JOB", Ps: "PSA",
  Prov: "PRO", Eccl: "ECC", Song: "SNG", Isa: "ISA", Jer: "JER",
  Lam: "LAM", Ezek: "EZK", Dan: "DAN", Hos: "HOS", Joel: "JOL",
  Amos: "AMO", Obad: "OBA", Jonah: "JON", Mic: "MIC", Nah: "NAH",
  Hab: "HAB", Zeph: "ZEP", Hag: "HAG", Zech: "ZEC", Mal: "MAL",
  Matt: "MAT", Mark: "MRK", Luke: "LUK", John: "JHN", Acts: "ACT",
  Rom: "ROM", "1Cor": "1CO", "2Cor": "2CO", Gal: "GAL", Eph: "EPH",
  Phil: "PHP", Col: "COL", "1Thess": "1TH", "2Thess": "2TH",
  "1Tim": "1TI", "2Tim": "2TI", Titus: "TIT", Phlm: "PHM",
  Heb: "HEB", Jas: "JAS", "1Pet": "1PE", "2Pet": "2PE",
  "1John": "1JN", "2John": "2JN", "3John": "3JN", Jude: "JUD",
  Rev: "REV",
};

interface ParsedRef {
  book: string;
  chapter: number;
  verse: number;
}

function parseVerseRef(ref: string): ParsedRef | null {
  // Format: Book.Chapter.Verse  e.g. Gen.1.1, 1Sam.3.4
  const parts = ref.split(".");
  if (parts.length < 3) return null;

  const bookRaw = parts[0];
  const chapter = parseInt(parts[1], 10);
  const verse = parseInt(parts[2], 10);

  if (isNaN(chapter) || isNaN(verse)) return null;

  const book = BOOK_MAP[bookRaw];
  if (!book) {
    // Try uppercase directly
    const upper = bookRaw.toUpperCase();
    if (upper.length <= 3) return { book: upper, chapter, verse };
    return null;
  }

  return { book, chapter, verse };
}

export function ingestCrossReferences(): void {
  const filePath = join(DATA_DIR, "cross_references.txt");
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split("\n");

  const db = getDb();

  // Clear existing data
  db.exec("DELETE FROM cross_refs");

  const insert = db.prepare(`
    INSERT INTO cross_refs (from_book, from_chapter, from_verse, to_book, to_chapter, to_verse, votes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  let skipped = 0;
  const unmappedBooks = new Set<string>();

  const insertMany = db.transaction(() => {
    for (const line of lines) {
      if (!line.trim() || line.startsWith("From")) continue;

      const cols = line.split("\t");
      if (cols.length < 3) continue;

      const fromRaw = cols[0].trim();
      const toRaw = cols[1].trim();
      const votes = parseInt(cols[2].trim(), 10);

      if (isNaN(votes)) continue;

      // Parse "from" — always a single verse
      const from = parseVerseRef(fromRaw);
      if (!from) {
        const bookRaw = fromRaw.split(".")[0];
        if (!BOOK_MAP[bookRaw]) unmappedBooks.add(bookRaw);
        skipped++;
        continue;
      }

      // Parse "to" — may be a range like Prov.8.22-Prov.8.30
      // We take the start of the range
      const toStart = toRaw.includes("-") ? toRaw.split("-")[0] : toRaw;
      const to = parseVerseRef(toStart);
      if (!to) {
        const bookRaw = toStart.split(".")[0];
        if (!BOOK_MAP[bookRaw]) unmappedBooks.add(bookRaw);
        skipped++;
        continue;
      }

      insert.run(from.book, from.chapter, from.verse, to.book, to.chapter, to.verse, votes);
      inserted++;
    }
  });

  insertMany();

  console.log(`Cross-references: ${inserted} inserted, ${skipped} skipped`);
  if (unmappedBooks.size > 0) {
    console.log(`Unmapped books: ${[...unmappedBooks].join(", ")}`);
  }
}

// Run directly if this is the main module
const isMain = process.argv[1]?.endsWith("ingest-cross-refs.ts") || process.argv[1]?.endsWith("ingest-cross-refs.js");
if (isMain) {
  initializeDb();
  ingestCrossReferences();
  console.log("Cross-reference ingestion complete.");
}
