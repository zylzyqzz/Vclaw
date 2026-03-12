import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hashFile = path.join(repoRoot, "src", "canvas-host", "a2ui", ".bundle.hash");
const outputFile = path.join(repoRoot, "src", "canvas-host", "a2ui", "a2ui.bundle.js");
const rendererDir = path.join(repoRoot, "vendor", "a2ui", "renderers", "lit");
const appDir = path.join(repoRoot, "apps", "shared", "OpenClawKit", "Tools", "CanvasA2UI");

function normalizePath(input) {
  return input.split(path.sep).join("/");
}

async function pathExists(input) {
  try {
    await fs.stat(input);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(entryPath, files) {
  const stat = await fs.stat(entryPath);
  if (stat.isDirectory()) {
    const entries = await fs.readdir(entryPath);
    for (const entry of entries) {
      await walkFiles(path.join(entryPath, entry), files);
    }
    return;
  }
  files.push(entryPath);
}

async function computeHash(inputs) {
  const files = [];
  for (const input of inputs) {
    await walkFiles(input, files);
  }
  files.sort((a, b) => normalizePath(a).localeCompare(normalizePath(b)));
  const hash = createHash("sha256");
  for (const filePath of files) {
    hash.update(normalizePath(path.relative(repoRoot, filePath)));
    hash.update("\0");
    hash.update(await fs.readFile(filePath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit ${code ?? "unknown"}`));
    });
    child.on("error", reject);
  });
}

export async function bundleA2ui() {
  const sourcesPresent = (await pathExists(rendererDir)) && (await pathExists(appDir));
  if (!sourcesPresent) {
    if (await pathExists(outputFile)) {
      console.log("A2UI sources missing; keeping prebuilt bundle.");
      return;
    }
    throw new Error(`A2UI sources missing and no prebuilt bundle found at: ${outputFile}`);
  }

  const currentHash = await computeHash([
    path.join(repoRoot, "package.json"),
    path.join(repoRoot, "pnpm-lock.yaml"),
    rendererDir,
    appDir,
  ]);

  if ((await pathExists(hashFile)) && (await pathExists(outputFile))) {
    const previousHash = (await fs.readFile(hashFile, "utf8")).trim();
    if (previousHash === currentHash) {
      console.log("A2UI bundle up to date; skipping.");
      return;
    }
  }

  await runCommand("pnpm", ["-s", "exec", "tsc", "-p", path.join(rendererDir, "tsconfig.json")]);
  await runCommand("pnpm", ["-s", "dlx", "rolldown", "-c", path.join(appDir, "rolldown.config.mjs")]);
  await fs.writeFile(hashFile, `${currentHash}\n`, "utf8");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  bundleA2ui().catch((error) => {
    console.error("A2UI bundling failed. Re-run with: pnpm canvas:a2ui:bundle");
    console.error("If this persists, verify pnpm deps and try again.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
