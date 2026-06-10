#!/usr/bin/env python3
"""Start-up instructions — Python driver for the `copilot` CLI.

Inject behavioral rules at launch by prepending `@./instructions.md` to the
prompt — the CLI swaps the `@<path>` token for that file's contents before
invoking the model. This is the Copilot analog of Claude's
`--append-system-prompt`.

(Repo-wide alternative: drop the same rules into
`.github/copilot-instructions.md` at the repo root — Copilot auto-loads it
on every launch.)

Pattern reference: CLI.md §2.

Run from this directory so the relative `@./instructions.md` resolves:
    python3 run.py
    python3 run.py "Describe HTTP PATCH"
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

# Disable any user-configured MCP servers so this example runs against the
# bare SDK/CLI surface only.
os.environ["COPILOT_DISABLE_MCP"] = "1"


DEFAULT_PROMPT = "Describe the HTTP DELETE method."


def main() -> int:
    if shutil.which("copilot") is None:
        print("`copilot` CLI not found on PATH", file=sys.stderr)
        return 127

    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    user_prompt = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PROMPT
    prompt = f"@./instructions.md\n\n{user_prompt}"

    return subprocess.run([
        "copilot",
        "--model", os.environ.get("COPILOT_CLI_MODEL", "gpt-5-mini"), "-r", os.environ.get("COPILOT_CLI_REASONING_EFFORT", "low"), "-p", prompt,
        "--allow-all-tools",
        "--disable-builtin-mcps",
    ]).returncode


if __name__ == "__main__":
    sys.exit(main())
