#!/usr/bin/env bash
# Few-shot — raw CLI
#
# The Copilot CLI does not accept inline `--agents '<json>'` like the Claude
# CLI does. Its equivalent is the `@<path>` syntax: any `@./relative/path.md`
# token inside a prompt is replaced at launch by the contents of that file.
# We use it to inject a markdown prompt file (`prompts/cleaner.md`) that
# carries the Input → Output examples — same outcome, file-based rather
# than JSON-arg-based.
#
# Pattern reference: CLI.md §3 "Few-Shot Prompting (Custom Personas via @file)".
#
# Run from this directory so the relative `@./prompts/cleaner.md` resolves:
#   ./run.sh
#   ./run.sh "try { fs.readFile(p); } catch(e) { console.log(e); }"
set -euo pipefail

# Disable any user-configured MCP servers so this example runs against the
# bare SDK/CLI surface only.
export COPILOT_DISABLE_MCP=1

cd "$(dirname "$0")"

SNIPPET="${1:-try { db.connect(); } catch(e) { console.log(e); }}"

PROMPT="@./prompts/cleaner.md

Snippet to rewrite:
$SNIPPET"

copilot --model "${COPILOT_CLI_MODEL:-gpt-5-mini}" -r "${COPILOT_CLI_REASONING_EFFORT:-low}" -p "$PROMPT" --allow-all-tools --disable-builtin-mcps
