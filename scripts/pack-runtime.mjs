#!/usr/bin/env node

import { mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, ".artifacts", "runtime");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "inherit"],
      shell: process.platform === "win32",
      ...options,
    });
    let stdout = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit ${code ?? "unknown"}`));
    });
  });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const raw = String(
    await run("npm", ["pack", "--silent", "--pack-destination", outDir]),
  )
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .pop();

  if (!raw) {
    throw new Error("npm pack produced no archive name");
  }

  const source = path.join(outDir, raw);
  const target = path.join(outDir, "weiclaw-runtime.tgz");
  if (path.resolve(source) !== path.resolve(target)) {
    await rename(source, target);
  }
  const info = await stat(target);
  process.stdout.write(`${target}\n${info.size}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
