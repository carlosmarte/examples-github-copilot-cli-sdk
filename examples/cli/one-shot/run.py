#!/usr/bin/env python3
"""One-shot — Python driver for the `copilot` CLI.

Shells out to `copilot -p "<prompt>" --allow-all-tools`, inherits stdio so the
result streams straight to the parent terminal, and propagates the exit code.
Python counterpart of examples/nodejs/simple-sdk/01-hello-world.mjs driving
the CLI subprocess instead of the in-process SDK.

Pattern reference: CLI.md §1.

Run:
    python3 run.py
    python3 run.py "Summarize the last 5 git commits as a markdown list"
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

# Disable any user-configured MCP servers so this example runs against the
# bare SDK/CLI surface only.
os.environ["COPILOT_DISABLE_MCP"] = "1"


def main() -> int:
    if shutil.which("copilot") is None:
        print("`copilot` CLI not found on PATH", file=sys.stderr)
        return 127

    prompt = sys.argv[1] if len(sys.argv) > 1 else "What is 2 + 2? Reply with only the digit."
    return subprocess.run(
        ["copilot", "--model", os.environ.get("COPILOT_CLI_MODEL", "gpt-5-mini"), "-r", os.environ.get("COPILOT_CLI_REASONING_EFFORT", "low"), "-p", prompt, "--allow-all-tools", "--disable-builtin-mcps"]
    ).returncode


if __name__ == "__main__":
    sys.exit(main())
