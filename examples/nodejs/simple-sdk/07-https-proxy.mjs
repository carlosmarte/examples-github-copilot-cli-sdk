// 07 — Route through an authenticated HTTPS proxy
//
// `gh copilot` has no proxy-login command and will not prompt. The SDK shells
// out to the Copilot CLI, which reads HTTPS_PROXY / HTTP_PROXY from the
// environment exactly like `gh` does. To authenticate, embed user:password in
// the URL itself before opening the client.
//
// Run:
//   export HTTPS_PROXY="http://user:pass@proxy.example.com:8080"
//   export HTTP_PROXY="http://user:pass@proxy.example.com:8080"
//   node examples/simple-sdk/07-https-proxy.mjs

import { createRequire } from "node:module";
import { CopilotClient, approveAll } from "@github/copilot-sdk";

const proxy = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
if (!proxy) {
  console.error("HTTPS_PROXY (or HTTP_PROXY) is not set.");
  console.error('export HTTPS_PROXY="http://user:pass@proxy.example.com:8080"');
  process.exit(1);
}

const { hostname, port } = new URL(proxy);
console.log(`routing Copilot CLI traffic through ${hostname}:${port}`);

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

const response = await session.sendAndWait({
  prompt: "Confirm you are reachable. Reply with the single word OK.",
});
console.log(response?.data.content);

await client.stop();
process.exit(0);
