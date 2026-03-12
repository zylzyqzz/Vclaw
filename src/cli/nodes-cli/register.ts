import type { Command } from "commander";
import { isTruthyEnvValue } from "../../infra/env.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { formatHelpExamples } from "../help-format.js";
import { registerNodesCameraCommands } from "./register.camera.js";
import { registerNodesCanvasCommands } from "./register.canvas.js";
import { registerNodesInvokeCommands } from "./register.invoke.js";
import { registerNodesLocationCommands } from "./register.location.js";
import { registerNodesNotifyCommand } from "./register.notify.js";
import { registerNodesPairingCommands } from "./register.pairing.js";
import { registerNodesPushCommand } from "./register.push.js";
import { registerNodesScreenCommands } from "./register.screen.js";
import { registerNodesStatusCommands } from "./register.status.js";

export function registerNodesCli(program: Command) {
  const enableNodeMedia =
    isTruthyEnvValue(process.env.WEICLAW_ENABLE_NODE_MEDIA) ||
    isTruthyEnvValue(process.env.OPENCLAW_ENABLE_NODE_MEDIA);
  const nodes = program
    .command("nodes")
    .description("Manage gateway-owned nodes (pairing, status, invoke)")
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          ["vclaw nodes status", "List known nodes with live status."],
          ["vclaw nodes pairing pending", "Show pending node pairing requests."],
          ['vclaw nodes run --node <id> --raw "uname -a"', "Run a shell command on a node."],
        ])}\n\n${theme.muted("Docs:")} ${formatDocsLink("/cli/nodes", "docs.vclaw.ai/cli/nodes")}\n`,
    );

  registerNodesStatusCommands(nodes);
  registerNodesPairingCommands(nodes);
  registerNodesInvokeCommands(nodes);
  registerNodesNotifyCommand(nodes);
  registerNodesPushCommand(nodes);
  if (enableNodeMedia) {
    registerNodesCanvasCommands(nodes);
    registerNodesCameraCommands(nodes);
    registerNodesScreenCommands(nodes);
    registerNodesLocationCommands(nodes);
  }
}
