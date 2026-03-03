import { API_BASE_URL } from "../constants.js";
import type { ApiResponse } from "../types.js";

export class BibleApiClient {
  private get apiKey(): string {
    const key = process.env.BIBLE_API_KEY;
    if (!key) {
      throw new ApiError(
        "BIBLE_API_KEY environment variable is required.",
        500
      );
    }
    return key;
  }

  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<ApiResponse<T>> {
    const url = new URL(`${API_BASE_URL}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    const response = await fetch(url.toString(), {
      headers: { "api-key": this.apiKey, Accept: "application/json" },
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

export class ApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

export function formatScripture(reference: string, content: string, copyright: string): string {
  const cleanText = stripHtml(content);
  const lines = [`**${reference}**`, "", cleanText];
  if (copyright) lines.push("", `_${copyright}_`);
  return lines.join("\n");
}

export function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 400: return `Bad request — check your Bible ID and reference format. ${error.message}`;
      case 401: return "Unauthorized — verify BIBLE_API_KEY is set correctly.";
      case 403: return "Forbidden — your API key doesn't have access to this Bible version.";
      case 404: return "Not found — double-check the book abbreviation, chapter, and verse numbers.";
      case 429: return "Rate limited — wait a moment and try again.";
      default: return `API.Bible error (${error.statusCode}): ${error.message}`;
    }
  }
  if (error instanceof Error) return `Error: ${error.message}`;
  return `Unknown error: ${String(error)}`;
}
