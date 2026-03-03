// ─── API.Bible response types ───

export interface BibleSummary {
  id: string;
  dblId: string;
  name: string;
  nameLocal: string;
  abbreviation: string;
  abbreviationLocal: string;
  description: string;
  descriptionLocal: string;
  language: {
    id: string;
    name: string;
    nameLocal: string;
    script: string;
    scriptDirection: string;
  };
  countries: Array<{ id: string; name: string; nameLocal: string }>;
  type: string;
  updatedAt: string;
}

export interface BookSummary {
  id: string;
  bibleId: string;
  abbreviation: string;
  name: string;
  nameLong: string;
}

export interface ChapterSummary {
  id: string;
  bibleId: string;
  bookId: string;
  number: string;
  reference: string;
}

export interface ChapterContent {
  id: string;
  bibleId: string;
  bookId: string;
  number: string;
  content: string;
  reference: string;
  copyright: string;
  verseCount: number;
}

export interface VerseSummary {
  id: string;
  orgId: string;
  bibleId: string;
  bookId: string;
  chapterId: string;
  reference: string;
}

export interface VerseContent {
  id: string;
  orgId: string;
  bibleId: string;
  bookId: string;
  chapterId: string;
  content: string;
  reference: string;
  copyright: string;
}

export interface PassageContent {
  id: string;
  bibleId: string;
  orgId: string;
  content: string;
  reference: string;
  copyright: string;
  verseCount: number;
}

export interface SearchResponse {
  query: string;
  limit: number;
  offset: number;
  total: number;
  verseCount: number;
  verses?: Array<{
    id: string;
    orgId: string;
    bibleId: string;
    bookId: string;
    chapterId: string;
    text: string;
    reference: string;
  }>;
  passages?: Array<{
    id: string;
    bibleId: string;
    orgId: string;
    content: string;
    reference: string;
    copyright: string;
    verseCount: number;
  }>;
}

export interface SectionSummary {
  id: string;
  bibleId: string;
  bookId: string;
  chapterId: string;
  title: string;
}

// Wrapper — all API.Bible responses use { data: T }
export interface ApiResponse<T> {
  data: T;
  meta?: {
    fumsId?: string;
    fumsUrl?: string;
    fumsJsInclude?: string;
    fums?: string;
  };
}
