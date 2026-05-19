// 03 — Streaming deltas
//
// Enable streaming on the session and subscribe to AssistantMessageEvent to
// print chunks as they arrive. SessionIdleEvent fires when the response is
// complete and the session is ready for the next prompt.
//
// Run: mvn -q exec:java -Dexec.mainClass=examples.copilot.StreamingDeltas
package examples.copilot;

import com.github.copilot.sdk.CopilotClient;
import com.github.copilot.sdk.CopilotSession;
import com.github.copilot.sdk.generated.AssistantMessageEvent;
import com.github.copilot.sdk.generated.SessionIdleEvent;
import com.github.copilot.sdk.json.CopilotClientOptions;
import com.github.copilot.sdk.json.MessageOptions;
import com.github.copilot.sdk.json.PermissionHandler;
import com.github.copilot.sdk.json.SessionConfig;

import java.io.Closeable;
import java.util.concurrent.CountDownLatch;

public final class StreamingDeltas {
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
    try (CopilotClient client = new CopilotClient(
        new CopilotClientOptions()
            .setCliPath(resolveCopilotCli())
            .setCliArgs(new String[]{"--disable-builtin-mcps"})
    )) {
      client.start().get();

      CopilotSession session = client.createSession(
          new SessionConfig()
              .setModel("gpt-4.1")
              .setStreaming(true)
              .setOnPermissionRequest(PermissionHandler.APPROVE_ALL)
      ).get();

      Closeable offDelta = session.on(AssistantMessageEvent.class, event -> {
        String chunk = event.getData().content();
        if (chunk != null) {
          System.out.print(chunk);
          System.out.flush();
        }
      });

      CountDownLatch idle = new CountDownLatch(1);
      Closeable offIdle = session.on(SessionIdleEvent.class, event -> idle.countDown());

      try {
        session.sendAndWait(
            new MessageOptions().setPrompt("Write a haiku about garbage collection in Java.")
        ).get();
        idle.await();
      } finally {
        offDelta.close();
        offIdle.close();
      }

      System.out.println();
    }
  }
}
