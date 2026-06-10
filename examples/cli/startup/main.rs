// Start-up instructions — Rust driver for the `copilot` CLI.
//
// Inject behavioral rules at launch by prepending `@./instructions.md` to
// the prompt — the CLI swaps the `@<path>` token for that file's contents
// before invoking the model. This is the Copilot analog of Claude's
// `--append-system-prompt`.
//
// (Repo-wide alternative: drop the same rules into
// `.github/copilot-instructions.md` at the repo root — Copilot auto-loads
// it on every launch.)
//
// Pattern reference: CLI.md §2.
//
// Run from this directory so the relative `@./instructions.md` resolves:
//   rustc main.rs -o run && ./run
//   ./run "Describe HTTP PATCH"

use std::env;
use std::path::PathBuf;
use std::process::{Command, exit};

const DEFAULT_PROMPT: &str = "Describe the HTTP DELETE method.";

fn main() {
    if let Ok(exe) = env::current_exe() {
        if let Some(dir) = exe.parent() {
            let instr: PathBuf = dir.join("instructions.md");
            if instr.is_file() {
                let _ = env::set_current_dir(dir);
            }
        }
    }

    let user_prompt = env::args()
        .nth(1)
        .unwrap_or_else(|| DEFAULT_PROMPT.to_string());

    let prompt = format!("@./instructions.md\n\n{user_prompt}");

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
