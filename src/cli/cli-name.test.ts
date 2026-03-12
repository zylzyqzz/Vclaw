import { describe, expect, it } from "vitest";
import { replaceCliName, resolveCliName } from "./cli-name.js";

describe("cli name branding", () => {
  it.each([
    ["node", "vclaw"],
    ["node", "weiclaw"],
    ["node", "openclaw"],
    ["node", "openclaw.mjs"],
    ["node", "vclaw.mjs"],
  ])("resolves %s %s to vclaw", (nodeBin, cliBin) => {
    expect(resolveCliName([nodeBin, cliBin])).toBe("vclaw");
  });

  it("replaces legacy command prefixes with vclaw", () => {
    expect(replaceCliName("openclaw update status")).toBe("vclaw update status");
    expect(replaceCliName("weiclaw security audit")).toBe("vclaw security audit");
    expect(replaceCliName("pnpm openclaw status")).toBe("pnpm vclaw status");
  });
});
