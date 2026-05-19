// 02 — Multi-turn conversation
//
// One session, multiple sequential prompts. The session keeps prior turns as
// context, so the second prompt can refer to the first answer. The event
// handler is registered once and the per-turn done channel is rebuilt every
// iteration so each loop body waits for its own SessionIdleData.
//
// Run: go run ./cmd/multi-turn
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"sync/atomic"

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
	turns := []string{
		"Give me a one-line description of the Fibonacci sequence.",
		"Now write a Go function that returns the nth Fibonacci number.",
		"Add a memoized version below the first one.",
	}

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

	var doneCh atomic.Pointer[chan struct{}]
	session.On(func(event copilot.SessionEvent) {
		switch d := event.Data.(type) {
		case *copilot.AssistantMessageData:
			fmt.Println(d.Content)
		case *copilot.SessionIdleData:
			if ch := doneCh.Load(); ch != nil {
				close(*ch)
			}
		}
	})

	for _, prompt := range turns {
		fmt.Printf("\n>>> %s\n\n", prompt)
		ch := make(chan struct{})
		doneCh.Store(&ch)
		if _, err := session.Send(ctx, copilot.MessageOptions{Prompt: prompt}); err != nil {
			log.Fatalf("session.Send: %v", err)
		}
		<-ch
	}
}
