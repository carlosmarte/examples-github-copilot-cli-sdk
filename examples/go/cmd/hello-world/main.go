// 01 — Hello world
//
// The smallest useful Copilot SDK program: open a client, create a session,
// send one prompt, print the answer when the session goes idle, shut down.
//
// Run: go run ./cmd/hello-world
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"

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

	if _, err := session.Send(ctx, copilot.MessageOptions{Prompt: "What is 2 + 2?"}); err != nil {
		log.Fatalf("session.Send: %v", err)
	}
	<-done
}
