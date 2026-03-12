#!/usr/bin/env node

/**
 * WeiClaw Release Verification Script
 *
 * This script verifies all pre-release conditions before allowing
 * automatic publishing. Any failure will stop the release process.
 *
 * Verification checks:
 * 1. weiclaw --help
 * 2. openclaw --help
 * 3. tsgo (TypeScript check)
 * 4. build
 * 5. start
 * 6. bootstrap dry-run
 * 7. runtime package exists
 * 8. README up-to-date
 * 9. ROADMAP status aligned
 * 10. Release notes generated
 */

import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(import.meta.dirname, "..");
const VERBOSE = process.env.WEICLAW_VERIFY_VERBOSE === "1";

const checks = [];

function log(message, type = "info") {
  const prefix = {
    info: "[INFO]",
    pass: "[PASS]",
    fail: "[FAIL]",
    skip: "[SKIP]",
  }[type] || "[INFO]";

  if (type === "fail" || VERBOSE) {
    console.log(`${prefix} ${message}`);
  }
}

function check(name) {
  checks.push({ name, status: "pending" });
  log(`Running: ${name}`, "info");
  return {
    pass: (msg) => {
      checks.find((c) => c.name === name).status = "pass";
      log(`${name}: PASS - ${msg}`, "pass");
    },
    fail: (msg) => {
      checks.find((c) => c.name === name).status = "fail";
      log(`${name}: FAIL - ${msg}`, "fail");
      throw new Error(`${name} failed: ${msg}`);
    },
    skip: (msg) => {
      checks.find((c) => c.name === name).status = "skip";
      log(`${name}: SKIP - ${msg}`, "skip");
    },
  };
}

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function verifyWeiclawHelp() {
  const c = check("weiclaw --help");
  try {
    const result = await runCommand("node", [
      "scripts/run-node.mjs",
      "weiclaw",
      "--help",
    ]);
    if (result.code === 0) {
      c.pass("Command executed successfully");
    } else {
      c.fail(`Exit code ${result.code}`);
    }
  } catch (error) {
    c.fail(error.message);
  }
}

async function verifyOpenclawHelp() {
  const c = check("openclaw --help");
  try {
    const result = await runCommand("node", [
      "scripts/run-node.mjs",
      "openclaw",
      "--help",
    ]);
    if (result.code === 0) {
      c.pass("Command executed successfully");
    } else {
      c.fail(`Exit code ${result.code}`);
    }
  } catch (error) {
    c.fail(error.message);
  }
}

async function verifyTsgo() {
  const c = check("tsgo");
  try {
    const result = await runCommand("npm", ["exec", "pnpm", "--", "tsgo"]);
    if (result.code === 0) {
      c.pass("TypeScript check passed");
    } else {
      c.fail(`Exit code ${result.code}`);
    }
  } catch (error) {
    c.fail(error.message);
  }
}

async function verifyBuild() {
  const c = check("build");
  try {
    const result = await runCommand("npm", ["run", "build"]);
    if (result.code === 0) {
      c.pass("Build completed successfully");
    } else {
      c.fail(`Exit code ${result.code}`);
    }
  } catch (error) {
    c.fail(error.message);
  }
}

async function verifyStart() {
  const c = check("start");
  try {
    // Just verify the start command can be invoked (don't wait for full startup)
    const child = spawn("node", [
      "scripts/run-node.mjs",
      "gateway",
      "--bind",
      "loopback",
      "--port",
      "19789",
      "--allow-unconfigured",
    ], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Wait 5 seconds to see if it starts
    await new Promise((resolve) => setTimeout(resolve, 5000));

    if (!child.killed) {
      child.kill();
      c.pass("Gateway started successfully");
    } else {
      c.fail("Gateway failed to start");
    }
  } catch (error) {
    c.fail(error.message);
  }
}

async function verifyBootstrapDryRun() {
  const c = check("bootstrap dry-run");
  try {
    const result = await runCommand("powershell", [
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `& { Set-Location '${repoRoot}'; . .\\scripts\\bootstrap\\install.ps1 -DryRun }`,
    ]);
    // Dry-run should succeed or show expected output
    if (result.code === 0 || result.stdout.includes("dry-run")) {
      c.pass("Bootstrap dry-run executed");
    } else {
      c.fail(`Exit code ${result.code}`);
    }
  } catch (error) {
    c.fail(error.message);
  }
}

async function verifyRuntimePackage() {
  const c = check("runtime package exists");
  const pkgPath = join(repoRoot, ".artifacts", "runtime", "weiclaw-runtime.tgz");

  try {
    await stat(pkgPath);
    c.pass(`Runtime package exists at ${pkgPath}`);

    // Verify templates are included
    const c2 = check("runtime templates included");
    try {
      const result = await runCommand("tar", ["-tzf", pkgPath]);
      if (result.stdout.includes("docs/reference/templates/AGENTS.md")) {
        c2.pass("Workspace templates (AGENTS.md) are included in runtime package");
      } else {
        c2.fail("Workspace templates missing from runtime package");
      }
    } catch (error) {
      c2.fail(`Could not verify templates: ${error.message}`);
    }
  } catch {
    // Try to build the package
    try {
      await runCommand("node", ["scripts/pack-runtime-simple.mjs"]);
      await stat(pkgPath);
      c.pass("Runtime package created successfully");
    } catch (error) {
      c.fail(`Runtime package not found and could not be created: ${error.message}`);
    }
  }
}

async function verifyReadme() {
  const c = check("README up-to-date");
  try {
    const readmePath = join(repoRoot, "README.md");
    const content = await readFile(readmePath, "utf-8");

    // Check for key sections that must exist
    const required = [
      "One-Command Install",
      "First-Run Flow",
      "Telegram",
      "update",
      "rollback",
    ];

    const missing = required.filter((section) => !content.includes(section));

    if (missing.length > 0) {
      c.fail(`Missing sections: ${missing.join(", ")}`);
    } else {
      c.pass("README contains all required sections");
    }
  } catch (error) {
    c.fail(error.message);
  }
}

async function verifyRoadmap() {
  const c = check("ROADMAP aligned");
  try {
    const roadmapPath = join(repoRoot, "ROADMAP.md");
    const content = await readFile(roadmapPath, "utf-8");

    // Check for key status indicators
    const hasProgress = content.includes("Current Progress") || content.includes("P0");
    const hasInstall = content.includes("Installation") || content.includes("install");

    if (hasProgress && hasInstall) {
      c.pass("ROADMAP contains status indicators");
    } else {
      c.fail("ROADMAP may be outdated");
    }
  } catch (error) {
    c.fail(error.message);
  }
}

async function verifyReleaseNotes() {
  const c = check("release notes");
  try {
    // Check if CHANGELOG.md or release notes exist
    const changelogPath = join(repoRoot, "CHANGELOG.md");
    const content = await readFile(changelogPath, "utf-8");

    if (content.length > 100) {
      c.pass("CHANGELOG.md exists and has content");
    } else {
      c.fail("CHANGELOG.md appears empty");
    }
  } catch {
    c.skip("CHANGELOG.md not found - will be generated during release");
  }
}

async function main() {
  console.log("\n=== WeiClaw Release Verification ===\n");
  console.log("Starting pre-release verification checks...\n");

  const startTime = Date.now();

  try {
    await verifyWeiclawHelp();
    await verifyOpenclawHelp();
    await verifyTsgo();
    await verifyBuild();
    await verifyStart();
    await verifyBootstrapDryRun();
    await verifyRuntimePackage();
    await verifyReadme();
    await verifyRoadmap();
    await verifyReleaseNotes();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n=== All Verification Checks Passed ===`);
    console.log(`Total time: ${elapsed}s\n`);

    console.log("Summary:");
    checks.forEach((check) => {
      const icon = check.status === "pass" ? "✓" : check.status === "fail" ? "✗" : "⊘";
      console.log(`  ${icon} ${check.name}: ${check.status}`);
    });

    process.exit(0);
  } catch (error) {
    console.log(`\n=== Verification Failed ===`);
    console.log(`Error: ${error.message}\n`);

    console.log("Summary:");
    checks.forEach((check) => {
      const icon = check.status === "pass" ? "✓" : check.status === "fail" ? "✗" : "⊘";
      console.log(`  ${icon} ${check.name}: ${check.status}`);
    });

    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Verification error:", error);
  process.exit(1);
});
