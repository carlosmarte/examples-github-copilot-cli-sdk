// One-shot — Rust driver for the `copilot` CLI.
//
// Spawns `copilot -p "<prompt>" --allow-all-tools` with std::process::Command,
// inherits the parent's stdio so output streams through, and forwards the
// exit code. Single-file Rust — compile and run with `rustc main.rs && ./run`.
//
// Pattern reference: CLI.md §1.
//
// Run:
//   rustc main.rs -o run && ./run
//   ./run "Summarize the last 5 git commits as a markdown list"

use std::env;
use std::process::{Command, exit};

fn main() {
    let prompt = env::args()
        .nth(1)
        .unwrap_or_else(|| "What is 2 + 2? Reply with only the digit.".to_string());

    // `COPILOT_DISABLE_MCP=1` plus `--disable-builtin-mcps` keep this example
    // on the bare SDK/CLI surface — no user-configured or bundled MCP servers.
    let model = std::env::var("COPILOT_CLI_MODEL").unwrap_or_else(|_| "gpt-5-mini".to_string());
    let effort = std::env::var("COPILOT_CLI_REASONING_EFFORT").unwrap_or_else(|_| "low".to_string());
    let status = match Command::new("copilot")
        .env("COPILOT_DISABLE_MCP", "1")
        .args(["--model", &model, "-r", &effort, "-p", &prompt, "--allow-all-tools", "--disable-builtin-mcps"])
        .status()
    {
        Ok(s) => s,
        Err(err) => {
            eprintln!("failed to run copilot: {err}");
            exit(127);
        }
    };

    exit(status.code().unwrap_or(1));
}
