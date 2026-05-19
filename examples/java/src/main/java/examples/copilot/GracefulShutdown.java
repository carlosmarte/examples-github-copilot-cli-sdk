// 06 — Graceful shutdown
//
// `client.stop()` must run on success, on exception, and on SIGINT/SIGTERM —
// otherwise the underlying Copilot CLI subprocess can leak. Three paths,
// one shutdown helper:
//   1. happy path: finally block calls shutdown(0)
//   2. exception:  catch calls shutdown(1)
//   3. signal:     Runtime shutdown hook calls shutdown(130)
//
// Run: mvn -q exec:java -Dexec.mainClass=examples.copilot.GracefulShutdown
package examples.copilot;

import com.github.copilot.sdk.CopilotClient;
import com.github.copilot.sdk.CopilotSession;
import com.github.copilot.sdk.generated.AssistantMessageEvent;
import com.github.copilot.sdk.json.CopilotClientOptions;
import com.github.copilot.sdk.json.MessageOptions;
import com.github.copilot.sdk.json.PermissionHandler;
import com.github.copilot.sdk.json.SessionConfig;

import java.util.concurrent.atomic.AtomicBoolean;

public final class GracefulShutdown {
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

  public static void main(String[] args) {
    CopilotClient client = new CopilotClient(
        new CopilotClientOptions()
            .setCliPath(resolveCopilotCli())
            .setCliArgs(new String[]{"--disable-builtin-mcps"})
    );
    AtomicBoolean stopped = new AtomicBoolean(false);

    Runtime.getRuntime().addShutdownHook(new Thread(() -> shutdown(client, stopped), "copilot-shutdown"));

    int code = 0;
    try {
      client.start().get();

      CopilotSession session = client.createSession(
          new SessionConfig()
              .setModel("gpt-4.1")
              .setOnPermissionRequest(PermissionHandler.APPROVE_ALL)
      ).get();

      AssistantMessageEvent response = session.sendAndWait(
          new MessageOptions().setPrompt(
              "Name three failure modes that show up only in long-running CLI subprocesses."
          )
      ).get();

      System.out.println(response.getData().content());
    } catch (Exception err) {
      System.err.println("session failed: " + err);
      code = 1;
    } finally {
      shutdown(client, stopped);
    }
    System.exit(code);
  }

  private static void shutdown(CopilotClient client, AtomicBoolean stopped) {
    if (!stopped.compareAndSet(false, true)) {
      return;
    }
    try {
      client.stop().get();
    } catch (Exception err) {
      System.err.println("client.stop() failed: " + err);
    }
  }
}
