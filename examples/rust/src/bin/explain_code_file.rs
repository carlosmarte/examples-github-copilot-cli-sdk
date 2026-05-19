//! 04 — Explain a code file
//!
//! Read a file from disk and ask Copilot for a plain-English explanation.
//!
//! Run: cargo run --bin explain_code_file -- <path-to-source-file>
//! e.g. cargo run --bin explain_code_file -- src/bin/hello_world.rs

use github_copilot_sdk::{CliProgram, Client, ClientOptions, SessionConfig};
use std::env;
use std::fs;
use std::path::PathBuf;

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
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 || args[1].is_empty() {
        eprintln!("usage: cargo run --bin explain_code_file -- <file>");
        std::process::exit(1);
    }
    let target = PathBuf::from(&args[1]);
    let source = fs::read_to_string(&target)?;

    let prompt = [
        "Explain what this file does in 4-6 bullet points.".to_string(),
        "Call out anything subtle (race conditions, hidden side effects, error swallowing)."
            .to_string(),
        String::new(),
        format!("--- {} ---", target.display()),
        source,
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
