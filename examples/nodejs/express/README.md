# ExpressJS — Copilot SDK example

An ExpressJS server that processes incoming HTTP requests through
`@github/copilot-sdk`. Each request opens a session against the running
Copilot CLI, sends the prompt (default `"What is 2 + 2?"`), and returns the
assistant's text as JSON.

## Prerequisites

- Node.js 20+
- GitHub Copilot CLI 1.0.17+, authenticated (`copilot auth status`)

## Install & run

```sh
npm install
node server.mjs
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

| Env var          | Default   | Purpose                                |
| ---------------- | --------- | -------------------------------------- |
| `PORT`           | `3000`    | HTTP port to listen on                 |
| `COPILOT_CLI_MODEL` | `gpt-5-mini` | Model passed to `client.createSession` |
| `COPILOT_CLI_REASONING_EFFORT` | `low` | Reasoning effort (`low`/`medium`/`high`) |

## Notes

- A single `CopilotClient` is shared across requests; each request gets its
  own session.
- `client.stop()` runs on `SIGINT`/`SIGTERM` so the underlying CLI subprocess
  is not leaked. Mirrors `../simple-sdk/06-graceful-shutdown.mjs`.
- The assistant text comes from `response.data.content` — same extraction
  pattern as `../simple-sdk/01-hello-world.mjs`.
