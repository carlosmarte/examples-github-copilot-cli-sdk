// 08 — URL-encode proxy password special characters
//
// Proxy passwords with @, :, #, /, or other reserved chars must be percent-
// encoded. Otherwise the URL parser splits in the wrong place — an unencoded
// `@` in the password ends the userinfo segment early, and the CLI ends up
// connecting to whatever string trails it as if it were the proxy host.
//
// This script takes raw user/pass from env vars, encodes them, builds the
// proxy URL, sanity-checks the parse, and exports it for the SDK to inherit.
//
// Run:
//   PROXY_USER="me" PROXY_PASS='p@ss:w#rd' \
//   PROXY_HOST="proxy.example.com" PROXY_PORT="8080" \
//   node examples/simple-sdk/08-url-encoded-credentials.mjs

import { createRequire } from "node:module";
import { CopilotClient, approveAll } from "@github/copilot-sdk";

const { PROXY_USER, PROXY_PASS, PROXY_HOST, PROXY_PORT = "8080" } = process.env;
if (!PROXY_USER || !PROXY_PASS || !PROXY_HOST) {
  console.error("set PROXY_USER, PROXY_PASS, PROXY_HOST (and optional PROXY_PORT)");
  process.exit(1);
}

const user = encodeURIComponent(PROXY_USER);
const pass = encodeURIComponent(PROXY_PASS);
const proxyUrl = `http://${user}:${pass}@${PROXY_HOST}:${PROXY_PORT}`;

// Sanity-check: parsed hostname must equal PROXY_HOST exactly. If a special
// character snuck through unencoded, URL splits the host and this check fails.
const parsed = new URL(proxyUrl);
if (parsed.hostname !== PROXY_HOST) {
  console.error(
    `proxy URL parse mismatch: expected host ${PROXY_HOST}, got ${parsed.hostname}.`,
  );
  console.error("a special character in the password is probably not URL-encoded.");
  process.exit(1);
}

process.env.HTTPS_PROXY = proxyUrl;
process.env.HTTP_PROXY = proxyUrl;

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

const response = await session.sendAndWait({ prompt: "Reply with OK." });
console.log(response?.data.content);

await client.stop();
process.exit(0);
