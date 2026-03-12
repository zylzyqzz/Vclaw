import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const loadConfigMock = vi.fn();

vi.mock("../config/config.js", () => ({
  loadConfig: loadConfigMock,
}));

let formatCliBannerLine: typeof import("./banner.js").formatCliBannerLine;
let formatVclawInstallerLogo: typeof import("./banner.js").formatVclawInstallerLogo;

beforeAll(async () => {
  ({ formatCliBannerLine, formatVclawInstallerLogo } = await import("./banner.js"));
});

beforeEach(() => {
  loadConfigMock.mockReset();
  loadConfigMock.mockReturnValue({});
});

describe("formatCliBannerLine", () => {
  it("hides tagline text when cli.banner.taglineMode is off", () => {
    loadConfigMock.mockReturnValue({
      cli: { banner: { taglineMode: "off" } },
    });

    const line = formatCliBannerLine("2026.3.3", {
      commit: "abc1234",
      richTty: false,
    });

    expect(line).toBe("[V] Vclaw 2026.3.3 (abc1234)");
  });

  it("uses default tagline when cli.banner.taglineMode is default", () => {
    loadConfigMock.mockReturnValue({
      cli: { banner: { taglineMode: "default" } },
    });

    const line = formatCliBannerLine("2026.3.3", {
      commit: "abc1234",
      richTty: false,
    });

    expect(line).toBe("[V] Vclaw 2026.3.3 (abc1234) - Local-first execution on Vclaw.");
  });

  it("prefers explicit tagline mode over config", () => {
    loadConfigMock.mockReturnValue({
      cli: { banner: { taglineMode: "off" } },
    });

    const line = formatCliBannerLine("2026.3.3", {
      commit: "abc1234",
      richTty: false,
      mode: "default",
    });

    expect(line).toBe("[V] Vclaw 2026.3.3 (abc1234) - Local-first execution on Vclaw.");
  });
});

describe("formatVclawInstallerLogo", () => {
  it("renders a short plain installer logo", () => {
    const logo = formatVclawInstallerLogo({ richTty: false });
    expect(logo).toContain("Vclaw");
    expect(logo).toContain("Local-first multi-agent runtime");
  });
});
