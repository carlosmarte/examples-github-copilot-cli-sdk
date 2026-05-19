// 04 — Explain a code file
//
// Read a file from disk and ask Copilot for a plain-English explanation.
//
// Run: node examples/04-explain-code-file.mjs <path-to-source-file>
// e.g. node examples/04-explain-code-file.mjs examples/01-hello-world.mjs

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { CopilotClient, approveAll } from "@github/copilot-sdk";

const target = process.argv[2];
if (!target) {
  console.error("usage: node examples/04-explain-code-file.mjs <file>");
  process.exit(1);
}

const source = await readFile(target, "utf8");

// Resolve the @github/copilot CLI relative to this script first, fall back to
// the COPILOT_CLI_PATH env var. `--disable-builtin-mcps` keeps the example on
// the bare SDK surface; the env var COPILOT_DISABLE_MCP is not honored.
function resolveCopilotCli() {
  try {
    return createRequire(import.meta.url).resolve("@github/copilot");
  } catch {
    if (process.env.COPILOT_CLI_PATH) return process.env.COPILOT_CLI_PATH;
    throw new Error("Copilot CLI not found. Run `npm install` or set COPILOT_CLI_PATH.");
  }
}

const client = new CopilotClient({
  cliPath: resolveCopilotCli(),
  cliArgs: ["--disable-builtin-mcps"],
});
const session = await client.createSession({
  model: "gpt-4.1",
  onPermissionRequest: approveAll,
});

const prompt = [
  `Explain what this file does in 4-6 bullet points.`,
  `Call out anything subtle (race conditions, hidden side effects, error swallowing).`,
  ``,
  `--- ${target} ---`,
  source,
].join("\n");

const response = await session.sendAndWait({ prompt });
console.log(response?.data.content);

await client.stop();
process.exit(0);
