#!/usr/bin/env node

import { mkdir, rename, stat, readFile } from "node:fs/promises";
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

  // Read package.json to get name and version
  const pkgJsonPath = path.join(repoRoot, "package.json");
  const pkgJson = JSON.parse(await readFile(pkgJsonPath, "utf-8"));
  const packageName = pkgJson.name;
  const packageVersion = pkgJson.version;

  console.log(`Building runtime package for ${packageName}@${packageVersion}`);

  // Check if dist exists
  const distDir = path.join(repoRoot, "dist");
  try {
    await stat(distDir);
  } catch {
    console.error("dist/ not found. Run 'npm run build' first.");
    process.exit(1);
  }

  // Use npm pack with --ignore-scripts to skip prepack
  const tarballName = `${packageName}-${packageVersion}.tgz`;
  const tarballPath = path.join(outDir, tarballName);

  try {
    const output = await run("npm", [
      "pack",
      "--ignore-scripts",
      "--pack-destination",
      outDir
    ]);

    console.log("npm pack output:", output.trim());

    // Rename to weiclaw-runtime.tgz
    const files = (await run("ls", ["-1", outDir])).trim().split("\n");
    const actualFile = files.find(f => f.includes(packageName) && f.endsWith(".tgz"));

    if (actualFile) {
      const source = path.join(outDir, actualFile);
      const target = path.join(outDir, "weiclaw-runtime.tgz");

      if (source !== target) {
        await rename(source, target);
      }

      const info = await stat(target);
      console.log(`\nRuntime package created:`);
      console.log(`  ${target}`);
      console.log(`  Size: ${(info.size / 1024 / 1024).toFixed(2)} MB`);
    }
  } catch (error) {
    console.error("Failed to create runtime package:", error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
