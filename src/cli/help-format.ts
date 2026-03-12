import { theme } from "../terminal/theme.js";
import { formatCliCommand } from "./command-format.js";

export type HelpExample = readonly [command: string, description: string];

export function formatHelpExample(command: string, description: string): string {
  return `  ${theme.command(formatCliCommand(command))}\n    ${theme.muted(description)}`;
}

export function formatHelpExampleLine(command: string, description: string): string {
  if (!description) {
    return `  ${theme.command(formatCliCommand(command))}`;
  }
  return `  ${theme.command(formatCliCommand(command))} ${theme.muted(`# ${description}`)}`;
}

export function formatHelpExamples(examples: ReadonlyArray<HelpExample>, inline = false): string {
  const formatter = inline ? formatHelpExampleLine : formatHelpExample;
  return examples.map(([command, description]) => formatter(command, description)).join("\n");
}

export function formatHelpExampleGroup(
  label: string,
  examples: ReadonlyArray<HelpExample>,
  inline = false,
) {
  return `${theme.muted(label)}\n${formatHelpExamples(examples, inline)}`;
}
