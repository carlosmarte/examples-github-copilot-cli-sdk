//! 05 — Generate a commit message from staged changes
//!
//! Runs `git diff --cached` and asks Copilot for a Conventional-Commits-style
//! message. Stage some changes first (`git add -p`) before running.
//!
//! Run: cargo run --bin commit_from_diff

use github_copilot_sdk::{CliProgram, Client, ClientOptions, SessionConfig};
use std::process::Command;

fn resolve_copilot_cli() -> std::path::PathBuf {
    // PATH lookup first
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in path_var.split(':') {
            let candidate = std::path::Path::new(dir).join("copilot");
            if candidate.is_file() {
                return candidate;
            }
        }
    }
    // Fall back to COPILOT_CLI_PATH env var
    if let Ok(env_path) = std::env::var("COPILOT_CLI_PATH") {
        if !env_path.is_empty() {
            return std::path::PathBuf::from(env_path);
        }
    }
    panic!("copilot CLI not found. Install @github/copilot globally or set COPILOT_CLI_PATH.");
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let output = Command::new("git").args(["diff", "--cached"]).output()?;
    if !output.status.success() {
        eprintln!("git diff --cached failed (exit {})", output.status);
        std::process::exit(1);
    }
    let diff = String::from_utf8_lossy(&output.stdout).into_owned();
    if diff.trim().is_empty() {
        eprintln!("No staged changes. Run `git add` first.");
        std::process::exit(1);
    }

    let prompt = [
        "Write a Conventional Commits message for the following staged diff.".to_string(),
        "Format: <type>(<scope>): <subject> on the first line, blank line, then a short body."
            .to_string(),
        "Keep the subject under 72 characters. Focus on the *why*, not the *what*.".to_string(),
        String::new(),
        "--- diff ---".to_string(),
        diff,
    ]
    .join("\n");

    let opts = ClientOptions::default()
        .with_program(CliProgram::Path(resolve_copilot_cli()))
        .with_extra_args(["--disable-builtin-mcps"]);
    let client = Client::start(opts).await?;
    let mut config = SessionConfig::default();
    config.model = Some("gpt-4.1".to_string());
    let config = config.approve_all_permissions();
    let session = client.create_session(config).await?;

    if let Some(event) = session.send_and_wait(prompt).await? {
        if let Some(content) = event.data.get("content").and_then(|v| v.as_str()) {
            println!("{}", content);
        }
    }

    session.destroy().await?;
    client.stop().await?;
    Ok(())
}
