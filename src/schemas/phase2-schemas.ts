import { z } from "zod";

// ─── Cross-reference: get references for a verse ───
export const CrossReferencesGetSchema = z
  .object({
    verse_id: z
      .string()
      .min(1)
      .describe(
        "Verse ID in format BOOK.CHAPTER.VERSE (e.g., 'ROM.8.28', 'JHN.3.16', 'GEN.1.1'). " +
          "Uses uppercase 3-letter book codes."
      ),
    min_votes: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        "Minimum confidence score (vote count) to filter results. " +
          "Higher values surface stronger cross-references. Range: 0-100+."
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(25)
      .describe("Maximum number of cross-references to return (default: 25)"),
  })
  .strict();

// ─── Cross-reference: check link between two verses ───
export const CrossReferencesBetweenSchema = z
  .object({
    verse_id_a: z
      .string()
      .min(1)
      .describe(
        "First verse ID in format BOOK.CHAPTER.VERSE (e.g., 'ROM.8.28')"
      ),
    verse_id_b: z
      .string()
      .min(1)
      .describe(
        "Second verse ID in format BOOK.CHAPTER.VERSE (e.g., 'GEN.28.20')"
      ),
  })
  .strict();

// ─── Strongs lookup by ID ───
export const StrongsLookupSchema = z
  .object({
    strongs_id: z
      .string()
      .min(1)
      .describe(
        "Strongs number (e.g., 'G5485' for charis/grace, 'H2617A' for hesed/kindness). " +
          "Prefix G = Greek, H = Hebrew. Optional trailing letter for disambiguated entries."
      ),
  })
  .strict();

// ─── Strongs search by keyword ───
export const StrongsSearchSchema = z
  .object({
    query: z
      .string()
      .min(1)
      .max(200)
      .describe(
        "Search term to match against English glosses and definitions " +
          "(e.g., 'grace', 'covenant love', 'mercy')"
      ),
    language: z
      .enum(["greek", "hebrew"])
      .optional()
      .describe("Filter results by language (optional)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Maximum number of results to return (default: 20)"),
  })
  .strict();

// Export inferred types
export type CrossReferencesGetInput = z.infer<typeof CrossReferencesGetSchema>;
export type CrossReferencesBetweenInput = z.infer<typeof CrossReferencesBetweenSchema>;
export type StrongsLookupInput = z.infer<typeof StrongsLookupSchema>;
export type StrongsSearchInput = z.infer<typeof StrongsSearchSchema>;
