import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDb, initializeDb, tableHasData } from "../services/db.js";
import {
  CrossReferencesGetSchema,
  CrossReferencesBetweenSchema,
  StrongsLookupSchema,
  StrongsSearchSchema,
} from "../schemas/phase2-schemas.js";
import type {
  CrossReferencesGetInput,
  CrossReferencesBetweenInput,
  StrongsLookupInput,
  StrongsSearchInput,
} from "../schemas/phase2-schemas.js";

/**
 * Parse a verse ID like "ROM.8.28" into { book, chapter, verse }.
 */
function parseVerseId(verseId: string): {
  book: string;
  chapter: number;
  verse: number;
} | null {
  const parts = verseId.toUpperCase().split(".");
  if (parts.length !== 3) return null;
  const chapter = parseInt(parts[1], 10);
  const verse = parseInt(parts[2], 10);
  if (isNaN(chapter) || isNaN(verse)) return null;
  return { book: parts[0], chapter, verse };
}

/**
 * Register Phase 2 tools: cross-references and Strongs lexicon.
 */
export function registerPhase2Tools(server: McpServer): void {
  // Ensure DB is initialized
  initializeDb();

  const db = getDb();

  // Check data availability once at registration time
  const hasCrossRefs = tableHasData("cross_refs");
  const hasLexicon = tableHasData("lexicon");

  // ─── 1. Cross-reference lookup ───
  server.registerTool(
    "cross_references_get",
    {
      title: "Get Cross-References",
      description: `Find Bible cross-references for a given verse from the Treasury of Scripture Knowledge (~340,000 reference pairs).

Returns verses that are thematically or textually linked to the input verse, sorted by confidence score (vote count). Higher votes indicate stronger, more widely recognized connections.

The returned verse IDs can be piped directly into bible_get_verse or bible_get_passage for full text.

Args:
  - verse_id (string): Verse ID in BOOK.CHAPTER.VERSE format (e.g., "ROM.8.28", "JHN.3.16")
  - min_votes (number, optional): Minimum confidence threshold. Try 10-20 for strong refs only.
  - limit (number, optional): Max results (default: 25, max: 100)

Returns: List of cross-referenced verse IDs with confidence scores.`,
      inputSchema: CrossReferencesGetSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: CrossReferencesGetInput) => {
      if (!hasCrossRefs) {
        return {
          content: [
            {
              type: "text",
              text: "Cross-reference data not loaded. Run the server with --rebuild-db to ingest data.",
            },
          ],
        };
      }

      const parsed = parseVerseId(params.verse_id);
      if (!parsed) {
        return {
          content: [
            {
              type: "text",
              text: `Invalid verse ID format: "${params.verse_id}". Expected BOOK.CHAPTER.VERSE (e.g., ROM.8.28).`,
            },
          ],
        };
      }

      const { book, chapter, verse } = parsed;
      const minVotes = params.min_votes ?? 0;
      const limit = params.limit ?? 25;

      // Bidirectional: find refs FROM this verse and TO this verse
      const rows = db
        .prepare(
          `
        SELECT to_book AS book, to_chapter AS chapter, to_verse AS verse, votes, 'from' AS direction
        FROM cross_refs
        WHERE from_book = ? AND from_chapter = ? AND from_verse = ? AND votes >= ?
        UNION ALL
        SELECT from_book AS book, from_chapter AS chapter, from_verse AS verse, votes, 'to' AS direction
        FROM cross_refs
        WHERE to_book = ? AND to_chapter = ? AND to_verse = ? AND votes >= ?
        ORDER BY votes DESC
        LIMIT ?
      `
        )
        .all(
          book, chapter, verse, minVotes,
          book, chapter, verse, minVotes,
          limit
        ) as Array<{
          book: string;
          chapter: number;
          verse: number;
          votes: number;
          direction: string;
        }>;

      if (rows.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No cross-references found for ${params.verse_id.toUpperCase()}${minVotes > 0 ? ` with min_votes >= ${minVotes}` : ""}.`,
            },
          ],
        };
      }

      const lines = [
        `## Cross-References for ${book}.${chapter}.${verse}`,
        `_${rows.length} results${minVotes > 0 ? ` (min votes: ${minVotes})` : ""}_\n`,
      ];

      for (const row of rows) {
        const refId = `${row.book}.${row.chapter}.${row.verse}`;
        lines.push(`- **${refId}** — confidence: ${row.votes}`);
      }

      lines.push(
        `\n_Use bible_get_verse or bible_get_passage with these verse IDs to read the full text._`
      );

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );

  // ─── 2. Cross-reference between two specific verses ───
  server.registerTool(
    "cross_references_between",
    {
      title: "Check Cross-Reference Between Verses",
      description: `Check whether a direct cross-reference link exists between two specific verses.

Returns the confidence score if a link exists, or indicates no direct link was found. Useful for validating thematic connections during sermon prep or Bible study.

Args:
  - verse_id_a (string): First verse ID (e.g., "ROM.8.28")
  - verse_id_b (string): Second verse ID (e.g., "GEN.28.20")

Returns: Whether a cross-reference exists and its confidence score.`,
      inputSchema: CrossReferencesBetweenSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: CrossReferencesBetweenInput) => {
      if (!hasCrossRefs) {
        return {
          content: [
            {
              type: "text",
              text: "Cross-reference data not loaded. Run the server with --rebuild-db to ingest data.",
            },
          ],
        };
      }

      const a = parseVerseId(params.verse_id_a);
      const b = parseVerseId(params.verse_id_b);

      if (!a || !b) {
        return {
          content: [
            {
              type: "text",
              text: `Invalid verse ID format. Expected BOOK.CHAPTER.VERSE (e.g., ROM.8.28).`,
            },
          ],
        };
      }

      // Check both directions
      const row = db
        .prepare(
          `
        SELECT votes FROM cross_refs
        WHERE (from_book = ? AND from_chapter = ? AND from_verse = ?
               AND to_book = ? AND to_chapter = ? AND to_verse = ?)
           OR (from_book = ? AND from_chapter = ? AND from_verse = ?
               AND to_book = ? AND to_chapter = ? AND to_verse = ?)
        ORDER BY votes DESC
        LIMIT 1
      `
        )
        .get(
          a.book, a.chapter, a.verse, b.book, b.chapter, b.verse,
          b.book, b.chapter, b.verse, a.book, a.chapter, a.verse
        ) as { votes: number } | undefined;

      const idA = `${a.book}.${a.chapter}.${a.verse}`;
      const idB = `${b.book}.${b.chapter}.${b.verse}`;

      if (row) {
        return {
          content: [
            {
              type: "text",
              text: `## Cross-Reference Found\n\n**${idA}** ↔ **${idB}**\nConfidence score: **${row.votes}**\n\n_A direct thematic or textual link exists between these verses in the Treasury of Scripture Knowledge._`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `## No Direct Cross-Reference\n\n**${idA}** ↔ **${idB}**\n\n_No direct cross-reference link found in the Treasury of Scripture Knowledge. The verses may still be thematically related — try cross_references_get on each verse to find shared intermediate references._`,
          },
        ],
      };
    }
  );

  // ─── 3. Strongs lexicon lookup ───
  server.registerTool(
    "strongs_lookup",
    {
      title: "Strongs Lexicon Lookup",
      description: `Look up a Greek or Hebrew word by its Strongs number.

Returns the full lexical entry: original language lemma, transliteration, English gloss (short definition), and extended definition with semantic range.

Strongs numbers use G prefix for Greek (e.g., G5485 = charis/grace) and H prefix for Hebrew (e.g., H2617A = hesed/kindness).

Args:
  - strongs_id (string): Strongs number (e.g., "G5485", "H2617A", "G26")

Returns: Full lexical entry with lemma, transliteration, gloss, and definition.`,
      inputSchema: StrongsLookupSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: StrongsLookupInput) => {
      if (!hasLexicon) {
        return {
          content: [
            {
              type: "text",
              text: "Lexicon data not loaded. Run the server with --rebuild-db to ingest data.",
            },
          ],
        };
      }

      const id = params.strongs_id.toUpperCase();

      // Try exact match first, then try without trailing letter
      let row = db
        .prepare("SELECT * FROM lexicon WHERE strongs_id = ?")
        .get(id) as LexiconRow | undefined;

      // If not found and has no suffix letter, try padded with leading zeros
      if (!row) {
        const match = id.match(/^([GH])(\d+)([A-Z]?)$/);
        if (match) {
          const [, prefix, num, suffix] = match;
          const padded = `${prefix}${num.padStart(4, "0")}${suffix}`;
          row = db
            .prepare("SELECT * FROM lexicon WHERE strongs_id = ?")
            .get(padded) as LexiconRow | undefined;

          // Also try without suffix
          if (!row && !suffix) {
            const likePattern = `${prefix}${num.padStart(4, "0")}%`;
            const rows = db
              .prepare("SELECT * FROM lexicon WHERE strongs_id LIKE ? ORDER BY strongs_id LIMIT 5")
              .all(likePattern) as LexiconRow[];
            if (rows.length === 1) {
              row = rows[0];
            } else if (rows.length > 1) {
              // Multiple disambiguated entries — show all
              const lines = [
                `## Multiple entries for ${id}`,
                `_This Strongs number has ${rows.length} disambiguated entries:_\n`,
              ];
              for (const r of rows) {
                lines.push(`### ${r.strongs_id} — ${r.gloss || "no gloss"}`);
                if (r.lemma) lines.push(`**Lemma:** ${r.lemma}`);
                if (r.transliteration) lines.push(`**Transliteration:** ${r.transliteration}`);
                if (r.gloss) lines.push(`**Gloss:** ${r.gloss}`);
                if (r.definition) lines.push(`**Definition:** ${r.definition}`);
                lines.push("");
              }
              return { content: [{ type: "text", text: lines.join("\n") }] };
            }
          }
        }
      }

      if (!row) {
        return {
          content: [
            {
              type: "text",
              text: `No lexicon entry found for Strongs number "${params.strongs_id}".`,
            },
          ],
        };
      }

      const lines = [
        `## ${row.strongs_id} — ${row.gloss || "Unknown"}`,
        "",
        `**Language:** ${row.language === "greek" ? "Greek" : "Hebrew"}`,
      ];
      if (row.lemma) lines.push(`**Lemma:** ${row.lemma}`);
      if (row.transliteration)
        lines.push(`**Transliteration:** ${row.transliteration}`);
      if (row.gloss) lines.push(`**Gloss:** ${row.gloss}`);
      if (row.definition) lines.push(`\n**Definition:**\n${row.definition}`);

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );

  // ─── 4. Strongs search by keyword ───
  server.registerTool(
    "strongs_search",
    {
      title: "Search Strongs Lexicon",
      description: `Search the Greek/Hebrew lexicon by English keyword or phrase.

Searches across glosses (short definitions) and full definitions to find matching Strongs entries. Useful for finding the original language words behind English concepts.

Examples: "grace", "covenant love", "mercy", "righteousness", "faith"

Args:
  - query (string): English search term or phrase
  - language (string, optional): Filter by "greek" or "hebrew"
  - limit (number, optional): Max results (default: 20, max: 50)

Returns: Matching Strongs entries with IDs, glosses, and definitions.`,
      inputSchema: StrongsSearchSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: StrongsSearchInput) => {
      if (!hasLexicon) {
        return {
          content: [
            {
              type: "text",
              text: "Lexicon data not loaded. Run the server with --rebuild-db to ingest data.",
            },
          ],
        };
      }

      const limit = params.limit ?? 20;

      // Use FTS5 for full-text search
      const ftsQuery = params.query
        .replace(/[^\w\s]/g, "")
        .trim()
        .split(/\s+/)
        .map((w) => `"${w}"`)
        .join(" ");

      let rows: LexiconRow[];

      if (params.language) {
        rows = db
          .prepare(
            `
          SELECT l.* FROM lexicon_fts f
          JOIN lexicon l ON l.strongs_id = f.strongs_id
          WHERE lexicon_fts MATCH ? AND l.language = ?
          ORDER BY rank
          LIMIT ?
        `
          )
          .all(ftsQuery, params.language, limit) as LexiconRow[];
      } else {
        rows = db
          .prepare(
            `
          SELECT l.* FROM lexicon_fts f
          JOIN lexicon l ON l.strongs_id = f.strongs_id
          WHERE lexicon_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `
          )
          .all(ftsQuery, limit) as LexiconRow[];
      }

      if (rows.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No lexicon entries found matching "${params.query}"${params.language ? ` in ${params.language}` : ""}.`,
            },
          ],
        };
      }

      const lines = [
        `## Lexicon Search: "${params.query}"`,
        `_${rows.length} results${params.language ? ` (${params.language})` : ""}_\n`,
      ];

      for (const row of rows) {
        const lang = row.language === "greek" ? "Grk" : "Heb";
        lines.push(
          `- **${row.strongs_id}** [${lang}] ${row.lemma || ""} (${row.transliteration || ""}) — **${row.gloss || ""}**`
        );
        if (row.definition) {
          // Show first 200 chars of definition as preview
          const preview =
            row.definition.length > 200
              ? row.definition.slice(0, 200) + "..."
              : row.definition;
          lines.push(`  ${preview}`);
        }
        lines.push("");
      }

      lines.push(
        `_Use strongs_lookup with a specific Strongs ID for the full lexical entry._`
      );

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );
}

// Internal type for lexicon query results
interface LexiconRow {
  strongs_id: string;
  language: string;
  lemma: string | null;
  transliteration: string | null;
  gloss: string | null;
  definition: string | null;
  kjv_usage: string | null;
}
