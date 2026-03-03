import { API_BASE_URL } from "../constants.js";
import type { ApiResponse } from "../types.js";

/**
 * Shared API client for API.Bible.
 * API key is read from the BIBLE_API_KEY environment variable.
 */
export class BibleApiClient {
  private apiKey: string;

  constructor() {
    const key = process.env.BIBLE_API_KEY;
    if (!key) {
      throw new Error(
        "BIBLE_API_KEY environment variable is required. " +
          "Sign up at https://scripture.api.bible/ to get a free key."
      );
    }
    this.apiKey = key;
  }

  /**
   * Make an authenticated GET request to API.Bible.
   */
  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<ApiResponse<T>> {
    const url = new URL(`${API_BASE_URL}${path}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        "api-key": this.apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new ApiError(
        `API.Bible returned ${response.status}: ${response.statusText}` +
          (errorBody ? ` — ${errorBody}` : ""),
        response.status
      );
    }

    return (await response.json()) as ApiResponse<T>;
  }
}

/**
 * Custom error class for API failures with status codes.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Strip HTML tags from API.Bible content and clean up whitespace.
 * API.Bible returns HTML-formatted scripture text.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "") // remove tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
}

/**
 * Format a scripture response for clean readability.
 */
export function formatScripture(
  reference: string,
  content: string,
  copyright: string
): string {
  const cleanText = stripHtml(content);
  const lines = [`**${reference}**`, "", cleanText];
  if (copyright) {
    lines.push("", `_${copyright}_`);
  }
  return lines.join("\n");
}

/**
 * Build an actionable error message for tool consumers.
 */
export function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 400:
        return `Bad request — check that your Bible ID, book, chapter, and verse IDs are valid. ${error.message}`;
      case 401:
        return "Unauthorized — the API key appears invalid. Verify BIBLE_API_KEY is set correctly.";
      case 403:
        return "Forbidden — your API key does not have access to this Bible version.";
      case 404:
        return "Not found — the requested scripture reference does not exist. Double-check the book abbreviation, chapter, and verse numbers.";
      case 429:
        return "Rate limited — too many requests. Wait a moment and try again.";
      default:
        return `API.Bible error (${error.statusCode}): ${error.message}`;
    }
  }
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Unknown error: ${String(error)}`;
}
