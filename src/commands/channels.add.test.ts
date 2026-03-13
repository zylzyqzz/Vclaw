import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setDefaultChannelPluginRegistryForTests } from "./channel-test-helpers.js";
import { configMocks, offsetMocks } from "./channels.mock-harness.js";
import { baseConfigSnapshot, createTestRuntime } from "./test-runtime-config-helpers.js";

const runtime = createTestRuntime();
let channelsAddCommand: typeof import("./channels.js").channelsAddCommand;

describe("channelsAddCommand", () => {
  beforeAll(async () => {
    ({ channelsAddCommand } = await import("./channels.js"));
  });

  beforeEach(async () => {
    vi.stubEnv("OPENCLAW_ENABLE_ALL_CHANNELS", "1");
    configMocks.readConfigFileSnapshot.mockClear();
    configMocks.writeConfigFile.mockClear();
    offsetMocks.deleteTelegramUpdateOffset.mockClear();
    runtime.log.mockClear();
    runtime.error.mockClear();
    runtime.exit.mockClear();
    setDefaultChannelPluginRegistryForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("clears telegram update offsets when the token changes", async () => {
    configMocks.readConfigFileSnapshot.mockResolvedValue({
      ...baseConfigSnapshot,
      config: {
        channels: {
          telegram: { botToken: "old-token", enabled: true },
        },
      },
    });

    await channelsAddCommand(
      { channel: "telegram", account: "default", token: "new-token" },
      runtime,
      { hasFlags: true },
    );

    expect(offsetMocks.deleteTelegramUpdateOffset).toHaveBeenCalledTimes(1);
    expect(offsetMocks.deleteTelegramUpdateOffset).toHaveBeenCalledWith({ accountId: "default" });
  });

  it("does not clear telegram update offsets when the token is unchanged", async () => {
    configMocks.readConfigFileSnapshot.mockResolvedValue({
      ...baseConfigSnapshot,
      config: {
        channels: {
          telegram: { botToken: "same-token", enabled: true },
        },
      },
    });

    await channelsAddCommand(
      { channel: "telegram", account: "default", token: "same-token" },
      runtime,
      { hasFlags: true },
    );

    expect(offsetMocks.deleteTelegramUpdateOffset).not.toHaveBeenCalled();
  });

  it("writes wechat-kf config through the channels add command", async () => {
    configMocks.readConfigFileSnapshot.mockResolvedValue({
      ...baseConfigSnapshot,
      config: {},
    });

    await channelsAddCommand(
      {
        channel: "wechat-kf",
        corpId: "wx1234567890",
        corpSecret: "corp-secret",
        token: "callback-token",
        encodingAesKey: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
        defaultOpenKfId: "wkf_123",
        webhookPath: "/plugins/wechat-kf/default",
        dmPolicy: "pairing",
      },
      runtime,
      { hasFlags: true },
    );

    expect(configMocks.writeConfigFile).toHaveBeenCalledTimes(1);
    expect(configMocks.writeConfigFile).toHaveBeenCalledWith({
      channels: {
        "wechat-kf": {
          enabled: true,
          corpId: "wx1234567890",
          corpSecret: "corp-secret",
          token: "callback-token",
          encodingAesKey: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
          defaultOpenKfId: "wkf_123",
          webhookPath: "/plugins/wechat-kf/default",
          dmPolicy: "pairing",
        },
      },
    });
  });
});
