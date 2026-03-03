import { z } from "zod";

// ─── List available Bibles ───
export const ListBiblesSchema = z
  .object({
    language: z
      .string()
      .optional()
      .describe(
        "ISO 639-3 language code to filter by (e.g., 'eng' for English, 'spa' for Spanish)"
      ),
  })
  .strict();

// ─── List books in a Bible ───
export const ListBooksSchema = z
  .object({
    bible_id: z
      .string()
      .min(1)
      .describe(
        "Bible version ID (e.g., 'de4e12af7f28f599-02' for KJV). Use bible_list_versions to find IDs."
      ),
  })
  .strict();

// ─── Get a passage (verse range) ───
export const GetPassageSchema = z
  .object({
    bible_id: z
      .string()
      .min(1)
      .describe("Bible version ID"),
    passage_id: z
      .string()
      .min(1)
      .describe(
        "Passage ID in format BOOK.CHAPTER.VERSE-BOOK.CHAPTER.VERSE " +
          "(e.g., 'ROM.8.28-ROM.8.39' or 'JHN.1.1-JHN.1.18'). " +
          "Can also be a single verse like 'JHN.3.16' or a full chapter like 'GEN.1'."
      ),
    include_notes: z
      .boolean()
      .default(false)
      .describe("Include translator/study notes if available"),
    include_titles: z
      .boolean()
      .default(true)
      .describe("Include section titles"),
    include_verse_numbers: z
      .boolean()
      .default(true)
      .describe("Include verse numbers in the text"),
    content_type: z
      .enum(["html", "text", "json"])
      .default("text")
      .describe("Response content format"),
  })
  .strict();

// ─── Get a single verse ───
export const GetVerseSchema = z
  .object({
    bible_id: z
      .string()
      .min(1)
      .describe("Bible version ID"),
    verse_id: z
      .string()
      .min(1)
      .describe(
        "Verse ID in format BOOK.CHAPTER.VERSE (e.g., 'JHN.3.16', 'GEN.1.1', 'ROM.8.28')"
      ),
    include_notes: z
      .boolean()
      .default(false)
      .describe("Include translator/study notes if available"),
    content_type: z
      .enum(["html", "text", "json"])
      .default("text")
      .describe("Response content format"),
  })
  .strict();

// ─── Get a full chapter ───
export const GetChapterSchema = z
  .object({
    bible_id: z
      .string()
      .min(1)
      .describe("Bible version ID"),
    chapter_id: z
      .string()
      .min(1)
      .describe(
        "Chapter ID in format BOOK.CHAPTER (e.g., 'GEN.1', 'JHN.3', 'PSA.23')"
      ),
    include_notes: z
      .boolean()
      .default(false)
      .describe("Include translator/study notes if available"),
    include_titles: z
      .boolean()
      .default(true)
      .describe("Include section titles"),
    include_verse_numbers: z
      .boolean()
      .default(true)
      .describe("Include verse numbers"),
    content_type: z
      .enum(["html", "text", "json"])
      .default("text")
      .describe("Response content format"),
  })
  .strict();

// ─── Search the Bible ───
export const SearchBibleSchema = z
  .object({
    bible_id: z
      .string()
      .min(1)
      .describe("Bible version ID"),
    query: z
      .string()
      .min(1)
      .max(200)
      .describe(
        "Search query — can be a keyword (e.g., 'mercy'), phrase (e.g., 'love your neighbor'), " +
          "or passage reference (e.g., 'John 3:16-19')"
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Maximum number of results to return"),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Result offset for pagination"),
  })
  .strict();

// ─── List sections (pericopes) in a book ───
export const ListSectionsSchema = z
  .object({
    bible_id: z
      .string()
      .min(1)
      .describe("Bible version ID"),
    book_id: z
      .string()
      .min(1)
      .describe(
        "Book ID — three-letter abbreviation (e.g., 'GEN', 'MAT', 'ROM', 'PSA')"
      ),
  })
  .strict();

// Export inferred types
export type ListBiblesInput = z.infer<typeof ListBiblesSchema>;
export type ListBooksInput = z.infer<typeof ListBooksSchema>;
export type GetPassageInput = z.infer<typeof GetPassageSchema>;
export type GetVerseInput = z.infer<typeof GetVerseSchema>;
export type GetChapterInput = z.infer<typeof GetChapterSchema>;
export type SearchBibleInput = z.infer<typeof SearchBibleSchema>;
export type ListSectionsInput = z.infer<typeof ListSectionsSchema>;
