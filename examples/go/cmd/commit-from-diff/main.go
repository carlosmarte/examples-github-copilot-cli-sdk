// 05 — Generate a commit message from staged changes
//
// Runs `git diff --cached` and asks Copilot for a Conventional-Commits-style
// message. Stage some changes first (`git add -p`) before running.
//
// Run: go run ./cmd/commit-from-diff
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
	out, err := exec.Command("git", "diff", "--cached").Output()
	if err != nil {
		log.Fatalf("git diff --cached: %v", err)
	}
	diff := string(out)
	if strings.TrimSpace(diff) == "" {
		fmt.Fprintln(os.Stderr, "No staged changes. Run `git add` first.")
		os.Exit(1)
	}

	prompt := strings.Join([]string{
		"Write a Conventional Commits message for the following staged diff.",
		"Format: <type>(<scope>): <subject> on the first line, blank line, then a short body.",
		"Keep the subject under 72 characters. Focus on the *why*, not the *what*.",
		"",
		"--- diff ---",
		diff,
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
