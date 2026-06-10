#!/usr/bin/env bash
# Start-up instructions — raw CLI
#
# Inject behavioral rules at launch by referencing an instructions file
# inside the prompt with the `@<path>` syntax. The CLI replaces `@./file.md`
# with that file's contents before sending the prompt to the model, which is
# the Copilot equivalent of Claude's `--append-system-prompt`.
#
# (Repo-wide alternative: drop the same rules into `.github/copilot-instructions.md`
# at the repo root — the CLI auto-loads it on every launch. See CLI.md §2.)
#
# Pattern reference: CLI.md §2 "Providing Instructions at Startup".
#
# Run from this directory so the relative `@./instructions.md` resolves:
#   ./run.sh
#   ./run.sh "Describe HTTP PATCH"
set -euo pipefail

# Disable any user-configured MCP servers so this example runs against the
# bare SDK/CLI surface only.
export COPILOT_DISABLE_MCP=1

cd "$(dirname "$0")"

USER_PROMPT="${1:-Describe the HTTP DELETE method.}"

PROMPT="@./instructions.md

$USER_PROMPT"

copilot --model "${COPILOT_CLI_MODEL:-gpt-5-mini}" -r "${COPILOT_CLI_REASONING_EFFORT:-low}" -p "$PROMPT" --allow-all-tools --disable-builtin-mcps
