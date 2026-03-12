import type { Command } from "commander";
import { onboardCommand } from "../../commands/onboard.js";
import { setupCommand } from "../../commands/setup.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { hasExplicitOptions } from "../command-options.js";

export function registerSetupCommand(program: Command) {
  program
    .command("setup")
    .description("Initialize local config, workspace, or run the minimal Vclaw bootstrap")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/setup", "docs.vclaw.ai/cli/setup")}\n`,
    )
    .option(
      "--workspace <dir>",
      "Agent workspace directory (default: ~/.vclaw/workspace; stored as agents.defaults.workspace)",
    )
    .option("--bootstrap", "Run the minimal bootstrap flow", false)
    .option("--skip-tui", "Skip the final TUI prompt in bootstrap mode", false)
    .option("--wizard", "Run the interactive onboarding wizard", false)
    .option("--non-interactive", "Run the wizard without prompts", false)
    .option("--mode <mode>", "Wizard mode: local|remote")
    .option("--remote-url <url>", "Remote Gateway WebSocket URL")
    .option("--remote-token <token>", "Remote Gateway token (optional)")
    .action(async (opts, command) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const hasWizardFlags = hasExplicitOptions(command, [
          "wizard",
          "nonInteractive",
          "mode",
          "remoteUrl",
          "remoteToken",
        ]);
        if (opts.bootstrap) {
          await setupCommand(
            {
              workspace: opts.workspace as string | undefined,
              bootstrap: true,
              skipTui: Boolean(opts.skipTui),
            },
            defaultRuntime,
          );
          return;
        }
        if (opts.wizard || hasWizardFlags) {
          await onboardCommand(
            {
              workspace: opts.workspace as string | undefined,
              nonInteractive: Boolean(opts.nonInteractive),
              mode: opts.mode as "local" | "remote" | undefined,
              remoteUrl: opts.remoteUrl as string | undefined,
              remoteToken: opts.remoteToken as string | undefined,
            },
            defaultRuntime,
          );
          return;
        }
        await setupCommand(
          {
            workspace: opts.workspace as string | undefined,
            bootstrap: false,
          },
          defaultRuntime,
        );
      });
    });
}
