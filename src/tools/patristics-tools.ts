/**
 * Patristics Tools — CCEL (Christian Classics Ethereal Library) Integration
 *
 * Provides access to the Schaff edition of the Ante-Nicene Fathers (ANF)
 * and Nicene & Post-Nicene Fathers (NPNF) series, plus standalone patristic
 * works like Augustine's Confessions, Athanasius's On the Incarnation, etc.
 *
 * API: https://ccel.org — no authentication required.
 *
 * Endpoints used:
 *   - GET /ajax/scripture?version=...&passage=...  (scripture via CCEL)
 *   - GET /ccel/{author}/{work}/{section}.html?html=true  (section HTML)
 *   - Catalog is hardcoded from the Schaff ANF/NPNF TOC.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ──────────────────────────────────────────────────────────────
// Volume catalog — Schaff ANF (vols 1-10) + NPNF S1 (vols 1-14) + NPNF S2 (vols 1-14)
// ──────────────────────────────────────────────────────────────
interface Volume {
  id: string;
  series: string;
  number: number;
  title: string;
  authors: string[];
  ccelPath: string;
}

const VOLUMES: Volume[] = [
  // ANF — Ante-Nicene Fathers
  { id: "anf01", series: "ANF", number: 1, title: "The Apostolic Fathers with Justin Martyr and Irenaeus", authors: ["Clement of Rome", "Polycarp", "Ignatius", "Justin Martyr", "Irenaeus"], ccelPath: "ccel/schaff/anf01" },
  { id: "anf02", series: "ANF", number: 2, title: "Fathers of the Second Century", authors: ["Hermas", "Tatian", "Theophilus", "Athenagoras", "Clement of Alexandria"], ccelPath: "ccel/schaff/anf02" },
  { id: "anf03", series: "ANF", number: 3, title: "Latin Christianity: Its Founder, Tertullian", authors: ["Tertullian"], ccelPath: "ccel/schaff/anf03" },
  { id: "anf04", series: "ANF", number: 4, title: "Fathers of the Third Century", authors: ["Tertullian (cont.)", "Minucius Felix", "Commodianus", "Origen"], ccelPath: "ccel/schaff/anf04" },
  { id: "anf05", series: "ANF", number: 5, title: "Fathers of the Third Century (cont.)", authors: ["Hippolytus", "Cyprian", "Novatian"], ccelPath: "ccel/schaff/anf05" },
  { id: "anf06", series: "ANF", number: 6, title: "Fathers of the Third Century (cont.)", authors: ["Gregory Thaumaturgus", "Dionysius the Great", "Julius Africanus", "Methodius"], ccelPath: "ccel/schaff/anf06" },
  { id: "anf07", series: "ANF", number: 7, title: "Fathers of the Third and Fourth Centuries", authors: ["Lactantius", "Venantius", "Asterius", "Victorinus", "Dionysius"], ccelPath: "ccel/schaff/anf07" },
  { id: "anf08", series: "ANF", number: 8, title: "The Twelve Patriarchs, Excerpts and Epistles, etc.", authors: ["Various"], ccelPath: "ccel/schaff/anf08" },
  { id: "anf09", series: "ANF", number: 9, title: "The Gospel of Peter, The Diatessaron, etc.", authors: ["Various"], ccelPath: "ccel/schaff/anf09" },
  { id: "anf10", series: "ANF", number: 10, title: "Bibliographical Synopsis, General Index", authors: ["Various"], ccelPath: "ccel/schaff/anf10" },
  // NPNF Series 1
  { id: "npnf1-01", series: "NPNF1", number: 1, title: "The Confessions and Letters of St. Augustine", authors: ["Augustine"], ccelPath: "ccel/schaff/npnf101" },
  { id: "npnf1-02", series: "NPNF1", number: 2, title: "The City of God, Christian Doctrine", authors: ["Augustine"], ccelPath: "ccel/schaff/npnf102" },
  { id: "npnf1-03", series: "NPNF1", number: 3, title: "On the Holy Trinity, Doctrinal Treatises, Moral Treatises", authors: ["Augustine"], ccelPath: "ccel/schaff/npnf103" },
  { id: "npnf1-04", series: "NPNF1", number: 4, title: "The Anti-Manichaean Writings, The Anti-Donatist Writings", authors: ["Augustine"], ccelPath: "ccel/schaff/npnf104" },
  { id: "npnf1-05", series: "NPNF1", number: 5, title: "Anti-Pelagian Writings", authors: ["Augustine"], ccelPath: "ccel/schaff/npnf105" },
  { id: "npnf1-06", series: "NPNF1", number: 6, title: "Sermon on the Mount, Harmony of the Gospels, Homilies on the Gospels", authors: ["Augustine"], ccelPath: "ccel/schaff/npnf106" },
  { id: "npnf1-07", series: "NPNF1", number: 7, title: "Homilies on the Gospel of John, First Epistle of John, Soliloquies", authors: ["Augustine"], ccelPath: "ccel/schaff/npnf107" },
  { id: "npnf1-08", series: "NPNF1", number: 8, title: "Expositions on the Psalms", authors: ["Augustine"], ccelPath: "ccel/schaff/npnf108" },
  { id: "npnf1-09", series: "NPNF1", number: 9, title: "On the Priesthood, Ascetic Treatises, etc.", authors: ["Chrysostom"], ccelPath: "ccel/schaff/npnf109" },
  { id: "npnf1-10", series: "NPNF1", number: 10, title: "Homilies on the Gospel of Saint Matthew", authors: ["Chrysostom"], ccelPath: "ccel/schaff/npnf110" },
  { id: "npnf1-11", series: "NPNF1", number: 11, title: "Homilies on the Acts and Romans", authors: ["Chrysostom"], ccelPath: "ccel/schaff/npnf111" },
  { id: "npnf1-12", series: "NPNF1", number: 12, title: "Homilies on 1 & 2 Corinthians", authors: ["Chrysostom"], ccelPath: "ccel/schaff/npnf112" },
  { id: "npnf1-13", series: "NPNF1", number: 13, title: "Homilies on Galatians through Hebrews", authors: ["Chrysostom"], ccelPath: "ccel/schaff/npnf113" },
  { id: "npnf1-14", series: "NPNF1", number: 14, title: "Homilies on the Gospel of St. John and Hebrews", authors: ["Chrysostom"], ccelPath: "ccel/schaff/npnf114" },
  // NPNF Series 2
  { id: "npnf2-01", series: "NPNF2", number: 1, title: "Eusebius: Church History, Life of Constantine, Oration", authors: ["Eusebius"], ccelPath: "ccel/schaff/npnf201" },
  { id: "npnf2-02", series: "NPNF2", number: 2, title: "Socrates, Sozomenus: Church Histories", authors: ["Socrates Scholasticus", "Sozomen"], ccelPath: "ccel/schaff/npnf202" },
  { id: "npnf2-03", series: "NPNF2", number: 3, title: "Theodoret, Jerome, Gennadius, Rufinus", authors: ["Theodoret", "Jerome", "Gennadius", "Rufinus"], ccelPath: "ccel/schaff/npnf203" },
  { id: "npnf2-04", series: "NPNF2", number: 4, title: "Athanasius: Select Works and Letters", authors: ["Athanasius"], ccelPath: "ccel/schaff/npnf204" },
  { id: "npnf2-05", series: "NPNF2", number: 5, title: "Gregory of Nyssa: Dogmatic Treatises, etc.", authors: ["Gregory of Nyssa"], ccelPath: "ccel/schaff/npnf205" },
  { id: "npnf2-06", series: "NPNF2", number: 6, title: "Jerome: Letters and Select Works", authors: ["Jerome"], ccelPath: "ccel/schaff/npnf206" },
  { id: "npnf2-07", series: "NPNF2", number: 7, title: "Cyril of Jerusalem, Gregory Nazianzen", authors: ["Cyril of Jerusalem", "Gregory of Nazianzus"], ccelPath: "ccel/schaff/npnf207" },
  { id: "npnf2-08", series: "NPNF2", number: 8, title: "Basil: Letters and Select Works", authors: ["Basil of Caesarea"], ccelPath: "ccel/schaff/npnf208" },
  { id: "npnf2-09", series: "NPNF2", number: 9, title: "Hilary of Poitiers, John of Damascus", authors: ["Hilary of Poitiers", "John of Damascus"], ccelPath: "ccel/schaff/npnf209" },
  { id: "npnf2-10", series: "NPNF2", number: 10, title: "Ambrose: Select Works and Letters", authors: ["Ambrose"], ccelPath: "ccel/schaff/npnf210" },
  { id: "npnf2-11", series: "NPNF2", number: 11, title: "Sulpitius Severus, Vincent of Lerins, John Cassian", authors: ["Sulpitius Severus", "Vincent of Lerins", "John Cassian"], ccelPath: "ccel/schaff/npnf211" },
  { id: "npnf2-12", series: "NPNF2", number: 12, title: "Leo the Great, Gregory the Great", authors: ["Leo the Great", "Gregory the Great"], ccelPath: "ccel/schaff/npnf212" },
  { id: "npnf2-13", series: "NPNF2", number: 13, title: "Gregory the Great (II), Ephraim Syrus, Aphrahat", authors: ["Gregory the Great", "Ephraim Syrus", "Aphrahat"], ccelPath: "ccel/schaff/npnf213" },
  { id: "npnf2-14", series: "NPNF2", number: 14, title: "The Seven Ecumenical Councils", authors: ["Various"], ccelPath: "ccel/schaff/npnf214" },
];

// Standalone works commonly accessed
interface StandaloneWork {
  id: string;
  title: string;
  author: string;
  ccelPath: string;
  sections: string[];
}

const STANDALONE_WORKS: StandaloneWork[] = [
  { id: "augustine-confessions", title: "Confessions", author: "Augustine", ccelPath: "ccel/augustine/confessions", sections: ["confessions.i", "confessions.ii", "confessions.iii", "confessions.iv", "confessions.v", "confessions.vi", "confessions.vii", "confessions.viii", "confessions.ix", "confessions.x", "confessions.xi", "confessions.xii", "confessions.xiii"] },
  { id: "athanasius-incarnation", title: "On the Incarnation", author: "Athanasius", ccelPath: "ccel/athanasius/incarnation", sections: ["incarnation.i", "incarnation.ii", "incarnation.iii", "incarnation.iv", "incarnation.v", "incarnation.vi", "incarnation.vii", "incarnation.viii", "incarnation.ix"] },
  { id: "augustine-enchiridion", title: "Handbook on Faith, Hope, and Love (Enchiridion)", author: "Augustine", ccelPath: "ccel/augustine/enchiridion", sections: [] },
  { id: "augustine-doctrine", title: "On Christian Doctrine", author: "Augustine", ccelPath: "ccel/augustine/doctrine", sections: [] },
  { id: "anselm-proslogium", title: "Proslogium / Cur Deus Homo", author: "Anselm", ccelPath: "ccel/anselm/basic_works", sections: [] },
  { id: "ignatius-exercises", title: "Spiritual Exercises", author: "Ignatius of Loyola", ccelPath: "ccel/ignatius/exercises", sections: [] },
];

// ──────────────────────────────────────────────────────────────
// HTTP helper
// ──────────────────────────────────────────────────────────────
async function ccelFetch(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "BibleMCP/1.1.0 (timothy@hankins.dev)" },
  });
  if (!res.ok) {
    throw new Error(`CCEL request failed: ${res.status} ${res.statusText} — ${url}`);
  }
  return res.text();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
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
export function registerPatristicsTools(server: McpServer): void {
  // ─── patristics_list_volumes ───
  server.tool(
    "patristics_list_volumes",
    "List all available volumes in the Ante-Nicene Fathers (ANF) and Nicene & Post-Nicene Fathers (NPNF) series from the Schaff edition on CCEL. Optionally filter by series (ANF, NPNF1, NPNF2) or search by author name.",
    {
      series: z
        .enum(["ANF", "NPNF1", "NPNF2"])
        .optional()
        .describe("Filter by series: 'ANF', 'NPNF1', or 'NPNF2'"),
      author: z
        .string()
        .optional()
        .describe("Filter by author name (case-insensitive partial match, e.g. 'augustine')"),
    },
    async ({ series, author }) => {
      let results = VOLUMES;
      if (series) {
        results = results.filter((v) => v.series === series);
      }
      if (author) {
        const lc = author.toLowerCase();
        results = results.filter((v) =>
          v.authors.some((a) => a.toLowerCase().includes(lc))
        );
      }

      const lines = results.map(
        (v) =>
          `**${v.id}** — ${v.series} Vol. ${v.number}: ${v.title}\n  Authors: ${v.authors.join(", ")}`
      );

      const standalone = STANDALONE_WORKS.map(
        (w) => `**${w.id}** — ${w.title} (${w.author})`
      );

      return {
        content: [
          {
            type: "text" as const,
            text:
              `# Schaff Series Volumes (${results.length} found)\n\n${lines.join("\n\n")}` +
              `\n\n---\n\n# Standalone Works (${STANDALONE_WORKS.length})\n\n${standalone.join("\n")}`,
          },
        ],
      };
    }
  );

  // ─── patristics_get_section ───
  server.tool(
    "patristics_get_section",
    "Retrieve a section of a patristic work from CCEL. For Schaff volumes, use a section path like 'anf01/anf01.ii.html'. For standalone works, use 'augustine/confessions/confessions.ii.html'. Returns the text content of that section.",
    {
      path: z
        .string()
        .describe(
          "CCEL section path. Examples:\n" +
          "  Schaff volume: 'schaff/npnf204/npnf204.xvi.ii.html' (Athanasius On the Incarnation ch2)\n" +
          "  Standalone: 'augustine/confessions/confessions.ii.html' (Confessions Book 2)\n" +
          "The path is appended to https://ccel.org/ccel/"
        ),
    },
    async ({ path }) => {
      const url = `https://ccel.org/ccel/${path}?html=true`;
      try {
        const html = await ccelFetch(url);
        const text = stripHtml(html);
        // Truncate if extremely long to stay within reasonable bounds
        const maxLen = 8000;
        const truncated = text.length > maxLen ? text.slice(0, maxLen) + "\n\n[...truncated — full text available at CCEL]" : text;
        return {
          content: [
            {
              type: "text" as const,
              text: `# CCEL Section: ${path}\n\nSource: https://ccel.org/ccel/${path}\n\n---\n\n${truncated}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error retrieving section: ${err.message}\n\nTip: Browse available sections at https://ccel.org/ccel/${path.split("/").slice(0, 2).join("/")}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ─── patristics_scripture ───
  server.tool(
    "patristics_scripture",
    "Look up a scripture passage from CCEL's scripture engine. Supports KJV, NRSV, and other versions available on CCEL. Useful as a cross-reference alongside the API.Bible tools.",
    {
      passage: z
        .string()
        .describe("Passage in CCEL format: book_chapter:start-end. Examples: 'matt_1:1-5', 'rom_8:28-39', 'gen_1' (whole chapter). Book names are lowercase abbreviations."),
      version: z
        .string()
        .optional()
        .default("nrsv")
        .describe("Bible version abbreviation (default: 'nrsv'). Common values: 'kjv', 'nrsv'."),
    },
    async ({ passage, version }) => {
      const url = `https://ccel.org/ajax/scripture?version=${version}&passage=${passage}`;
      try {
        const html = await ccelFetch(url);
        const text = stripHtml(html);
        return {
          content: [
            {
              type: "text" as const,
              text: `# ${passage.toUpperCase()} (${(version ?? "nrsv").toUpperCase()} via CCEL)\n\n${text}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching passage: ${err.message}\n\nUsage: passage format is book_chapter:startverse-endverse (e.g. 'matt_1:1-5')`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
