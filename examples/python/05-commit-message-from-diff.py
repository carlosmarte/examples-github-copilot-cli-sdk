# 05 — Generate a commit message from staged changes
#
# Pipes `git diff --cached` into Copilot and asks for a Conventional-Commits
# style message. Stage some changes first (`git add -p`) before running.
#
# Run: python 05-commit-message-from-diff.py

import asyncio
import os
import shutil
import subprocess
import sys

from copilot import CopilotClient, SubprocessConfig
from copilot.generated.session_events import AssistantMessageData
from copilot.session import PermissionHandler


def resolve_copilot_cli() -> str:
    """Resolve the copilot CLI: PATH first, COPILOT_CLI_PATH env as fallback."""
    path = shutil.which("copilot")
    if path:
        return path
    env_path = os.environ.get("COPILOT_CLI_PATH")
    if env_path:
        return env_path
    raise RuntimeError(
        "Copilot CLI not found. Install @github/copilot globally or set COPILOT_CLI_PATH."
    )


async def main() -> None:
    result = subprocess.run(
        ["git", "diff", "--cached"],
        capture_output=True,
        text=True,
        check=True,
    )
    diff = result.stdout
    if not diff.strip():
        print("No staged changes. Run `git add` first.", file=sys.stderr)
        sys.exit(1)

    prompt = "\n".join([
        "Write a Conventional Commits message for the following staged diff.",
        "Format: <type>(<scope>): <subject> on the first line, blank line, then a short body.",
        "Keep the subject under 72 characters. Focus on the *why*, not the *what*.",
        "",
        "--- diff ---",
        diff,
    ])

    client = CopilotClient(SubprocessConfig(
        cli_path=resolve_copilot_cli(),
        cli_args=["--disable-builtin-mcps"],
    ))
    await client.start()
    try:
        session = await client.create_session(
            model="gpt-4.1",
            on_permission_request=PermissionHandler.approve_all,
        )
        reply = await session.send_and_wait(prompt)
        if reply and isinstance(reply.data, AssistantMessageData):
            print(reply.data.content)
    finally:
        await client.stop()


if __name__ == "__main__":
    asyncio.run(main())
