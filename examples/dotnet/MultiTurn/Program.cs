// 02 — Multi-turn conversation
//
// One session, multiple sequential prompts. The session keeps prior turns as
// context, so the second prompt can refer to the first answer.
//
// Run: dotnet run --project MultiTurn

using GitHub.Copilot.SDK;

string[] turns =
{
    "Give me a one-line description of the Fibonacci sequence.",
    "Now write a C# method that returns the nth Fibonacci number.",
    "Add a memoized version below the first one.",
};

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

foreach (var prompt in turns)
{
    Console.WriteLine();
    Console.WriteLine($">>> {prompt}");
    Console.WriteLine();

    var response = await session.SendAsync(new MessageOptions { Prompt = prompt });
    Console.WriteLine(response?.Data.Content);
}

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
