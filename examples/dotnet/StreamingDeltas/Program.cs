// 03 — Streaming deltas
//
// Enable streaming on the session and subscribe via session.On to receive
// AssistantMessageDeltaEvent chunks as they arrive. SessionIdleEvent signals
// completion; a TaskCompletionSource bridges the event into an awaitable.
//
// Run: dotnet run --project StreamingDeltas

using GitHub.Copilot.SDK;

await using var client = new CopilotClient(new CopilotClientOptions
{
    CliPath = ResolveCopilotCli(),
    CliArgs = new[] { "--disable-builtin-mcps" },
});
await client.StartAsync();

var session = await client.CreateSessionAsync(new SessionConfig
{
    Model = "gpt-4.1",
    Streaming = true,
    OnPermissionRequest = PermissionHandler.ApproveAll,
});

var idle = new TaskCompletionSource();
session.On(evt =>
{
    switch (evt)
    {
        case AssistantMessageDeltaEvent delta:
            Console.Write(delta.Data.DeltaContent);
            break;
        case SessionIdleEvent:
            idle.TrySetResult();
            break;
    }
});

await session.SendAsync(new MessageOptions { Prompt = "Write a haiku about C#'s async/await." });
await idle.Task;
Console.WriteLine();

static string ResolveCopilotCli()
{
    var pathEnv = Environment.GetEnvironmentVariable("PATH");
    if (pathEnv is not null)
    {
        foreach (var dir in pathEnv.Split(Path.PathSeparator))
        {
            var candidate = Path.Combine(dir, "copilot");
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }
    }
    var envOverride = Environment.GetEnvironmentVariable("COPILOT_CLI_PATH");
    if (!string.IsNullOrEmpty(envOverride))
    {
        return envOverride;
    }
    throw new InvalidOperationException(
        "copilot CLI not found. Install @github/copilot globally or set COPILOT_CLI_PATH.");
}
