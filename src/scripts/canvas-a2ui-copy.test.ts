import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shouldSkipMissingA2uiAssets } from "./build-a2ui-gating.ts";
import { copyA2uiAssets } from "../../scripts/canvas-a2ui-copy.js";

describe("canvas a2ui copy", () => {
  async function withA2uiFixture(run: (dir: string) => Promise<void>) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-a2ui-"));
    try {
      await run(dir);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }

  it("skips missing assets by default for the UI-free WeiClaw build", async () => {
    await withA2uiFixture(async (dir) => {
      await expect(
        copyA2uiAssets({ srcDir: dir, outDir: path.join(dir, "out") }),
      ).resolves.toBeUndefined();
    });
  });

  it("can still enforce missing assets when optional UI build is explicitly enabled", async () => {
    await withA2uiFixture(async (dir) => {
      const previous = process.env.WEICLAW_BUILD_UI;
      process.env.WEICLAW_BUILD_UI = "1";
      try {
        await expect(
          copyA2uiAssets({ srcDir: dir, outDir: path.join(dir, "out") }),
        ).rejects.toThrow('Run "pnpm canvas:a2ui:bundle"');
      } finally {
        if (previous === undefined) {
          delete process.env.WEICLAW_BUILD_UI;
        } else {
          process.env.WEICLAW_BUILD_UI = previous;
        }
      }
    });
  });

  it("skips missing assets when OPENCLAW_A2UI_SKIP_MISSING=1", async () => {
    await withA2uiFixture(async (dir) => {
      const previous = process.env.OPENCLAW_A2UI_SKIP_MISSING;
      process.env.OPENCLAW_A2UI_SKIP_MISSING = "1";
      try {
        await expect(
          copyA2uiAssets({ srcDir: dir, outDir: path.join(dir, "out") }),
        ).resolves.toBeUndefined();
      } finally {
        if (previous === undefined) {
          delete process.env.OPENCLAW_A2UI_SKIP_MISSING;
        } else {
          process.env.OPENCLAW_A2UI_SKIP_MISSING = previous;
        }
      }
    });
  });

  it("copies bundled assets to dist", async () => {
    await withA2uiFixture(async (dir) => {
      const srcDir = path.join(dir, "src");
      const outDir = path.join(dir, "dist");
      await fs.mkdir(srcDir, { recursive: true });
      await fs.writeFile(path.join(srcDir, "index.html"), "<html></html>", "utf8");
      await fs.writeFile(path.join(srcDir, "a2ui.bundle.js"), "console.log(1);", "utf8");

      await copyA2uiAssets({ srcDir, outDir });

      await expect(fs.stat(path.join(outDir, "index.html"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(outDir, "a2ui.bundle.js"))).resolves.toBeTruthy();
    });
  });

  it("reports default skip policy correctly", () => {
    expect(shouldSkipMissingA2uiAssets({} as NodeJS.ProcessEnv)).toBe(true);
    expect(shouldSkipMissingA2uiAssets({ WEICLAW_BUILD_UI: "1" } as NodeJS.ProcessEnv)).toBe(
      false,
    );
  });
});
