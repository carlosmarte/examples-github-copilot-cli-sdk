# 06 — Graceful shutdown
#
# `client.stop()` must run on success, on exception, and on SIGINT/SIGTERM,
# or the underlying Copilot CLI subprocess can be left alive. One idempotent
# `shutdown()` coroutine guards the three paths:
#   1. happy path: finally block awaits shutdown()
#   2. exception:  outer try/except prints and exits 1
#   3. signal:     asyncio signal handler schedules shutdown() + sys.exit(code)
#
# Run: python 06-graceful-shutdown.py

import asyncio
import os
import shutil
import signal
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
    stopping = False

    async def shutdown() -> None:
        nonlocal stopping
        if stopping:
            return
        stopping = True
        try:
            await client.stop()
        except Exception as err:
            print(f"client.stop() failed: {err}", file=sys.stderr)

    loop = asyncio.get_running_loop()
    sig_exit = {signal.SIGINT: 130, signal.SIGTERM: 143}

    def handle_signal(sig: signal.Signals) -> None:
        async def run() -> None:
            await shutdown()
            sys.exit(sig_exit[sig])
        asyncio.create_task(run())

    for s in sig_exit:
        loop.add_signal_handler(s, handle_signal, s)

    try:
        await client.start()
        session = await client.create_session(
            model="gpt-4.1",
            on_permission_request=PermissionHandler.approve_all,
        )
        reply = await session.send_and_wait(
            "Name three failure modes that show up only in long-running CLI subprocesses."
        )
        if reply and isinstance(reply.data, AssistantMessageData):
            print(reply.data.content)
    finally:
        await shutdown()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as err:
        print(f"session failed: {err}", file=sys.stderr)
        sys.exit(1)
