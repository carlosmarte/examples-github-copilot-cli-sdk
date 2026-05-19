// 11 — Pull proxy credentials from the macOS Keychain
//
// Storing a proxy password in plaintext shell rc files is a well-known
// footgun: it ends up in dotfile backups, screen-shares, and accidental
// commits. On macOS, store it once in the user's login Keychain and read it
// at runtime. If no Keychain entry exists, prompt for username + password
// and add it (the password input is masked).
//
// Service:  copilot-sdk-proxy
// Account:  <PROXY_HOST>
// Secret:   "<user>\n<password>"  (one entry holds both fields)
//
// Run:
//   PROXY_HOST=proxy.example.com PROXY_PORT=8080 \
//     node examples/simple-sdk/11-keychain-proxy-creds.mjs
//
// To clear:
//   security delete-generic-password -s copilot-sdk-proxy -a proxy.example.com

import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import readline from "node:readline";
import { Writable } from "node:stream";
import { CopilotClient, approveAll } from "@github/copilot-sdk";

if (process.platform !== "darwin") {
  console.error("this example uses macOS Keychain (`security`); not portable.");
  process.exit(1);
}

const { PROXY_HOST, PROXY_PORT = "8080" } = process.env;
if (!PROXY_HOST) {
  console.error("set PROXY_HOST (and optional PROXY_PORT).");
  process.exit(1);
}

const SERVICE = "copilot-sdk-proxy";

function readKeychain(account) {
  const r = spawnSync(
    "security",
    ["find-generic-password", "-s", SERVICE, "-a", account, "-w"],
    { encoding: "utf8" },
  );
  if (r.status !== 0) return null;
  return r.stdout.replace(/\n$/, "");
}

function writeKeychain(account, secret) {
  // -U updates an existing entry instead of failing with "already exists".
  execFileSync("security", [
    "add-generic-password",
    "-U",
    "-s", SERVICE,
    "-a", account,
    "-w", secret,
  ]);
}

async function ask(label, { mask = false } = {}) {
  // Suppress echo when reading the password by piping output to a sink stream.
  const out = mask
    ? new Writable({ write(_chunk, _enc, cb) { cb(); } })
    : process.stdout;
  const rl = readline.createInterface({ input: process.stdin, output: out, terminal: true });
  process.stdout.write(label);
  const answer = await new Promise((resolve) => rl.question("", resolve));
  rl.close();
  if (mask) process.stdout.write("\n");
  return answer.trim();
}

async function getCreds() {
  const stored = readKeychain(PROXY_HOST);
  if (stored) {
    const newline = stored.indexOf("\n");
    if (newline === -1) {
      console.error(`Keychain entry for ${PROXY_HOST} is malformed; delete and re-run.`);
      process.exit(1);
    }
    return { user: stored.slice(0, newline), pass: stored.slice(newline + 1) };
  }
  console.log(`no Keychain entry for ${SERVICE}/${PROXY_HOST}; prompting once.`);
  const user = await ask(`proxy username for ${PROXY_HOST}: `);
  const pass = await ask(`proxy password for ${PROXY_HOST}: `, { mask: true });
  if (!user || !pass) {
    console.error("username and password are both required.");
    process.exit(1);
  }
  writeKeychain(PROXY_HOST, `${user}\n${pass}`);
  console.log("stored in login Keychain.");
  return { user, pass };
}

const { user, pass } = await getCreds();
const proxyUrl =
  `http://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${PROXY_HOST}:${PROXY_PORT}`;
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
