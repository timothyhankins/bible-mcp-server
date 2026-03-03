/**
 * Lectionary Tools — LectServe API Integration
 *
 * Provides access to the Revised Common Lectionary (RCL) and ACNA lectionary
 * via the LectServe API at lectserve.com.
 *
 * No authentication required. All endpoints return JSON.
 *
 * Endpoints:
 *   - GET /today          (today's readings)
 *   - GET /sunday         (upcoming Sunday readings)
 *   - GET /date/YYYY-MM-DD  (readings for a specific date)
 *
 * Query params:
 *   - ?lect=acna|rcl        (Sunday/Red-Letter lectionary, default: acna)
 *   - ?dailyLect=acna-sec|acna-xian  (daily lectionary variant)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ──────────────────────────────────────────────────────────────
// API client
// ──────────────────────────────────────────────────────────────
const LECTSERVE_BASE = "https://www.lectserve.com";

interface LectServeDayPayload {
  day?: string;
  date?: string;
  season?: string;
  weekday?: string;
  readings?: string[];
  services?: Array<{
    name: string;
    readings: string[];
  }>;
  daily?: string[];
  [key: string]: unknown;
}

async function lectserveFetch(
  path: string,
  params?: Record<string, string>
): Promise<LectServeDayPayload> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const url = `${LECTSERVE_BASE}${path}${qs}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "BibleMCP/1.1.0 (timothy@hankins.dev)",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LectServe error ${res.status}: ${body || res.statusText}`);
  }

  return res.json() as Promise<LectServeDayPayload>;
}

function formatLectionary(data: LectServeDayPayload, lect: string): string {
  const lines: string[] = [];

  if (data.day) lines.push(`**Day:** ${data.day}`);
  if (data.date) lines.push(`**Date:** ${data.date}`);
  if (data.season) lines.push(`**Season:** ${data.season}`);
  if (data.weekday) lines.push(`**Weekday:** ${data.weekday}`);

  lines.push(`**Lectionary:** ${lect.toUpperCase()}`);
  lines.push("");

  // Sunday/feast readings — may be flat array or services array
  if (data.services && data.services.length > 0) {
    for (const svc of data.services) {
      lines.push(`### ${svc.name}`);
      svc.readings.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
      lines.push("");
    }
  } else if (data.readings && data.readings.length > 0) {
    lines.push("### Readings");
    data.readings.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
    lines.push("");
  }

  // Daily readings
  if (data.daily && data.daily.length > 0) {
    lines.push("### Daily Readings");
    data.daily.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
    lines.push("");
  }

  // Catch any other keys that look like reading lists
  for (const [key, val] of Object.entries(data)) {
    if (
      !["day", "date", "season", "weekday", "readings", "services", "daily"].includes(key) &&
      Array.isArray(val)
    ) {
      lines.push(`### ${key}`);
      (val as string[]).forEach((r: string, i: number) => lines.push(`${i + 1}. ${r}`));
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ──────────────────────────────────────────────────────────────
// Tool registration
// ──────────────────────────────────────────────────────────────
export function registerLectionaryTools(server: McpServer): void {
  const lectEnum = z.enum(["rcl", "acna"]).optional().default("rcl");
  const dailyLectEnum = z.enum(["acna-sec", "acna-xian"]).optional();

  // ─── lectionary_today ───
  server.tool(
    "lectionary_today",
    "Get today's lectionary readings from the Revised Common Lectionary (RCL) or ACNA lectionary. " +
    "Returns the liturgical day name, season, and all appointed readings. " +
    "'Today' is relative to US Central Time.",
    {
      lect: lectEnum.describe("Lectionary: 'rcl' (Revised Common Lectionary, default) or 'acna' (Anglican Church in North America)"),
      dailyLect: dailyLectEnum.describe("ACNA daily lectionary variant: 'acna-sec' (civil calendar) or 'acna-xian' (liturgical calendar)"),
    },
    async ({ lect, dailyLect }) => {
      try {
        const params: Record<string, string> = {};
        if (lect) params.lect = lect;
        if (dailyLect) params.dailyLect = dailyLect;

        const data = await lectserveFetch("/today", params);
        const formatted = formatLectionary(data, lect ?? "rcl");

        return {
          content: [
            {
              type: "text" as const,
              text: `# Today's Lectionary Readings\n\n${formatted}\n\n_Source: LectServe (lectserve.com)_`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text" as const, text: `Error fetching today's readings: ${err.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ─── lectionary_sunday ───
  server.tool(
    "lectionary_sunday",
    "Get the lectionary readings for the upcoming Sunday. Useful for sermon preparation — " +
    "returns the liturgical day name, season, and all appointed readings (Old Testament, Psalm, " +
    "Epistle, Gospel). Supports both RCL and ACNA lectionaries.",
    {
      lect: lectEnum.describe("Lectionary: 'rcl' (default) or 'acna'"),
    },
    async ({ lect }) => {
      try {
        const params: Record<string, string> = {};
        if (lect) params.lect = lect;

        const data = await lectserveFetch("/sunday", params);
        const formatted = formatLectionary(data, lect ?? "rcl");

        return {
          content: [
            {
              type: "text" as const,
              text: `# Upcoming Sunday Lectionary Readings\n\n${formatted}\n\n_Source: LectServe (lectserve.com)_`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text" as const, text: `Error fetching Sunday readings: ${err.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ─── lectionary_date ───
  server.tool(
    "lectionary_date",
    "Get lectionary readings for a specific date. Useful for looking up past or future readings, " +
    "planning ahead, or checking what the liturgical day was for a particular date.",
    {
      date: z
        .string()
        .describe("Date in YYYY-MM-DD format. Example: '2026-03-08' for this coming Sunday."),
      lect: lectEnum.describe("Lectionary: 'rcl' (default) or 'acna'"),
      dailyLect: dailyLectEnum.describe("ACNA daily lectionary variant (optional)"),
    },
    async ({ date, lect, dailyLect }) => {
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Invalid date format. Use YYYY-MM-DD (e.g., '2026-03-08').",
            },
          ],
          isError: true,
        };
      }

      try {
        const params: Record<string, string> = {};
        if (lect) params.lect = lect;
        if (dailyLect) params.dailyLect = dailyLect;

        const data = await lectserveFetch(`/date/${date}`, params);
        const formatted = formatLectionary(data, lect ?? "rcl");

        return {
          content: [
            {
              type: "text" as const,
              text: `# Lectionary Readings for ${date}\n\n${formatted}\n\n_Source: LectServe (lectserve.com)_`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text" as const, text: `Error fetching readings for ${date}: ${err.message}` },
          ],
          isError: true,
        };
      }
    }
  );
}
