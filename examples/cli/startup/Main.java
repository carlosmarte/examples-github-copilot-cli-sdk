// Start-up instructions — Java driver for the `copilot` CLI.
//
// Inject behavioral rules at launch by prepending `@./instructions.md` to
// the prompt — the CLI swaps the `@<path>` token for that file's contents
// before invoking the model. This is the Copilot analog of Claude's
// `--append-system-prompt`. Runs as a single-file source program (JEP 330,
// Java 11+).
//
// (Repo-wide alternative: drop the same rules into
// `.github/copilot-instructions.md` at the repo root — Copilot auto-loads
// it on every launch.)
//
// Pattern reference: CLI.md §2.
//
// Run from this directory so the relative `@./instructions.md` resolves:
//   java Main.java
//   java Main.java "Describe HTTP PATCH"

import java.io.File;

public class Main {
    private static final String DEFAULT_PROMPT = "Describe the HTTP DELETE method.";

    public static void main(String[] args) throws Exception {
        String userPrompt = args.length > 0 ? args[0] : DEFAULT_PROMPT;
        String prompt = "@./instructions.md\n\n" + userPrompt;

        File here = new File(Main.class.getProtectionDomain()
            .getCodeSource().getLocation().toURI()).getParentFile();

        ProcessBuilder pb = new ProcessBuilder(
            "copilot",
            "--model", System.getenv().getOrDefault("COPILOT_CLI_MODEL", "gpt-5-mini"), "-r", System.getenv().getOrDefault("COPILOT_CLI_REASONING_EFFORT", "low"), "-p", prompt,
            "--allow-all-tools",
            "--disable-builtin-mcps"
        );
        // Disable any user-configured MCP servers so this example runs against
        // the bare SDK/CLI surface only.
        pb.environment().put("COPILOT_DISABLE_MCP", "1");
        if (here != null && new File(here, "instructions.md").exists()) {
            pb.directory(here);
        }
        pb.inheritIO();

        try {
            Process p = pb.start();
            System.exit(p.waitFor());
        } catch (java.io.IOException e) {
            System.err.println("failed to run copilot: " + e.getMessage());
            System.exit(127);
        }
    }
}
