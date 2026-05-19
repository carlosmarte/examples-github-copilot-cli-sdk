// 05 — Generate a commit message from staged changes
//
// Runs `git diff --cached` and asks Copilot for a Conventional-Commits-style
// message. Stage some changes first (`git add -p`) before running.
//
// Run: mvn -q exec:java -Dexec.mainClass=examples.copilot.CommitMessageFromDiff
package examples.copilot;

import com.github.copilot.sdk.CopilotClient;
import com.github.copilot.sdk.CopilotSession;
import com.github.copilot.sdk.generated.AssistantMessageEvent;
import com.github.copilot.sdk.json.CopilotClientOptions;
import com.github.copilot.sdk.json.MessageOptions;
import com.github.copilot.sdk.json.PermissionHandler;
import com.github.copilot.sdk.json.SessionConfig;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

public final class CommitMessageFromDiff {
  private static String resolveCopilotCli() {
      String pathEnv = System.getenv("PATH");
      if (pathEnv != null) {
          for (String dir : pathEnv.split(java.io.File.pathSeparator)) {
              java.io.File candidate = new java.io.File(dir, "copilot");
              if (candidate.canExecute()) {
                  return candidate.getAbsolutePath();
              }
          }
      }
      String envOverride = System.getenv("COPILOT_CLI_PATH");
      if (envOverride != null && !envOverride.isEmpty()) {
          return envOverride;
      }
      throw new IllegalStateException(
          "copilot CLI not found. Install @github/copilot globally or set COPILOT_CLI_PATH."
      );
  }

  public static void main(String[] args) throws Exception {
    String diff = runGitDiffCached();
    if (diff.isBlank()) {
      System.err.println("No staged changes. Run `git add` first.");
      System.exit(1);
    }

    String prompt = String.join("\n",
        "Write a Conventional Commits message for the following staged diff.",
        "Format: <type>(<scope>): <subject> on the first line, blank line, then a short body.",
        "Keep the subject under 72 characters. Focus on the *why*, not the *what*.",
        "",
        "--- diff ---",
        diff
    );

    try (CopilotClient client = new CopilotClient(
        new CopilotClientOptions()
            .setCliPath(resolveCopilotCli())
            .setCliArgs(new String[]{"--disable-builtin-mcps"})
    )) {
      client.start().get();

      CopilotSession session = client.createSession(
          new SessionConfig()
              .setModel("gpt-4.1")
              .setOnPermissionRequest(PermissionHandler.APPROVE_ALL)
      ).get();

      AssistantMessageEvent response = session.sendAndWait(
          new MessageOptions().setPrompt(prompt)
      ).get();

      System.out.println(response.getData().content());
    }
  }

  private static String runGitDiffCached() throws IOException, InterruptedException {
    Process p = new ProcessBuilder("git", "diff", "--cached")
        .redirectErrorStream(false)
        .start();
    byte[] out = p.getInputStream().readAllBytes();
    int rc = p.waitFor();
    if (rc != 0) {
      throw new IOException("git diff --cached exited " + rc);
    }
    return new String(out, StandardCharsets.UTF_8);
  }
}
