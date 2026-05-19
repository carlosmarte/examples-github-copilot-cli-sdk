// 09 — Preflight a proxy before opening the Copilot client
//
// The SDK does not surface proxy errors clearly — a misconfigured HTTPS_PROXY
// usually shows up as a long timeout inside the underlying CLI subprocess.
// Detect the failure up front by parsing the proxy URL and opening a TCP
// connection to host:port. Only after the proxy answers do we instantiate
// CopilotClient. This shortens "why is it hanging" to a 3-second hard error.
//
// Run: node examples/simple-sdk/09-proxy-preflight.mjs

import { createRequire } from "node:module";
import net from "node:net";
import { CopilotClient, approveAll } from "@github/copilot-sdk";

const proxy = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
if (!proxy) {
  console.log("no HTTPS_PROXY set; assuming direct connection.");
} else {
  const { hostname, port } = new URL(proxy);
  const portNum = Number(port) || 8080;
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: hostname, port: portNum, timeout: 3000 });
    socket.once("connect", () => {
      socket.end();
      resolve();
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`proxy ${hostname}:${portNum} did not accept TCP within 3s`));
    });
    socket.once("error", reject);
  }).catch((err) => {
    console.error(`proxy preflight failed: ${err.message}`);
    process.exit(2);
  });
  console.log(`proxy ${hostname}:${portNum} reachable.`);
}

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
