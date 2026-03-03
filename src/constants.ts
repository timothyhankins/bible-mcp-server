// API.Bible base URL and configuration
export const API_BASE_URL = "https://rest.api.bible/v1";

// Character limit for responses to avoid flooding context
export const CHARACTER_LIMIT = 15_000;

// Common Bible version IDs for quick reference
// Users will need their own API key; these are well-known IDs
export const WELL_KNOWN_BIBLES: Record<string, string> = {
  KJV: "de4e12af7f28f599-02",
  ASV: "06125adad2d5898a-01",
  WEB: "9879dbb7cfe39e4d-04",
};

// Book ID format: three-letter abbreviations (e.g., GEN, EXO, MAT, JHN)
// Verse ID format: BOOK.CHAPTER.VERSE (e.g., JHN.3.16)
// Passage ID format: BOOK.CHAPTER.VERSE-BOOK.CHAPTER.VERSE (e.g., ROM.8.28-ROM.8.39)
