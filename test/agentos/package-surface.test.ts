import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("published package surface", () => {
  it("keeps the Vclaw-first CLI aliases and the hidden OpenClaw compatibility alias wired correctly", async () => {
    const packageJsonPath = path.resolve("package.json");
    const raw = await readFile(packageJsonPath, "utf8");
    const pkg = JSON.parse(raw) as {
      bin?: Record<string, string>;
      scripts?: Record<string, string>;
    };

    expect(pkg.bin).toMatchObject({
      vclaw: "vclaw.mjs",
      agentos: "vclaw.mjs",
      openclaw: "openclaw.mjs",
    });

    expect(pkg.scripts).toMatchObject({
      agentos: "node --import tsx src/cli/agentos.ts",
      "vclaw:agentos": "node --import tsx src/cli/agentos.ts",
      vclaw: "node scripts/run-node.mjs",
    });
  });
});
