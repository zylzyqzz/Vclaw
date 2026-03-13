import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { wechatKfPlugin } from "../../extensions/wechat-kf/src/channel.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { createTestRegistry } from "../test-utils/channel-plugins.js";
import { formatGatewayChannelsStatusLines } from "./channels/status.js";

describe("channels command", () => {
  beforeEach(() => {
    setActivePluginRegistry(
      createTestRegistry([{ pluginId: "wechat-kf", source: "test", plugin: wechatKfPlugin }]),
    );
  });

  afterEach(() => {
    setActivePluginRegistry(createTestRegistry([]));
  });

  it("surfaces WeChat KF callback readiness warnings in channels status output", () => {
    const lines = formatGatewayChannelsStatusLines({
      channelAccounts: {
        "wechat-kf": [
          {
            accountId: "default",
            enabled: true,
            configured: true,
            running: true,
            mode: "webhook",
            webhookPath: "/plugins/wechat-kf/default",
          },
        ],
      },
    });
    expect(lines.join("\n")).toMatch(/Warnings:/);
    expect(lines.join("\n")).toMatch(/wechat-kf default/i);
    expect(lines.join("\n")).toMatch(/mode:webhook/i);
    expect(lines.join("\n")).toMatch(/webhookUrl is missing/i);
  });
});
