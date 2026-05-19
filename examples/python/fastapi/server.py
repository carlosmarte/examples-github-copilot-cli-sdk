# FastAPI — Copilot SDK request handler
#
# Boots a single CopilotClient at startup, then for each incoming request opens
# a fresh session, forwards the request body's `prompt` (default: "What is 2 + 2?"),
# extracts the assistant's text from `reply.data.content`, and returns it as JSON.
#
# Run:
#   uv sync   (or: pip install -r requirements.txt)
#   uvicorn server:app --port 3000
#
# Try:
#   curl -s localhost:3000/ask
#   curl -s -X POST localhost:3000/ask \
#        -H 'content-type: application/json' \
#        -d '{"prompt":"What is 2 + 2?"}'

import os
import shutil
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

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


MODEL = os.environ.get("COPILOT_MODEL", "gpt-4.1")
DEFAULT_PROMPT = "What is 2 + 2?"


class AskRequest(BaseModel):
    prompt: Optional[str] = None


class AskResponse(BaseModel):
    prompt: str
    answer: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    client = CopilotClient(SubprocessConfig(
        cli_path=resolve_copilot_cli(),
        cli_args=["--disable-builtin-mcps"],
    ))
    await client.start()
    app.state.copilot = client
    try:
        yield
    finally:
        await client.stop()


app = FastAPI(lifespan=lifespan)


async def ask(client: CopilotClient, prompt: str) -> str:
    session = await client.create_session(
        model=MODEL,
        on_permission_request=PermissionHandler.approve_all,
    )
    reply = await session.send_and_wait(prompt)
    if reply and isinstance(reply.data, AssistantMessageData):
        return reply.data.content
    return ""


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "model": MODEL}


@app.get("/ask", response_model=AskResponse)
async def ask_get(prompt: Optional[str] = None) -> AskResponse:
    chosen = prompt or DEFAULT_PROMPT
    try:
        answer = await ask(app.state.copilot, chosen)
    except Exception as err:  # noqa: BLE001 — surface CLI/SDK failures as 500
        raise HTTPException(status_code=500, detail=f"copilot_failed: {err}") from err
    return AskResponse(prompt=chosen, answer=answer)


@app.post("/ask", response_model=AskResponse)
async def ask_post(req: AskRequest) -> AskResponse:
    chosen = req.prompt or DEFAULT_PROMPT
    try:
        answer = await ask(app.state.copilot, chosen)
    except Exception as err:  # noqa: BLE001 — surface CLI/SDK failures as 500
        raise HTTPException(status_code=500, detail=f"copilot_failed: {err}") from err
    return AskResponse(prompt=chosen, answer=answer)
