// 05 — Generate a commit message from staged changes
//
// Pipes `git diff --cached` into Copilot and asks for a Conventional-Commits
// style message. Stage some changes first (`git add -p`) before running.
//
// Run: node examples/05-commit-message-from-diff.mjs

import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { CopilotClient, approveAll } from "@github/copilot-sdk";

const diff = execSync("git diff --cached", { encoding: "utf8" });
if (!diff.trim()) {
  console.error("No staged changes. Run `git add` first.");
  process.exit(1);
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

const prompt = [
  `Write a Conventional Commits message for the following staged diff.`,
  `Format: <type>(<scope>): <subject> on the first line, blank line, then a short body.`,
  `Keep the subject under 72 characters. Focus on the *why*, not the *what*.`,
  ``,
  `--- diff ---`,
  diff,
].join("\n");

const response = await session.sendAndWait({ prompt });
console.log(response?.data.content);

await client.stop();
process.exit(0);
