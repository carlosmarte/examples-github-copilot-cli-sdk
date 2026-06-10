#!/usr/bin/env bash
# One-shot — raw CLI
#
# The smallest useful invocation: hand Copilot a prompt with `-p` /
# `--prompt`, let it run to completion, emit the result on stdout, and exit.
# No interactive UI, no session state retained between runs. Mirrors
# examples/nodejs/simple-sdk/01-hello-world.mjs but drives the `copilot`
# subprocess instead of the in-process SDK.
#
# Pattern reference: CLI.md §1 "One-Shot Executions (Programmatic Mode)".
#
# Run:
#   ./run.sh
#   ./run.sh "Summarize the last 5 git commits as a markdown list"
set -euo pipefail

# Disable any user-configured MCP servers so this example runs against the
# bare SDK/CLI surface only.
export COPILOT_DISABLE_MCP=1

PROMPT="${1:-What is 2 + 2? Reply with only the digit.}"

# `--allow-all-tools` (alias `--yolo`) auto-approves any tool the model wants
# to invoke — drop it if you want interactive permission prompts.
# `--disable-builtin-mcps` ensures the CLI's bundled MCP servers stay off.
copilot --model "${COPILOT_CLI_MODEL:-gpt-5-mini}" -r "${COPILOT_CLI_REASONING_EFFORT:-low}" -p "$PROMPT" --allow-all-tools --disable-builtin-mcps
