import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BibleApiClient, formatScripture, formatError, stripHtml } from "../services/api-client.js";
import {
  ListBiblesSchema,
  ListBooksSchema,
  GetPassageSchema,
  GetVerseSchema,
  GetChapterSchema,
  SearchBibleSchema,
  ListSectionsSchema,
} from "../schemas/bible-schemas.js";
import type {
  ListBiblesInput,
  ListBooksInput,
  GetPassageInput,
  GetVerseInput,
  GetChapterInput,
  SearchBibleInput,
  ListSectionsInput,
} from "../schemas/bible-schemas.js";
import type {
  BibleSummary,
  BookSummary,
  ChapterContent,
  VerseContent,
  PassageContent,
  SearchResponse,
  SectionSummary,
  ChapterSummary,
} from "../types.js";
import { CHARACTER_LIMIT, WELL_KNOWN_BIBLES } from "../constants.js";

/**
 * Register all Bible tools on the MCP server.
 */
export function registerBibleTools(server: McpServer): void {
  const client = new BibleApiClient();

  // ─── 1. List available Bible versions ───
  server.registerTool(
    "bible_list_versions",
    {
      title: "List Bible Versions",
      description: `List available Bible translations/versions from API.Bible.

Returns a list of Bible versions you have access to, with their IDs, names, 
abbreviations, and languages. Use the returned 'id' field as the bible_id 
parameter in other tools.

Well-known IDs for quick reference:
  - KJV: de4e12af7f28f599-02
  - ASV: 06125adad2d5898a-01
  - WEB: 9879dbb7cfe39e4d-04

Args:
  - language (string, optional): Filter by ISO 639-3 language code (e.g., 'eng')

Returns: List of Bible versions with id, name, abbreviation, language.`,
      inputSchema: ListBiblesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: ListBiblesInput) => {
      try {
        const queryParams: Record<string, string> = {};
        if (params.language) queryParams.language = params.language;

        const response = await client.get<BibleSummary[]>("/bibles", queryParams);
        const bibles = response.data;

        const lines = [`## Available Bible Versions (${bibles.length})`, ""];

        // Add well-known shortcuts
        lines.push("**Quick Reference IDs:**");
        for (const [abbr, id] of Object.entries(WELL_KNOWN_BIBLES)) {
          lines.push(`- ${abbr}: \`${id}\``);
        }
        lines.push("");

        // List all versions
        for (const bible of bibles.slice(0, 50)) {
          lines.push(
            `- **${bible.name}** (${bible.abbreviationLocal}) — ` +
              `${bible.language.name} — ID: \`${bible.id}\``
          );
        }

        if (bibles.length > 50) {
          lines.push(`\n_...and ${bibles.length - 50} more. Filter by language for a shorter list._`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }] };
      }
    }
  );

  // ─── 2. List books in a Bible ───
  server.registerTool(
    "bible_list_books",
    {
      title: "List Books of the Bible",
      description: `List all books in a specific Bible version.

Returns the canonical book list with IDs you can use to look up chapters, 
verses, and sections.

Args:
  - bible_id (string): Bible version ID (use bible_list_versions to find one)

Returns: List of books with id, name, and abbreviation.`,
      inputSchema: ListBooksSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: ListBooksInput) => {
      try {
        const response = await client.get<BookSummary[]>(
          `/bibles/${params.bible_id}/books`
        );

        const lines = ["## Books", ""];
        for (const book of response.data) {
          lines.push(`- **${book.name}** (${book.abbreviation}) — ID: \`${book.id}\``);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }] };
      }
    }
  );

  // ─── 3. Get a passage (verse range) ───
  server.registerTool(
    "bible_get_passage",
    {
      title: "Get Bible Passage",
      description: `Retrieve a passage (range of verses) from the Bible.

This is the most flexible scripture retrieval tool. It can fetch:
- A single verse: "JHN.3.16"
- A verse range: "ROM.8.28-ROM.8.39"
- A full chapter: "GEN.1"
- A multi-chapter range: "PSA.23-PSA.24"

Args:
  - bible_id (string): Bible version ID
  - passage_id (string): Passage ID (e.g., "ROM.8.28-ROM.8.39")
  - include_notes (boolean): Include study notes (default: false)
  - include_titles (boolean): Include section titles (default: true)
  - include_verse_numbers (boolean): Include verse numbers (default: true)
  - content_type (string): "html", "text", or "json" (default: "text")

Returns: Scripture text with reference and copyright notice.`,
      inputSchema: GetPassageSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: GetPassageInput) => {
      try {
        const response = await client.get<PassageContent>(
          `/bibles/${params.bible_id}/passages/${params.passage_id}`,
          {
            "content-type": params.content_type,
            "include-notes": params.include_notes,
            "include-titles": params.include_titles,
            "include-verse-numbers": params.include_verse_numbers,
          }
        );

        const passage = response.data;
        const text = formatScripture(passage.reference, passage.content, passage.copyright);

        if (text.length > CHARACTER_LIMIT) {
          return {
            content: [
              {
                type: "text",
                text:
                  text.slice(0, CHARACTER_LIMIT) +
                  `\n\n_[Truncated — passage is ${passage.verseCount} verses. Request a smaller range.]_`,
              },
            ],
          };
        }

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }] };
      }
    }
  );

  // ─── 4. Get a single verse ───
  server.registerTool(
    "bible_get_verse",
    {
      title: "Get Bible Verse",
      description: `Retrieve a single verse from the Bible.

Args:
  - bible_id (string): Bible version ID
  - verse_id (string): Verse ID in format BOOK.CHAPTER.VERSE (e.g., "JHN.3.16")
  - include_notes (boolean): Include study notes (default: false)
  - content_type (string): "html", "text", or "json" (default: "text")

Returns: Verse text with reference and copyright.`,
      inputSchema: GetVerseSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: GetVerseInput) => {
      try {
        const response = await client.get<VerseContent>(
          `/bibles/${params.bible_id}/verses/${params.verse_id}`,
          {
            "content-type": params.content_type,
            "include-notes": params.include_notes,
          }
        );

        const verse = response.data;
        const text = formatScripture(verse.reference, verse.content, verse.copyright);

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }] };
      }
    }
  );

  // ─── 5. Get a full chapter ───
  server.registerTool(
    "bible_get_chapter",
    {
      title: "Get Bible Chapter",
      description: `Retrieve an entire chapter from the Bible.

Args:
  - bible_id (string): Bible version ID
  - chapter_id (string): Chapter ID in format BOOK.CHAPTER (e.g., "GEN.1", "PSA.23")
  - include_notes (boolean): Include study notes (default: false)
  - include_titles (boolean): Include section titles (default: true)
  - include_verse_numbers (boolean): Include verse numbers (default: true)
  - content_type (string): "html", "text", or "json" (default: "text")

Returns: Full chapter text with reference and copyright.`,
      inputSchema: GetChapterSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: GetChapterInput) => {
      try {
        const response = await client.get<ChapterContent>(
          `/bibles/${params.bible_id}/chapters/${params.chapter_id}`,
          {
            "content-type": params.content_type,
            "include-notes": params.include_notes,
            "include-titles": params.include_titles,
            "include-verse-numbers": params.include_verse_numbers,
          }
        );

        const chapter = response.data;
        const text = formatScripture(chapter.reference, chapter.content, chapter.copyright);

        if (text.length > CHARACTER_LIMIT) {
          return {
            content: [
              {
                type: "text",
                text:
                  text.slice(0, CHARACTER_LIMIT) +
                  `\n\n_[Truncated — chapter has ${chapter.verseCount} verses. Use bible_get_passage for a specific range.]_`,
              },
            ],
          };
        }

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }] };
      }
    }
  );

  // ─── 6. Search the Bible ───
  server.registerTool(
    "bible_search",
    {
      title: "Search the Bible",
      description: `Search a Bible version by keyword, phrase, or passage reference.

Keyword searches (e.g., "mercy", "love your neighbor") return individual 
matching verses. Passage reference searches (e.g., "John 3:16-19") return 
the passage content directly.

Args:
  - bible_id (string): Bible version ID
  - query (string): Keyword, phrase, or passage reference
  - limit (number): Max results, 1-100 (default: 20)
  - offset (number): Pagination offset (default: 0)

Returns: Matching verses or passages with references.`,
      inputSchema: SearchBibleSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: SearchBibleInput) => {
      try {
        const response = await client.get<SearchResponse>(
          `/bibles/${params.bible_id}/search`,
          {
            query: params.query,
            limit: params.limit,
            offset: params.offset,
          }
        );

        const data = response.data;
        const lines: string[] = [];

        lines.push(`## Search: "${data.query}"`);
        lines.push(`_${data.total} total results (showing ${data.offset + 1}–${data.offset + (data.verseCount || 0)})_\n`);

        // Keyword search returns verses
        if (data.verses && data.verses.length > 0) {
          for (const verse of data.verses) {
            lines.push(`**${verse.reference}**`);
            lines.push(stripHtml(verse.text));
            lines.push("");
          }
        }

        // Passage search returns passages
        if (data.passages && data.passages.length > 0) {
          for (const passage of data.passages) {
            lines.push(
              formatScripture(passage.reference, passage.content, passage.copyright)
            );
            lines.push("");
          }
        }

        if ((!data.verses || data.verses.length === 0) && (!data.passages || data.passages.length === 0)) {
          lines.push("_No results found for this query._");
        }

        // Pagination hint
        if (data.total > data.offset + (data.verseCount || 0)) {
          lines.push(
            `_More results available — use offset: ${data.offset + params.limit} to see the next page._`
          );
        }

        const text = lines.join("\n");
        return {
          content: [
            {
              type: "text",
              text: text.length > CHARACTER_LIMIT ? text.slice(0, CHARACTER_LIMIT) + "\n\n_[Truncated]_" : text,
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }] };
      }
    }
  );

  // ─── 7. List sections (pericopes) in a book ───
  server.registerTool(
    "bible_list_sections",
    {
      title: "List Bible Sections",
      description: `List the titled sections (pericopes) within a book of the Bible.

Sections are narrative or thematic divisions like "The Birth of Jesus Christ" 
or "The Sermon on the Mount." Useful for navigating and understanding 
the structure of a book.

Args:
  - bible_id (string): Bible version ID
  - book_id (string): Book abbreviation (e.g., "MAT", "GEN", "ROM")

Returns: List of sections with titles and chapter locations.`,
      inputSchema: ListSectionsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: ListSectionsInput) => {
      try {
        const response = await client.get<SectionSummary[]>(
          `/bibles/${params.bible_id}/books/${params.book_id}/sections`
        );

        const sections = response.data;
        const lines = [`## Sections in ${params.book_id}`, ""];

        for (const section of sections) {
          lines.push(`- **${section.title}** (${section.chapterId}) — ID: \`${section.id}\``);
        }

        if (sections.length === 0) {
          lines.push("_No sections available for this book in this version._");
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }] };
      }
    }
  );
}
