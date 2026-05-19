// 01 — Hello world
//
// The smallest useful Copilot SDK program: open a client, create a session,
// send one prompt, print the answer, shut the client down.
//
// Run: node examples/01-hello-world.mjs

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

const response = await session.sendAndWait({ prompt: "What is 2 + 2?" });
console.log(response?.data.content);

await client.stop();
process.exit(0);
