// 04 — Explain a code file
//
// Read a file from disk and ask Copilot for a plain-English explanation.
//
// Run: go run ./cmd/explain-code-file <path-to-source-file>
// e.g. go run ./cmd/explain-code-file cmd/hello-world/main.go
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"

	copilot "github.com/github/copilot-sdk/go"
)

func resolveCopilotCli() string {
	if p, err := exec.LookPath("copilot"); err == nil {
		return p
	}
	if p := os.Getenv("COPILOT_CLI_PATH"); p != "" {
		return p
	}
	log.Fatal("copilot CLI not found. Install @github/copilot globally or set COPILOT_CLI_PATH.")
	return ""
}

func main() {
	if len(os.Args) < 2 || os.Args[1] == "" {
		fmt.Fprintln(os.Stderr, "usage: explain-code-file <file>")
		os.Exit(1)
	}
	target := os.Args[1]
	source, err := os.ReadFile(target)
	if err != nil {
		log.Fatalf("read %s: %v", target, err)
	}

	prompt := strings.Join([]string{
		"Explain what this file does in 4-6 bullet points.",
		"Call out anything subtle (race conditions, hidden side effects, error swallowing).",
		"",
		"--- " + target + " ---",
		string(source),
	}, "\n")

	ctx := context.Background()
	client := copilot.NewClient(&copilot.ClientOptions{
		CLIPath: resolveCopilotCli(),
		CLIArgs: []string{"--disable-builtin-mcps"},
	})
	if err := client.Start(ctx); err != nil {
		log.Fatalf("client.Start: %v", err)
	}
	defer client.Stop()

	session, err := client.CreateSession(ctx, &copilot.SessionConfig{
		Model:               "gpt-4.1",
		OnPermissionRequest: copilot.PermissionHandler.ApproveAll,
	})
	if err != nil {
		log.Fatalf("client.CreateSession: %v", err)
	}
	defer session.Disconnect()

	done := make(chan struct{})
	session.On(func(event copilot.SessionEvent) {
		switch d := event.Data.(type) {
		case *copilot.AssistantMessageData:
			fmt.Println(d.Content)
		case *copilot.SessionIdleData:
			close(done)
		}
	})

	if _, err := session.Send(ctx, copilot.MessageOptions{Prompt: prompt}); err != nil {
		log.Fatalf("session.Send: %v", err)
	}
	<-done
}
