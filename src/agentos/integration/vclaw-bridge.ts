import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export interface VclawBridgeRequest {
  task: string;
  allowWrite?: boolean;
  vclawBin?: string;
  vclawConfig?: string;
  cwd?: string;
  timeoutMs?: number;
}

export interface VclawBridgeResult {
  ok: boolean;
  command: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  resolvedBin: string;
}

function candidateBins(cwd = process.cwd()): string[] {
  const isWindows = process.platform === "win32";
  const exe = isWindows ? "vclaw.exe" : "vclaw";
  return [
    process.env.VCLAW_BIN ?? "",
    path.join("E:\\", "Vclaw", "vclaw.exe"),
    path.join(cwd, "..", "Vclaw", exe),
    path.join(cwd, "Vclaw", exe),
    path.join(cwd, exe),
    isWindows ? "vclaw.exe" : "vclaw",
  ].filter((x) => x.length > 0);
}

export function resolveVclawBin(explicit?: string, cwd = process.cwd()): string {
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim();
  }

  for (const candidate of candidateBins(cwd)) {
    if (!candidate.includes(path.sep)) {
      return candidate;
    }
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return process.platform === "win32" ? "vclaw.exe" : "vclaw";
}

export function runVclawTask(input: VclawBridgeRequest): VclawBridgeResult {
  const started = Date.now();
  const bin = resolveVclawBin(input.vclawBin, input.cwd ?? process.cwd());

  const args: string[] = [];
  if (input.vclawConfig && input.vclawConfig.trim().length > 0) {
    args.push("--config", input.vclawConfig.trim());
  }
  args.push("run", input.task);
  if (input.allowWrite) {
    args.push("--allow-write");
  }

  const child = spawnSync(bin, args, {
    cwd: input.cwd ?? process.cwd(),
    encoding: "utf8",
    timeout: Math.max(1000, input.timeoutMs ?? 120000),
    env: process.env,
    shell: false,
  });

  const durationMs = Date.now() - started;
  const exitCode = child.status ?? 1;
  const stdout = child.stdout ?? "";
  const stderr =
    child.stderr ??
    (child.error ? `${child.error.name}: ${child.error.message}` : "vclaw subprocess failed");

  return {
    ok: exitCode === 0,
    command: [bin, ...args],
    exitCode,
    stdout,
    stderr,
    durationMs,
    resolvedBin: bin,
  };
}

