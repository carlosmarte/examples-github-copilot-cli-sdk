// 06 — Graceful shutdown
//
// `client.Stop()` must run on success, on panic/error, and on SIGINT/SIGTERM —
// otherwise the underlying Copilot CLI subprocess can leak. Three paths,
// one idempotent shutdown helper:
//   1. happy path: defer shutdown(0)
//   2. error:      run() returns code 1, shutdown(1) fires from defer
//   3. signal:     signal.Notify channel triggers shutdown(130/143)
//
// Run: go run ./cmd/graceful-shutdown
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"sync"
	"syscall"

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
	client := copilot.NewClient(&copilot.ClientOptions{
		CLIPath: resolveCopilotCli(),
		CLIArgs: []string{"--disable-builtin-mcps"},
	})

	var once sync.Once
	shutdown := func(code int) {
		once.Do(func() {
			if err := client.Stop(); err != nil {
				fmt.Fprintf(os.Stderr, "client.Stop failed: %v\n", err)
			}
			os.Exit(code)
		})
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		s := <-sigCh
		code := 130
		if s == syscall.SIGTERM {
			code = 143
		}
		shutdown(code)
	}()

	ctx := context.Background()
	if err := client.Start(ctx); err != nil {
		log.Printf("client.Start: %v", err)
		shutdown(1)
	}

	session, err := client.CreateSession(ctx, &copilot.SessionConfig{
		Model:               "gpt-4.1",
		OnPermissionRequest: copilot.PermissionHandler.ApproveAll,
	})
	if err != nil {
		log.Printf("client.CreateSession: %v", err)
		shutdown(1)
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

	if _, err := session.Send(ctx, copilot.MessageOptions{
		Prompt: "Name three failure modes that show up only in long-running CLI subprocesses.",
	}); err != nil {
		log.Printf("session.Send: %v", err)
		shutdown(1)
	}
	<-done

	shutdown(0)
}
