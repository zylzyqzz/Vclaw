import path from "node:path";

export const DEFAULT_CLI_NAME = "vclaw";
export const LEGACY_CLI_NAME = "weiclaw";
export const SECONDARY_LEGACY_CLI_NAME = "openclaw";

const KNOWN_CLI_NAMES = new Set([
  DEFAULT_CLI_NAME,
  LEGACY_CLI_NAME,
  SECONDARY_LEGACY_CLI_NAME,
  "openclaw.mjs",
  "vclaw.mjs",
]);
const CLI_PREFIX_RE = /^(?:((?:pnpm|npm|bunx|npx)\s+))?(openclaw|weiclaw|vclaw)\b/;

export function resolveCliName(argv: string[] = process.argv): string {
  const argv1 = argv[1];
  if (!argv1) {
    return DEFAULT_CLI_NAME;
  }
  const base = path.basename(argv1).trim();
  if (base === "openclaw.mjs" || base === "vclaw.mjs") {
    return DEFAULT_CLI_NAME;
  }
  if (KNOWN_CLI_NAMES.has(base)) {
    return DEFAULT_CLI_NAME;
  }
  return DEFAULT_CLI_NAME;
}

export function replaceCliName(command: string, cliName = resolveCliName()): string {
  if (!command.trim()) {
    return command;
  }
  if (!CLI_PREFIX_RE.test(command)) {
    return command;
  }
  return command.replace(CLI_PREFIX_RE, (_match, runner: string | undefined) => {
    return `${runner ?? ""}${cliName}`;
  });
}
