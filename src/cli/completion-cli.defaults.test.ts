import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isCompletionInstalled, resolveCompletionCachePath, usesSlowDynamicCompletion } from "./completion-cli.js";

const originalHome = process.env.HOME;

describe("completion cli defaults", () => {
  afterEach(async () => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  });

  it("falls back to vclaw for unnamed completion cache files", () => {
    const result = resolveCompletionCachePath("zsh", "");
    expect(result).toMatch(/[\\/]vclaw\.zsh$/);
  });

  it("recognizes a legacy WeiClaw completion header as installed", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "vclaw-completion-legacy-"));
    process.env.HOME = root;
    await fs.writeFile(path.join(root, ".zshrc"), '# WeiClaw Completion\nsource "/tmp/openclaw.zsh"\n', "utf8");

    await expect(isCompletionInstalled("zsh")).resolves.toBe(true);
  });

  it("detects legacy dynamic completion lines for migration", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "vclaw-completion-dynamic-"));
    process.env.HOME = root;
    await fs.writeFile(
      path.join(root, ".zshrc"),
      'source <(openclaw completion --shell zsh)\n',
      "utf8",
    );

    await expect(usesSlowDynamicCompletion("zsh")).resolves.toBe(true);
  });
});
