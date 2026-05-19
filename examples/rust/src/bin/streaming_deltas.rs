//! 03 — Streaming deltas
//!
//! Implement SessionHandler to receive `assistant.message_delta` events as
//! they arrive. The handler is registered on SessionConfig before the session
//! is created.
//!
//! Run: cargo run --bin streaming_deltas

use async_trait::async_trait;
use github_copilot_sdk::handler::{HandlerEvent, HandlerResponse, SessionHandler};
use github_copilot_sdk::{CliProgram, Client, ClientOptions, SessionConfig};
use std::io::Write;
use std::sync::Arc;

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

struct StdoutPrinter;

#[async_trait]
impl SessionHandler for StdoutPrinter {
    async fn on_event(&self, event: HandlerEvent) -> HandlerResponse {
        if let HandlerEvent::SessionEvent { event, .. } = event {
            if event.event_type == "assistant.message_delta" {
                if let Some(text) = event.data.get("deltaContent").and_then(|v| v.as_str()) {
                    print!("{}", text);
                    let _ = std::io::stdout().flush();
                }
            }
        }
        HandlerResponse::Ok
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let opts = ClientOptions::default()
        .with_program(CliProgram::Path(resolve_copilot_cli()))
        .with_extra_args(["--disable-builtin-mcps"]);
    let client = Client::start(opts).await?;

    let mut config = SessionConfig::default();
    config.model = Some("gpt-4.1".to_string());
    config.streaming = Some(true);
    let config = config.with_handler(Arc::new(StdoutPrinter));
    let config = config.approve_all_permissions();

    let session = client.create_session(config).await?;

    session
        .send_and_wait("Write a haiku about Rust's borrow checker.")
        .await?;
    println!();

    session.destroy().await?;
    client.stop().await?;
    Ok(())
}
