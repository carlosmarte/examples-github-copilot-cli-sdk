// Start-up instructions — Node ESM driver for the `copilot` CLI
//
// Inject behavioral rules at launch by prepending `@./instructions.md` to
// the prompt — the CLI swaps the `@<path>` token for that file's contents
// before invoking the model. This is the Copilot analog of Claude's
// `--append-system-prompt`. Pattern reference: CLI.md §2.
//
// (Repo-wide alternative: drop the same rules into `.github/copilot-instructions.md`
// at the repo root — Copilot auto-loads it on every launch.)
//
// Run from this directory so the relative `@./instructions.md` resolves:
//   node run.mjs
//   node run.mjs "Describe HTTP PATCH"

import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Disable any user-configured MCP servers so this example runs against the
// bare SDK/CLI surface only.
process.env.COPILOT_DISABLE_MCP = "1";

process.chdir(dirname(fileURLToPath(import.meta.url)));

const userPrompt = process.argv[2] ?? "Describe the HTTP DELETE method.";

const prompt = `@./instructions.md\n\n${userPrompt}`;

const child = spawn(
  "copilot",
  ["--model", process.env.COPILOT_CLI_MODEL || "gpt-5-mini", "-r", process.env.COPILOT_CLI_REASONING_EFFORT || "low", "-p", prompt, "--allow-all-tools", "--disable-builtin-mcps"],
  { stdio: "inherit" },
);

child.on("error", (err) => {
  console.error(`failed to spawn copilot: ${err.message}`);
  process.exit(127);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
