// Start-up instructions — Go driver for the `copilot` CLI.
//
// Inject behavioral rules at launch by prepending `@./instructions.md` to the
// prompt — the CLI swaps the `@<path>` token for that file's contents before
// invoking the model. This is the Copilot analog of Claude's
// `--append-system-prompt`.
//
// (Repo-wide alternative: drop the same rules into
// `.github/copilot-instructions.md` at the repo root — Copilot auto-loads it
// on every launch.)
//
// Pattern reference: CLI.md §2.
//
// Run from this directory so the relative `@./instructions.md` resolves:
//
//	go run main.go
//	go run main.go "Describe HTTP PATCH"
package main

import (
	"cmp"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func main() {
	// Disable any user-configured MCP servers so this example runs against
	// the bare SDK/CLI surface only.
	os.Setenv("COPILOT_DISABLE_MCP", "1")

	if exe, err := os.Executable(); err == nil {
		if dir := filepath.Dir(exe); !strings.Contains(dir, "go-build") {
			_ = os.Chdir(dir)
		}
	}

	userPrompt := "Describe the HTTP DELETE method."
	if len(os.Args) > 1 {
		userPrompt = os.Args[1]
	}

	prompt := "@./instructions.md\n\n" + userPrompt

	cmd := exec.Command("copilot", "--model", cmp.Or(os.Getenv("COPILOT_CLI_MODEL"), "gpt-5-mini"), "-r", cmp.Or(os.Getenv("COPILOT_CLI_REASONING_EFFORT"), "low"), "-p", prompt, "--allow-all-tools", "--disable-builtin-mcps")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	err := cmd.Run()
	if err == nil {
		return
	}

	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		os.Exit(exitErr.ExitCode())
	}
	fmt.Fprintln(os.Stderr, "failed to run copilot:", err)
	os.Exit(127)
}
