// 04 — Explain a code file
//
// Read a file from disk and ask Copilot for a plain-English explanation.
//
// Run: mvn -q exec:java -Dexec.mainClass=examples.copilot.ExplainCodeFile \
//        -Dexec.args="src/main/java/examples/copilot/HelloWorld.java"
package examples.copilot;

import com.github.copilot.sdk.CopilotClient;
import com.github.copilot.sdk.CopilotSession;
import com.github.copilot.sdk.generated.AssistantMessageEvent;
import com.github.copilot.sdk.json.CopilotClientOptions;
import com.github.copilot.sdk.json.MessageOptions;
import com.github.copilot.sdk.json.PermissionHandler;
import com.github.copilot.sdk.json.SessionConfig;

import java.nio.file.Files;
import java.nio.file.Path;

public final class ExplainCodeFile {
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
    if (args.length < 1 || args[0].isBlank()) {
      System.err.println("usage: ExplainCodeFile <file>");
      System.exit(1);
    }

    Path target = Path.of(args[0]);
    String source = Files.readString(target);

    String prompt = String.join("\n",
        "Explain what this file does in 4-6 bullet points.",
        "Call out anything subtle (race conditions, hidden side effects, error swallowing).",
        "",
        "--- " + target + " ---",
        source
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
}
