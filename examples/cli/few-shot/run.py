#!/usr/bin/env python3
"""Few-shot — Python driver for the `copilot` CLI.

The Copilot CLI does not accept inline `--agents '<json>'`; instead, an
`@<path>` token inside the prompt is replaced at launch by the contents of
that file. We inject `prompts/cleaner.md` (Input → Output examples) and
append the user snippet beneath it. Pattern reference: CLI.md §3.

Run from this directory so the relative `@./prompts/cleaner.md` resolves:
    python3 run.py
    python3 run.py "try { fs.readFile(p); } catch(e) { console.log(e); }"
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

# Disable any user-configured MCP servers so this example runs against the
# bare SDK/CLI surface only.
os.environ["COPILOT_DISABLE_MCP"] = "1"


DEFAULT_SNIPPET = "try { db.connect(); } catch(e) { console.log(e); }"


def main() -> int:
    if shutil.which("copilot") is None:
        print("`copilot` CLI not found on PATH", file=sys.stderr)
        return 127

    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    snippet = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SNIPPET
    prompt = "\n".join([
        "@./prompts/cleaner.md",
        "",
        "Snippet to rewrite:",
        snippet,
    ])

    return subprocess.run([
        "copilot",
        "--model", os.environ.get("COPILOT_CLI_MODEL", "gpt-5-mini"), "-r", os.environ.get("COPILOT_CLI_REASONING_EFFORT", "low"), "-p", prompt,
        "--allow-all-tools",
        "--disable-builtin-mcps",
    ]).returncode


if __name__ == "__main__":
    sys.exit(main())
