# `examples/cli/` — Driving the `copilot` CLI from six host languages

CLI-driven counterparts of the SDK examples in [`../nodejs/`](../nodejs/).
Where `examples/nodejs/` imports `@github/copilot-sdk` and drives Copilot
**in-process**, this directory shells out to the `copilot` binary as a
**subprocess** — the path you take from non-Node hosts (Go, Java, Python,
Rust), from shell scripts, or from any language without a first-party SDK.

Reference: [`../../CLI.md`](../../CLI.md) — the three invocation patterns
covered here are §1 (one-shot), §3 (few-shot via `@file` injection), and §2
(start-up instructions).

## Layout

```
examples/cli/
├── one-shot/   # copilot -p "<prompt>"                              (CLI.md §1)
├── few-shot/   # copilot -p "@./prompts/cleaner.md <snippet>"       (CLI.md §3)
└── startup/    # copilot -p "@./instructions.md <user prompt>"      (CLI.md §2)
```

Each pattern directory contains the **same task** implemented in six host
runtimes so you can diff them side-by-side:

| File         | Runtime   | How to run                                  |
| ------------ | --------- | ------------------------------------------- |
| `run.sh`     | bash      | `./run.sh`                                  |
| `run.mjs`    | Node 20+  | `node run.mjs`                              |
| `run.py`     | Python 3  | `python3 run.py`                            |
| `main.go`    | Go        | `go run main.go`                            |
| `Main.java`  | Java 17+  | `java Main.java` (single-file, JEP 330)     |
| `main.rs`    | Rust      | `rustc main.rs -o run && ./run`             |

`run.sh` is the canonical reference — it shows the literal `copilot`
invocation. Every other file is a thin host-language wrapper around the same
command. The `few-shot` and `startup` runners each `cd` into their own
directory before launching so the relative `@./<file>` path resolves the same
way regardless of where you invoke them from.

## Prerequisites

- `copilot` CLI on `PATH`
  ```sh
  # GitHub ships Copilot CLI via the `gh` extension installer; follow the
  # official docs (https://docs.github.com/copilot/github-copilot-in-the-cli)
  # for the platform-specific install path, then verify:
  copilot --version
  ```
- A signed-in GitHub account with Copilot access. The CLI uses your existing
  `gh` auth, or a `COPILOT_GITHUB_TOKEN` if set.

That's it — no SDK install required for this directory. The binary handles
auth, sessions, and tool dispatch.

## The three patterns

### 1. One-shot (`one-shot/`)

```sh
copilot -p "What is 2 + 2? Reply with only the digit." --allow-all-tools
```

`-p` (alias `--prompt`) takes a single prompt, runs it to completion, prints
the result, and exits. No interactive UI, no session retained. The base
building block for any scripted automation.

`--allow-all-tools` (alias `--yolo`) auto-approves any tool the model wants
to invoke — only safe to enable in headless / CI contexts when you trust the
prompt and the working tree. Drop it for interactive permission prompts.

CLI equivalent of [`../nodejs/simple-sdk/01-hello-world.mjs`](../nodejs/simple-sdk/01-hello-world.mjs).

### 2. Few-shot (`few-shot/`)

```sh
copilot -p "@./prompts/cleaner.md

Snippet to rewrite:
try { db.connect(); } catch(e) { console.log(e); }" --allow-all-tools
```

The Copilot CLI does **not** take an inline `--agents '<json>'` flag the way
the Claude CLI does. Its equivalent is the `@<path>` syntax: any
`@./relative/path.md` token inside the prompt is replaced at launch by the
contents of that file. We use it to inject `prompts/cleaner.md`, which
carries the Input → Output few-shot examples that pin the transform.

(Repo-wide alternative: put the same persona definition in `AGENTS.md` at the
repo root — Copilot auto-loads it on every launch. See CLI.md §3.)

Each example here defines a `cleaner` persona that rewrites sloppy
JavaScript `catch` blocks into structured `logger.error(...)` calls — two
Input → Output pairs in the markdown file, then the user prompt is the
snippet to rewrite.

### 3. Start-up instructions (`startup/`)

```sh
copilot -p "@./instructions.md

Describe the HTTP DELETE method." --allow-all-tools
```

Same `@<path>` injection mechanism as few-shot, but the referenced file
carries **behavioral guardrails** (output format, persona constraints)
rather than transform examples. This is the Copilot analog of Claude's
`--append-system-prompt`.

(Repo-wide alternative: drop the same rules into
`.github/copilot-instructions.md` at the repo root — Copilot auto-loads it
on every launch. Use that for project-wide rules; use `@./instructions.md`
for ad-hoc one-run overrides. See CLI.md §2.)

The examples here ask Copilot to describe an HTTP method while constraining
output to a single JSON object — what you want when piping to `jq` or a
downstream tool.

## Parity with `../nodejs/` (SDK-driven examples)

| CLI pattern (this dir)              | SDK equivalent in `../nodejs/simple-sdk/`               |
| ----------------------------------- | ------------------------------------------------------- |
| `one-shot/`                         | `01-hello-world.mjs` (client → session → `sendAndWait`) |
| `few-shot/` (`@./prompts/...`)      | Build the few-shot prompt string in JS and pass it      |
|                                     | as `{ prompt }` to `session.sendAndWait`                |
| `startup/` (`@./instructions.md`)   | Same — prepend the rules to the prompt string before    |
|                                     | calling `sendAndWait`                                   |

The SDK gives you typed responses, streaming events, and per-session
control — reach for it when you're inside a Node service. The CLI gives you
a language-agnostic subprocess interface — reach for it from Go / Java /
Python / Rust / shell, or anywhere you'd rather not link the SDK.

## Model selection

Override the default model per-invocation with the `--model` flag, an env
var, or (inside an interactive session) the `/model` slash command. See
CLI.md §5 for the full matrix:

```sh
copilot --model claude-sonnet "Refactor this script to use FastAPI" -p
COPILOT_MODEL=gpt-5-mini copilot -p "Run the test suite and summarize errors"
```

The wrapper scripts in this directory read their own `COPILOT_CLI_MODEL` env
var (defaulting to `gpt-5-mini`) and forward it to the CLI as `--model`. They
likewise read `COPILOT_CLI_REASONING_EFFORT` (default `low`) and forward it as
`-r`, so both knobs work everywhere in these examples:

```sh
COPILOT_CLI_MODEL=claude-sonnet ./one-shot/run.sh "Summarize the last 5 commits"
COPILOT_CLI_REASONING_EFFORT=high ./one-shot/run.sh "Plan a refactor of this module"
```

## Interactive variant (not scripted)

Omit `-p` to launch Copilot into its interactive UI with the prompt as the
first turn — useful for "kick off a task, then steer it by hand":

```sh
copilot "Investigate why the test suite is failing"
```

Once inside, slash commands like `/plan`, `/yolo`, `/review`, and
`/model gpt-5` switch behavior on the fly. The host-language wrappers in
this directory all pass `-p` because they're written for automation.
