// One-shot — Java driver for the `copilot` CLI.
//
// Uses ProcessBuilder.inheritIO() so the child writes straight to the parent's
// stdout/stderr, then forwards the exit code. Runs as a single-file source
// program (JEP 330, Java 11+) — no build step required.
//
// Pattern reference: CLI.md §1.
//
// Run:
//   java Main.java
//   java Main.java "Summarize the last 5 git commits as a markdown list"

public class Main {
    public static void main(String[] args) throws Exception {
        String prompt = args.length > 0
            ? args[0]
            : "What is 2 + 2? Reply with only the digit.";

        ProcessBuilder pb = new ProcessBuilder(
            "copilot", "--model", System.getenv().getOrDefault("COPILOT_CLI_MODEL", "gpt-5-mini"), "-r", System.getenv().getOrDefault("COPILOT_CLI_REASONING_EFFORT", "low"), "-p", prompt, "--allow-all-tools", "--disable-builtin-mcps"
        );
        // Disable any user-configured MCP servers so this example runs against
        // the bare SDK/CLI surface only.
        pb.environment().put("COPILOT_DISABLE_MCP", "1");
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
