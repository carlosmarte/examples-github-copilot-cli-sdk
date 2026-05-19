# 01 — Hello world
#
# The smallest useful Copilot SDK program: open a client, create a session,
# send one prompt, print the answer, shut the client down.
#
# Run: python 01-hello-world.py

import asyncio
import os
import shutil

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
            on_permission_request=PermissionHandler.approve_all,
        )
        reply = await session.send_and_wait("What is 2 + 2?")
        if reply and isinstance(reply.data, AssistantMessageData):
            print(reply.data.content)
    finally:
        await client.stop()


if __name__ == "__main__":
    asyncio.run(main())
