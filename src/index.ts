import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { registerBibleTools } from "./tools/bible-tools.js";
import { registerPatristicsTools } from "./tools/patristics-tools.js";
import { registerNltTools } from "./tools/nlt-tools.js";
import { registerLectionaryTools } from "./tools/lectionary-tools.js";
import { registerPhase2Tools } from "./tools/phase2-tools.js";

// ─── Initialize MCP server ───
const server = new McpServer({
  name: "bible-mcp-server",
  version: "1.1.0",
});

// Register all tools
registerBibleTools(server);
registerPatristicsTools(server);
registerNltTools(server);
registerLectionaryTools(server);
registerPhase2Tools(server);

// ─── Transport: stdio (default) or HTTP ───

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Bible MCP server running on stdio");
}

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Optional bearer token auth — set MCP_AUTH_TOKEN to protect the endpoint
  const authToken = process.env.MCP_AUTH_TOKEN;
  if (authToken) {
    app.use("/mcp", (req, res, next) => {
      const header = req.headers.authorization;
      if (!header || header !== `Bearer ${authToken}`) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      next();
    });
    console.error("MCP endpoint protected with bearer token auth");
  }

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // Health check (no auth required)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "bible-mcp-server", version: "1.1.0", tools: 15 });
  });

  const port = parseInt(process.env.PORT || "3000");
  app.listen(port, () => {
    console.error(`Bible MCP server running on http://localhost:${port}/mcp`);
  });
}

// Choose transport based on environment
const transport = process.env.TRANSPORT || "stdio";
if (transport === "http") {
  runHTTP().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
