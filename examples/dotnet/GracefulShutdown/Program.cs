// 06 — Graceful shutdown
//
// CopilotClient.StopAsync() must run on success, on exception, and on
// Ctrl-C / SIGTERM, or the underlying Copilot CLI subprocess can leak.
// One idempotent ShutdownAsync helper is wired to:
//   1. happy path: explicit ShutdownAsync(0) after the response prints
//   2. exception:  catch { ShutdownAsync(1) }
//   3. signal:     Console.CancelKeyPress -> 130, SIGTERM -> 143
//
// Run: dotnet run --project GracefulShutdown

using System.Runtime.InteropServices;
using GitHub.Copilot.SDK;

var client = new CopilotClient(new CopilotClientOptions
{
    CliPath = ResolveCopilotCli(),
    CliArgs = new[] { "--disable-builtin-mcps" },
});
var stopped = 0;

async Task ShutdownAsync(int code)
{
    if (Interlocked.Exchange(ref stopped, 1) != 0) return;
    try
    {
        await client.StopAsync();
    }
    catch (Exception e)
    {
        Console.Error.WriteLine($"client.StopAsync() failed: {e.Message}");
    }
    Environment.Exit(code);
}

Console.CancelKeyPress += (_, ev) =>
{
    ev.Cancel = true; // don't let the runtime kill us before we cleanup
    _ = ShutdownAsync(130);
};

using var sigterm = PosixSignalRegistration.Create(
    PosixSignal.SIGTERM,
    _ => { _ = ShutdownAsync(143); });

try
{
    await client.StartAsync();

    var session = await client.CreateSessionAsync(new SessionConfig
    {
        Model = "gpt-4.1",
        OnPermissionRequest = PermissionHandler.ApproveAll,
    });

    var response = await session.SendAsync(new MessageOptions
    {
        Prompt = "Name three failure modes that show up only in long-running CLI subprocesses.",
    });
    Console.WriteLine(response?.Data.Content);

    await ShutdownAsync(0);
}
catch (Exception e)
{
    Console.Error.WriteLine($"session failed: {e.Message}");
    await ShutdownAsync(1);
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
