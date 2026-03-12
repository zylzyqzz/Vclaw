import { describe, expect, it } from "vitest";
import { shouldBuildA2ui, shouldSkipMissingA2uiAssets } from "./build-a2ui-gating.ts";

describe("WeiClaw build gating", () => {
  it("skips optional A2UI bundling by default", () => {
    expect(shouldBuildA2ui({} as NodeJS.ProcessEnv)).toBe(false);
    expect(shouldSkipMissingA2uiAssets({} as NodeJS.ProcessEnv)).toBe(true);
  });

  it("enables optional A2UI bundling when WeiClaw UI build is requested", () => {
    const env = { WEICLAW_BUILD_UI: "1" } as NodeJS.ProcessEnv;
    expect(shouldBuildA2ui(env)).toBe(true);
    expect(shouldSkipMissingA2uiAssets(env)).toBe(false);
  });

  it("keeps explicit skip override working", () => {
    const env = {
      WEICLAW_BUILD_UI: "1",
      OPENCLAW_A2UI_SKIP_MISSING: "1",
    } as NodeJS.ProcessEnv;
    expect(shouldSkipMissingA2uiAssets(env)).toBe(true);
  });
});
