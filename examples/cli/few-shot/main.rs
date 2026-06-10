// Few-shot — Rust driver for the `copilot` CLI.
//
// The Copilot CLI does not accept inline `--agents '<json>'`; instead, an
// `@<path>` token inside the prompt is replaced at launch by the contents
// of that file. We inject `prompts/cleaner.md` (Input → Output examples)
// and append the user snippet beneath it. Pattern reference: CLI.md §3.
//
// Run from this directory so the relative `@./prompts/cleaner.md` resolves:
//   rustc main.rs -o run && ./run
//   ./run "try { fs.readFile(p); } catch(e) { console.log(e); }"

use std::env;
use std::path::PathBuf;
use std::process::{Command, exit};

const DEFAULT_SNIPPET: &str = "try { db.connect(); } catch(e) { console.log(e); }";

fn main() {
    // If the binary lives next to prompts/, chdir there so the @path resolves.
    if let Ok(exe) = env::current_exe() {
        if let Some(dir) = exe.parent() {
            let prompts: PathBuf = dir.join("prompts/cleaner.md");
            if prompts.is_file() {
                let _ = env::set_current_dir(dir);
            }
        }
    }

    let snippet = env::args()
        .nth(1)
        .unwrap_or_else(|| DEFAULT_SNIPPET.to_string());

    let prompt = format!(
        "@./prompts/cleaner.md\n\nSnippet to rewrite:\n{snippet}",
    );

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
