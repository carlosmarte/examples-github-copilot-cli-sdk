// 05 — Generate a commit message from staged changes
//
// Runs `git diff --cached` and asks Copilot for a Conventional-Commits-style
// message. Stage some changes first (`git add -p`) before running.
//
// Run: dotnet run --project CommitFromDiff

using System.Diagnostics;
using GitHub.Copilot.SDK;

var psi = new ProcessStartInfo("git", "diff --cached")
{
    RedirectStandardOutput = true,
    UseShellExecute = false,
};

using var proc = Process.Start(psi) ?? throw new InvalidOperationException("failed to start git");
var diff = await proc.StandardOutput.ReadToEndAsync();
await proc.WaitForExitAsync();

if (proc.ExitCode != 0 || string.IsNullOrWhiteSpace(diff))
{
    Console.Error.WriteLine("No staged changes. Run `git add` first.");
    Environment.Exit(1);
}

var prompt = string.Join("\n",
    "Write a Conventional Commits message for the following staged diff.",
    "Format: <type>(<scope>): <subject> on the first line, blank line, then a short body.",
    "Keep the subject under 72 characters. Focus on the *why*, not the *what*.",
    "",
    "--- diff ---",
    diff);

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

var response = await session.SendAsync(new MessageOptions { Prompt = prompt });
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
