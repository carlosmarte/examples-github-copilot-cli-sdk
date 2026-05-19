// 01 — Hello world
//
// The smallest useful Copilot SDK program: open a client, create a session,
// send one prompt, print the answer, shut the client down. `await using`
// ensures CopilotClient.DisposeAsync runs even on throw.
//
// Run: dotnet run --project HelloWorld

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
    OnPermissionRequest = PermissionHandler.ApproveAll,
});

var response = await session.SendAsync(new MessageOptions { Prompt = "What is 2 + 2?" });
Console.WriteLine(response?.Data.Content);

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
