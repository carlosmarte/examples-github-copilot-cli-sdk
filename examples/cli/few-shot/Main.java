// Few-shot — Java driver for the `copilot` CLI.
//
// The Copilot CLI does not accept inline `--agents '<json>'`; instead, an
// `@<path>` token inside the prompt is replaced at launch by the contents
// of that file. We inject `prompts/cleaner.md` (Input → Output examples)
// and append the user snippet beneath it. Runs as a single-file source
// program (JEP 330, Java 11+).
//
// Pattern reference: CLI.md §3.
//
// Run from this directory so the relative `@./prompts/cleaner.md` resolves:
//   java Main.java
//   java Main.java "try { fs.readFile(p); } catch(e) { console.log(e); }"

import java.io.File;

public class Main {
    private static final String DEFAULT_SNIPPET =
        "try { db.connect(); } catch(e) { console.log(e); }";

    public static void main(String[] args) throws Exception {
        String snippet = args.length > 0 ? args[0] : DEFAULT_SNIPPET;

        String prompt = String.join("\n",
            "@./prompts/cleaner.md",
            "",
            "Snippet to rewrite:",
            snippet
        );

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
        if (here != null && new File(here, "prompts/cleaner.md").exists()) {
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
