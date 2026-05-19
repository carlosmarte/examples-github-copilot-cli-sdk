//! 06 — Graceful shutdown
//!
//! `client.stop().await` must run on success, on error, and on SIGINT/SIGTERM,
//! or the underlying Copilot CLI subprocess can leak. `tokio::select!` races
//! the work future against the two signal futures; whichever arm wins, the
//! single trailing `client.stop().await` cleans up before exit.
//!
//! Run: cargo run --bin graceful_shutdown

use github_copilot_sdk::{CliProgram, Client, ClientOptions, SessionConfig};
use tokio::signal::unix::{SignalKind, signal};

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

async fn run(client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    let mut config = SessionConfig::default();
    config.model = Some("gpt-4.1".to_string());
    let config = config.approve_all_permissions();
    let session = client.create_session(config).await?;

    if let Some(event) = session
        .send_and_wait(
            "Name three failure modes that show up only in long-running CLI subprocesses.",
        )
        .await?
    {
        if let Some(content) = event.data.get("content").and_then(|v| v.as_str()) {
            println!("{}", content);
        }
    }

    session.destroy().await?;
    Ok(())
}

#[tokio::main]
async fn main() {
    let opts = ClientOptions::default()
        .with_program(CliProgram::Path(resolve_copilot_cli()))
        .with_extra_args(["--disable-builtin-mcps"]);

    let client = match Client::start(opts).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("client.start failed: {}", e);
            std::process::exit(1);
        }
    };

    let mut sigint = signal(SignalKind::interrupt()).expect("install SIGINT handler");
    let mut sigterm = signal(SignalKind::terminate()).expect("install SIGTERM handler");

    let code = tokio::select! {
        result = run(&client) => match result {
            Ok(()) => 0,
            Err(e) => { eprintln!("session failed: {}", e); 1 }
        },
        _ = sigint.recv() => 130,
        _ = sigterm.recv() => 143,
    };

    if let Err(e) = client.stop().await {
        eprintln!("client.stop() failed: {}", e);
    }
    std::process::exit(code);
}
