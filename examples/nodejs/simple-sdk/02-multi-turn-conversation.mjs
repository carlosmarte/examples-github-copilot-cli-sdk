// 02 — Multi-turn conversation
//
// One session, multiple sequential prompts. The session keeps prior turns as
// context, so the second prompt can refer to the first answer.
//
// Run: node examples/02-multi-turn-conversation.mjs

import { createRequire } from "node:module";
import { CopilotClient, approveAll } from "@github/copilot-sdk";

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

const turns = [
  "Give me a one-line description of the Fibonacci sequence.",
  "Now write a JavaScript function that returns the nth Fibonacci number.",
  "Add a memoized version below the first one.",
];

for (const prompt of turns) {
  console.log(`\n>>> ${prompt}\n`);
  const response = await session.sendAndWait({ prompt });
  console.log(response?.data.content);
}

await client.stop();
process.exit(0);
