# GitHub Copilot SDK

GitHub's **`@github/copilot-sdk`** is the developer library that wraps the
agentic GitHub Copilot CLI in a programmatic API — you create a client,
open sessions, send prompts, and (optionally) subscribe to streaming
events, without spawning the binary or parsing its stdout yourself.

Reference: <https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started>

---

## SDK Availability

| Language          | Package                              |
| ----------------- | ------------------------------------ |
| TypeScript / Node | `@github/copilot-sdk`                |

> Today the SDK ships a Node-only client. Other host languages reach Copilot
> via the [CLI subprocess pattern](examples/cli/) — same workflows, just
> shelling out to `copilot -p "<prompt>"` rather than importing the SDK.

### Install

```bash
npm install @github/copilot-sdk
```

The SDK shells out to the **Copilot CLI** at runtime, so the binary must be
installed and authenticated separately:

```bash
# Install per GitHub docs (https://docs.github.com/copilot/github-copilot-in-the-cli)
copilot --version

# The SDK picks up your existing gh auth, or a COPILOT_GITHUB_TOKEN if set.
```

### Authentication

The SDK uses whatever auth the CLI uses. Two common setups:

```bash
# 1. Inherit from `gh` (most common — already signed in for normal repo work)
gh auth status

# 2. Explicit PAT (CI, headless, or service-account scenarios)
export COPILOT_GITHUB_TOKEN=ghp_...
```

> The PAT needs Copilot access on the target account / org.

---

## Core Surface

Three small primitives cover the entire documented surface:

| API                                | When to use                                                   | Returns                            |
| ---------------------------------- | ------------------------------------------------------------- | ---------------------------------- |
| `new CopilotClient()`              | Construct the client (spawns the CLI subprocess lazily)       | `CopilotClient`                    |
| `client.createSession({ model, streaming? })` | Open a session — one logical conversation              | `Session`                          |
| `session.sendAndWait({ prompt })`  | Send a prompt and await the full response                      | `{ data: { content: string } }`    |
| `session.on(event, handler)`       | Subscribe to streaming events (returns unsubscribe fn)         | `() => void`                       |
| `client.stop()`                    | Close the underlying CLI subprocess                            | `Promise<void>`                    |

Two events you'll subscribe to in practice:

| Event                       | Fired when                                                         |
| --------------------------- | ------------------------------------------------------------------ |
| `assistant.message_delta`   | Each streaming chunk of the assistant's response                   |
| `session.idle`              | The current response is complete; the session is ready for the next prompt |

### Session options

| Field        | Purpose                                                                   |
| ------------ | ------------------------------------------------------------------------- |
| `model`      | Model id (e.g. `"gpt-4.1"`, `"gpt-5"`, `"claude-sonnet"`)                  |
| `reasoningEffort` | Reasoning depth for thinking models: `"low"` (default) / `"medium"` / `"high"` |
| `streaming`  | `true` → emit `assistant.message_delta` events; `false`/omitted → buffered only |

### Lifecycle invariant

`client.stop()` must always run — on success, on throw, and on SIGINT /
SIGTERM — or the underlying `copilot` subprocess can be left alive. The
canonical shape is `try { … } finally { await client.stop(); }` plus signal
hooks; see [example 06](#06--graceful-shutdown--signal-handling).

---

## Programmatic Integration Examples

Each example is a self-contained `.mjs` file under
[`examples/nodejs/simple-sdk/`](examples/nodejs/simple-sdk/).

### 01 — Hello world

The smallest useful program: open a client, create a session, send one
prompt, print the answer, shut the client down.

```typescript
import { CopilotClient } from "@github/copilot-sdk";

const client = new CopilotClient();
const session = await client.createSession({ model: "gpt-4.1" });

const response = await session.sendAndWait({ prompt: "What is 2 + 2?" });
console.log(response?.data.content);

await client.stop();
```

### 02 — Multi-turn conversation

One session, several sequential prompts. The session retains earlier turns
as context, so later prompts can refer back.

```typescript
import { CopilotClient } from "@github/copilot-sdk";

const client = new CopilotClient();
const session = await client.createSession({ model: "gpt-4.1" });

const turns = [
  "Give me a one-line description of the Fibonacci sequence.",
  "Now write a JavaScript function that returns the nth Fibonacci number.",
  "Add a memoized version below the first one.",
];

for (const prompt of turns) {
  const response = await session.sendAndWait({ prompt });
  console.log(response?.data.content);
}

await client.stop();
```

### 03 — Streaming deltas

Set `streaming: true` on the session and subscribe to `assistant.message_delta`
to print chunks as they arrive. `session.idle` fires when the response is
complete.

```typescript
import { CopilotClient } from "@github/copilot-sdk";

const client = new CopilotClient();
const session = await client.createSession({ model: "gpt-4.1", streaming: true });

const offDelta = session.on("assistant.message_delta", (event) => {
  process.stdout.write(event?.data?.content ?? "");
});

const idle = new Promise((resolve) => {
  const offIdle = session.on("session.idle", () => { offIdle(); resolve(); });
});

await session.sendAndWait({ prompt: "Write a haiku about garbage collection." });
await idle;

offDelta();
await client.stop();
```

> `assistant.message_delta` and `session.idle` are the only two events the
> Getting Started guide commits to. Don't rely on undocumented event names.

### 04 — Explain a code file

Read a file off disk and embed its contents in the prompt — the SDK has no
built-in `Read` tool; you supply the bytes yourself.

```typescript
import { readFile } from "node:fs/promises";
import { CopilotClient } from "@github/copilot-sdk";

const target = process.argv[2];
if (!target) {
  console.error("usage: node 04-explain.mjs <file>");
  process.exit(1);
}

const source = await readFile(target, "utf8");

const client = new CopilotClient();
const session = await client.createSession({ model: "gpt-4.1" });

const prompt = [
  `Explain what this file does in 4-6 bullet points.`,
  `Call out anything subtle (race conditions, hidden side effects, error swallowing).`,
  ``,
  `--- ${target} ---`,
  source,
].join("\n");

const response = await session.sendAndWait({ prompt });
console.log(response?.data.content);

await client.stop();
```

### 05 — Commit message from staged diff

Pipe `git diff --cached` into Copilot and ask for a Conventional Commits
message. Stage some changes first (`git add -p`).

```typescript
import { execSync } from "node:child_process";
import { CopilotClient } from "@github/copilot-sdk";

const diff = execSync("git diff --cached", { encoding: "utf8" });
if (!diff.trim()) { console.error("No staged changes."); process.exit(1); }

const client = new CopilotClient();
const session = await client.createSession({ model: "gpt-4.1" });

const prompt = [
  `Write a Conventional Commits message for the following staged diff.`,
  `Format: <type>(<scope>): <subject> on the first line, blank line, then short body.`,
  `Keep the subject under 72 characters. Focus on the *why*, not the *what*.`,
  ``,
  `--- diff ---`,
  diff,
].join("\n");

const response = await session.sendAndWait({ prompt });
console.log(response?.data.content);

await client.stop();
```

### 06 — Graceful shutdown & signal handling

`client.stop()` must run on success, on throw, and on SIGINT / SIGTERM.

```typescript
import { CopilotClient } from "@github/copilot-sdk";

const client = new CopilotClient();

const shutdown = async (code = 0) => {
  try { await client.stop(); }
  catch (err) { console.error("client.stop() failed:", err); }
  process.exit(code);
};

process.on("SIGINT",  () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

try {
  const session = await client.createSession({ model: "gpt-4.1" });
  const response = await session.sendAndWait({
    prompt: "Name three failure modes that show up only in long-running CLI subprocesses.",
  });
  console.log(response?.data.content);
} catch (err) {
  console.error("session failed:", err);
  await shutdown(1);
}

await shutdown(0);
```

### 07-11 — Proxy authentication

`copilot` (and the SDK that wraps it) reads the standard `HTTPS_PROXY` /
`HTTP_PROXY` env vars but does **not** have a built-in `copilot proxy login`
command — credentials must be embedded in the URL.

Each example passes the proxy to the spawned runtime through `CopilotClient`'s
`env` option — **not** by assigning `process.env.HTTPS_PROXY` in the parent
process. Mutating the global env would silently route *every* HTTP client in
the Node process through the proxy; the `env` option keeps the proxy scoped to
the Copilot child process only:

```typescript
const proxy = "http://user:pass@proxy.example.com:8080";
const client = new CopilotClient({
  // proxy reaches only this spawned runtime, not the rest of the process
  env: { ...process.env, HTTPS_PROXY: proxy, HTTP_PROXY: proxy },
});
```

The [`examples/nodejs/simple-sdk/`](examples/nodejs/simple-sdk/) directory ships
five worked configurations:

| # | Script                                | What it shows                                                                 |
| - | ------------------------------------- | ----------------------------------------------------------------------------- |
| 7 | `07-https-proxy.mjs`                  | Read `HTTPS_PROXY` with embedded `user:pass`; pass it via the client `env` option |
| 8 | `08-url-encoded-credentials.mjs`      | URL-encode passwords containing `@`, `:`, `#`, `/`; sanity-check the parse    |
| 9 | `09-proxy-preflight.mjs`              | TCP-probe the proxy with a 3s timeout before opening the SDK                  |
| 10 | `10-fail-fast-no-proxy-creds.mjs`     | When `REQUIRE_PROXY=1`, refuse to start unless the URL contains user:pass     |
| 11 | `11-keychain-proxy-creds.mjs`         | macOS only: read proxy creds from the login Keychain (service `copilot-sdk-proxy`) |

> **Security note.** Embedding `user:password` in a proxy URL exposes the
> password as plain text in the *child* process's environment. Anything that
> can read `/proc/<pid>/environ` (Linux) or list env vars for that process can
> see it. Scoping it via the client `env` option (rather than the parent's
> `process.env`) limits the blast radius to the one spawned runtime. Example 11
> additionally keeps the secret in the Keychain — recommended for any host
> where untrusted processes might run as your user.

---

## Model Selection

The SDK takes `model` per `createSession()` call:

```typescript
const session = await client.createSession({ model: "claude-sonnet" });
```

Or fall back to the CLI-level default by omitting the field. The CLI's
default is set by:

1. `COPILOT_MODEL` env var (best for scripts / CI)
2. The last `/model <name>` slash command run in an interactive session
3. Your org / account default in the GitHub settings

So you can leave `model` off in code and switch behavior per-invocation:

```bash
COPILOT_MODEL=gpt-5-mini node 01-hello-world.mjs
```

See [`CLI.md` §5](CLI.md#5-model-selection) for the full precedence chain.

---

## Comparison: SDK vs CLI subprocess

```typescript
// SDK — you stay in-process
const client = new CopilotClient();
const session = await client.createSession({ model: "gpt-4.1" });
const r = await session.sendAndWait({ prompt: "What is 2 + 2?" });
console.log(r?.data.content);
await client.stop();

// CLI — you shell out and parse stdout
import { spawn } from "node:child_process";
spawn("copilot", ["-p", "What is 2 + 2?", "--allow-all-tools"], { stdio: "inherit" });
```

Reach for the **SDK** when:

- You want typed responses and structured streaming events.
- You're already in a Node service and want the session held open across
  several prompts without forking subprocesses each time.
- You want to subscribe to deltas and react before the full reply is in.

Reach for the **CLI** ([`examples/cli/`](examples/cli/)) when:

- Your host language isn't Node (Go, Java, Python, Rust, shell).
- You want to lean on Copilot's built-in tool dispatch, plan mode, and
  `@file` injection without re-implementing them.
- You're orchestrating from a shell script or CI step where a one-line
  `copilot -p "..."` is simpler than any client object.

---

## Filesystem Configuration

When the CLI starts (whether driven by the SDK or invoked directly), it
auto-loads from the working directory and its repo root:

| Feature                            | Location                                |
| ---------------------------------- | --------------------------------------- |
| Repo-wide instructions / guardrails | `.github/copilot-instructions.md`       |
| Named custom personas               | `AGENTS.md` (repo root)                 |
| Ad-hoc one-run prompt files         | Anywhere — inject with `@./path.md`     |

These work the same whether you call `client.createSession(...)` in Node or
`copilot -p "..."` from a shell — the CLI is the source of truth for
context discovery.

---

## When to Reach For It

- You need Copilot's agent loop, tool dispatch, plan mode, and `@file`
  injection embedded inside a Node service.
- You want streaming deltas surfaced as proper events rather than parsed
  out of stdout.
- You're orchestrating multi-turn conversations where session continuity
  matters and you'd rather not respawn the CLI every prompt.
- You need a clean place to hang lifecycle invariants (try/finally,
  signal handlers) around the underlying subprocess.
