import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

function runCli(cwd: string, args: string[]) {
  const repoRoot = path.resolve(".");
  const script = path.join(repoRoot, "src/cli/agentos.ts");
  const tsxLoader = pathToFileURL(path.join(repoRoot, "node_modules/tsx/dist/loader.mjs")).href;
  return spawnSync("node", ["--import", tsxLoader, script, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
  });
}

describe("README smoke path", () => {
  it("runs key onboarding commands from README", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentos-readme-smoke-"));
    try {
      const demo = runCli(root, ["demo"]);
      expect(demo.status).toBe(0);
      expect(demo.stdout).toContain("routeSummary:");

      const listRoles = runCli(root, ["list-roles"]);
      expect(listRoles.status).toBe(0);

      const listPresets = runCli(root, ["list-presets"]);
      expect(listPresets.status).toBe(0);

      const runJson = runCli(root, [
        "run",
        "--goal",
        "generate release checklist",
        "--preset",
        "default-demo",
        "--json",
      ]);
      expect(runJson.status).toBe(0);
      const runObj = JSON.parse(runJson.stdout);
      expect(runObj.ok).toBe(true);
      expect(runObj.command).toBe("run");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
