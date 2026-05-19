//! 02 — Multi-turn conversation
//!
//! One session, multiple sequential prompts. The session keeps prior turns as
//! context, so the second prompt can refer to the first answer.
//!
//! Run: cargo run --bin multi_turn

use github_copilot_sdk::{CliProgram, Client, ClientOptions, SessionConfig};

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
    let turns = [
        "Give me a one-line description of the Fibonacci sequence.",
        "Now write a Rust function that returns the nth Fibonacci number.",
        "Add a memoized version below the first one.",
    ];

    let opts = ClientOptions::default()
        .with_program(CliProgram::Path(resolve_copilot_cli()))
        .with_extra_args(["--disable-builtin-mcps"]);
    let client = Client::start(opts).await?;

    let mut config = SessionConfig::default();
    config.model = Some("gpt-4.1".to_string());
    let config = config.approve_all_permissions();
    let session = client.create_session(config).await?;

    for prompt in turns {
        println!("\n>>> {}\n", prompt);
        if let Some(event) = session.send_and_wait(prompt).await? {
            if let Some(content) = event.data.get("content").and_then(|v| v.as_str()) {
                println!("{}", content);
            }
        }
    }

    session.destroy().await?;
    client.stop().await?;
    Ok(())
}
