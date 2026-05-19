// 03 — Streaming deltas
//
// Set `streaming: true` on the session and subscribe to `assistant.message_delta`
// to print chunks as they arrive. `session.idle` fires when the response is
// complete and the session is ready for the next prompt.
//
// Run: node examples/03-streaming-deltas.mjs

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
  streaming: true,
  onPermissionRequest: approveAll,
});

const offDelta = session.on("assistant.message_delta", (event) => {
  process.stdout.write(event?.data?.content ?? "");
});

const idle = new Promise((resolve) => {
  const offIdle = session.on("session.idle", () => {
    offIdle();
    resolve();
  });
});

await session.sendAndWait({
  prompt: "Write a haiku about garbage collection in JavaScript.",
});
await idle;

offDelta();
process.stdout.write("\n");

await client.stop();
process.exit(0);
