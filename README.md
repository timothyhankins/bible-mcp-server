# Bible MCP Server

An MCP (Model Context Protocol) server that connects Claude to [API.Bible](https://scripture.api.bible/), giving you direct scripture lookup, keyword search, and passage retrieval inside your conversations.

## What It Does

| Tool | Description |
|---|---|
| `bible_list_versions` | List available Bible translations (KJV, ASV, WEB, etc.) |
| `bible_list_books` | List books in a specific Bible version |
| `bible_get_passage` | Fetch a verse range (e.g., Romans 8:28-39) |
| `bible_get_verse` | Fetch a single verse (e.g., John 3:16) |
| `bible_get_chapter` | Fetch an entire chapter (e.g., Psalm 23) |
| `bible_search` | Search by keyword or passage reference |
| `bible_list_sections` | List titled sections/pericopes in a book |

## Setup

### 1. Get an API Key

Sign up at [https://scripture.api.bible/](https://scripture.api.bible/) — the starter plan is free.

### 2. Install Dependencies

```bash
cd bible-mcp-server
npm install
```

### 3. Build

```bash
npm run build
```

### 4. Configure Environment

```bash
export BIBLE_API_KEY="your-api-key-here"
```

### 5. Add to Claude Desktop

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "bible": {
      "command": "node",
      "args": ["/absolute/path/to/bible-mcp-server/dist/index.js"],
      "env": {
        "BIBLE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 6. (Alternative) Run as HTTP Server

If you want to host it remotely or use it with Claude.ai via the MCP connector:

```bash
TRANSPORT=http BIBLE_API_KEY="your-key" npm start
```

The server will be available at `http://localhost:3000/mcp`.

## Quick Reference: Bible Version IDs

| Version | ID |
|---|---|
| KJV | `de4e12af7f28f599-02` |
| ASV | `06125adad2d5898a-01` |
| WEB | `9879dbb7cfe39e4d-04` |

Use `bible_list_versions` to discover all available versions.

## Verse/Passage ID Format

- **Verse**: `BOOK.CHAPTER.VERSE` → `JHN.3.16`, `GEN.1.1`, `ROM.8.28`
- **Passage range**: `BOOK.CH.V-BOOK.CH.V` → `ROM.8.28-ROM.8.39`
- **Full chapter**: `BOOK.CHAPTER` → `PSA.23`, `GEN.1`
- **Book codes**: Standard 3-letter abbreviations — `GEN`, `EXO`, `PSA`, `MAT`, `JHN`, `ROM`, `REV`, etc.

## Example Prompts

Once connected, you can ask Claude things like:

- "Pull up Romans 8:28-39 in the KJV"
- "Search for 'steadfast love' in the ASV"
- "What are the sections in the Gospel of Matthew?"
- "Show me Psalm 22 in full"
- "Compare John 1:1 across available translations"

## License

MIT — the scripture text itself is subject to publisher copyright terms as returned by API.Bible.
