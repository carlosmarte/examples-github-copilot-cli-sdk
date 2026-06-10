// Few-shot — Go driver for the `copilot` CLI.
//
// The Copilot CLI does not accept inline `--agents '<json>'`; instead, an
// `@<path>` token inside the prompt is replaced at launch by the contents
// of that file. We inject `prompts/cleaner.md` (Input → Output examples) and
// append the user snippet beneath it. Pattern reference: CLI.md §3.
//
// Run from this directory so the relative `@./prompts/cleaner.md` resolves:
//
//	go run main.go
//	go run main.go "try { fs.readFile(p); } catch(e) { console.log(e); }"
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

	exe, err := os.Executable()
	if err == nil {
		// `go run` writes a temp binary; fall back to the source dir via the
		// invocation cwd when that happens.
		if dir := filepath.Dir(exe); !strings.Contains(dir, "go-build") {
			_ = os.Chdir(dir)
		}
	}

	snippet := "try { db.connect(); } catch(e) { console.log(e); }"
	if len(os.Args) > 1 {
		snippet = os.Args[1]
	}

	prompt := strings.Join([]string{
		"@./prompts/cleaner.md",
		"",
		"Snippet to rewrite:",
		snippet,
	}, "\n")

	cmd := exec.Command("copilot", "--model", cmp.Or(os.Getenv("COPILOT_CLI_MODEL"), "gpt-5-mini"), "-r", cmp.Or(os.Getenv("COPILOT_CLI_REASONING_EFFORT"), "low"), "-p", prompt, "--allow-all-tools", "--disable-builtin-mcps")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	err = cmd.Run()
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
