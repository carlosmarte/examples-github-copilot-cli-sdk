# FastAPI — Copilot SDK example

A FastAPI server that processes incoming HTTP requests through
`github-copilot-sdk`. Each request opens a session against the running
Copilot CLI, sends the prompt (default `"What is 2 + 2?"`), and returns the
assistant's text as JSON.

Sibling Node twins live in `../../nodejs/express/` and `../../nodejs/fastify/`.

## Prerequisites

- Python 3.11+
- GitHub Copilot CLI 1.0.17+, authenticated (`copilot auth status`)

## Install & run

With `uv` (recommended):

```sh
uv sync
uv run uvicorn server:app --port 3000
```

Or plain `pip`:

```sh
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --port 3000
```

## Try it

```sh
# Default prompt ("What is 2 + 2?")
curl -s localhost:3000/ask

# Custom prompt via JSON body
curl -s -X POST localhost:3000/ask \
  -H 'content-type: application/json' \
  -d '{"prompt":"What is 2 + 2?"}'

# Or via query string
curl -s 'localhost:3000/ask?prompt=What+is+2+%2B+2%3F'
```

Response shape:

```json
{ "prompt": "What is 2 + 2?", "answer": "4" }
```

## Configuration

| Env var          | Default   | Purpose                                       |
| ---------------- | --------- | --------------------------------------------- |
| `COPILOT_CLI_MODEL` | `gpt-5-mini` | Model passed to `client.create_session`     |
| `COPILOT_CLI_REASONING_EFFORT` | `low` | Reasoning effort (`low`/`medium`/`high`)    |

## Notes

- A single `CopilotClient` is started in the FastAPI `lifespan` and reused
  across requests; each request gets its own session.
- The lifespan's `finally` block calls `await client.stop()` so the CLI
  subprocess is not leaked — same shape as
  `../06-graceful-shutdown.py` and `../../nodejs/simple-sdk/06-graceful-shutdown.mjs`.
- The assistant text comes from `reply.data.content` when
  `isinstance(reply.data, AssistantMessageData)` — same extraction pattern
  as `../01-hello-world.py`.
- `PermissionHandler.approve_all` auto-approves any permission prompts the
  SDK emits — fine for examples, not for production.
