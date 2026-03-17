/**
 * Run all data ingestion scripts. Called with --rebuild-db flag or on first run.
 */

import { initializeDb } from "../src/services/db.js";
import { ingestCrossReferences } from "./ingest-cross-refs.js";
import { ingestLexicons } from "./ingest-lexicon.js";

initializeDb();
console.log("Database initialized.");

ingestCrossReferences();
ingestLexicons();

console.log("\nAll data ingestion complete.");
