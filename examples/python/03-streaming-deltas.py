# 03 — Streaming deltas
#
# Subscribe to session events so each AssistantMessageData chunk prints as it
# arrives. Events fire automatically during `send_and_wait()`, so no separate
# idle-await is needed in the common case.
#
# Run: python 03-streaming-deltas.py

import asyncio
import os
import shutil
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
    client = CopilotClient(SubprocessConfig(
        cli_path=resolve_copilot_cli(),
        cli_args=["--disable-builtin-mcps"],
    ))
    await client.start()
    try:
        session = await client.create_session(
            model="gpt-4.1",
            streaming=True,
            on_permission_request=PermissionHandler.approve_all,
        )

        def on_event(event) -> None:
            if isinstance(event.data, AssistantMessageData):
                sys.stdout.write(event.data.content or "")
                sys.stdout.flush()

        unsubscribe = session.on(on_event)
        try:
            await session.send_and_wait(
                "Write a haiku about Python's Global Interpreter Lock."
            )
        finally:
            unsubscribe()
        sys.stdout.write("\n")
    finally:
        await client.stop()


if __name__ == "__main__":
    asyncio.run(main())
