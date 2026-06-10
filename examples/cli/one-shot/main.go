// One-shot — Go driver for the `copilot` CLI.
//
// Spawns `copilot -p "<prompt>" --allow-all-tools` with os/exec, wires stdio
// through to the parent terminal, and forwards the exit code. Go counterpart
// of examples/nodejs/simple-sdk/01-hello-world.mjs driving the CLI subprocess
// instead of the in-process SDK.
//
// Pattern reference: CLI.md §1.
//
// Run:
//
//	go run main.go
//	go run main.go "Summarize the last 5 git commits as a markdown list"
package main

import (
	"cmp"
	"errors"
	"os"
	"os/exec"
)

func main() {
	// Disable any user-configured MCP servers so this example runs against
	// the bare SDK/CLI surface only.
	os.Setenv("COPILOT_DISABLE_MCP", "1")

	prompt := "What is 2 + 2? Reply with only the digit."
	if len(os.Args) > 1 {
		prompt = os.Args[1]
	}

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
	// PathError (binary not on PATH) and friends.
	os.Stderr.WriteString("failed to run copilot: " + err.Error() + "\n")
	os.Exit(127)
}
