/**
 * NLT Tools — Tyndale New Living Translation API Integration
 *
 * Provides access to the NLT text via Tyndale's official API at api.nlt.to.
 *
 * Authentication:
 *   - Anonymous: 50 verses/req, 500 req/day (uses key=TEST)
 *   - With NLT_API_KEY env var: 500 verses/req, 5000 req/day
 *
 * Endpoints:
 *   - GET /api/passages?ref=...&key=...  (passage lookup)
 *   - GET /api/search?text=...&key=...   (keyword search)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ──────────────────────────────────────────────────────────────
// API client — lazy key resolution
// ──────────────────────────────────────────────────────────────
const NLT_BASE = "https://api.nlt.to/api";

function getNltKey(): string {
  return process.env.NLT_API_KEY || "TEST";
}

function isAnonymous(): boolean {
  return !process.env.NLT_API_KEY;
}

async function nltFetch(endpoint: string, params: Record<string, string>): Promise<string> {
  const key = getNltKey();
  const qs = new URLSearchParams({ ...params, key });
  const url = `${NLT_BASE}/${endpoint}?${qs.toString()}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "BibleMCP/1.1.0 (timothy@hankins.dev)",
      Accept: "text/plain",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NLT API error ${res.status}: ${body || res.statusText}`);
  }

  return res.text();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ──────────────────────────────────────────────────────────────
// Tool registration
// ──────────────────────────────────────────────────────────────
export function registerNltTools(server: McpServer): void {
  // ─── nlt_get_passage ───
  server.tool(
    "nlt_get_passage",
    "Retrieve a passage from the New Living Translation (NLT) via the official Tyndale API. " +
    "The NLT is a dynamic-equivalence translation known for its clarity and accessibility. " +
    "Useful for comparing with more literal translations from API.Bible.\n\n" +
    "Reference format: 'John 3:16', 'Romans 8:28-39', 'Genesis 1', 'Psalm 23'.\n" +
    "Multiple passages can be separated with semicolons: 'John 3:16; Romans 8:28'.",
    {
      ref: z
        .string()
        .describe(
          "Scripture reference. Examples: 'John 3:16', 'Romans 8:28-39', 'Genesis 1', 'Psalm 23:1-6'. " +
          "Separate multiple refs with semicolons."
        ),
    },
    async ({ ref }) => {
      try {
        const raw = await nltFetch("passages", { ref });
        const text = stripHtml(raw);
        const mode = isAnonymous() ? "anonymous (50 verse limit)" : "key-based (500 verse limit)";
        return {
          content: [
            {
              type: "text" as const,
              text:
                `# ${ref} — New Living Translation (NLT)\n\n${text}\n\n` +
                `---\n_Scripture quotations are taken from the Holy Bible, New Living Translation, ` +
                `copyright ©1996, 2004, 2015 by Tyndale House Foundation. Used by permission of ` +
                `Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved._\n\n` +
                `_API mode: ${mode}_`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error retrieving NLT passage: ${err.message}\n\n` +
                `Tip: Use standard reference format like 'John 3:16' or 'Romans 8:28-39'.` +
                (isAnonymous()
                  ? `\n\nNote: Running in anonymous mode (50 verses/req, 500 req/day). Set NLT_API_KEY for higher limits.`
                  : ""),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ─── nlt_search ───
  server.tool(
    "nlt_search",
    "Search the New Living Translation for passages containing specific words or phrases. " +
    "Returns matching passages with short context paragraphs. Useful for finding NLT-specific " +
    "renderings of theological concepts.",
    {
      text: z
        .string()
        .describe("Search terms. Examples: 'love your neighbor', 'grace', 'new creation'."),
    },
    async ({ text }) => {
      try {
        const raw = await nltFetch("search", { text });
        const cleaned = stripHtml(raw);

        // The API returns HTML with passage results; clean it up
        const maxLen = 6000;
        const truncated =
          cleaned.length > maxLen
            ? cleaned.slice(0, maxLen) + "\n\n[...more results available — refine your search]"
            : cleaned;

        return {
          content: [
            {
              type: "text" as const,
              text:
                `# NLT Search: "${text}"\n\n${truncated}\n\n` +
                `---\n_Scripture quotations are taken from the Holy Bible, New Living Translation, ` +
                `copyright ©1996, 2004, 2015 by Tyndale House Foundation._`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching NLT: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
