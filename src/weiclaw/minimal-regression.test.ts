import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listChannelPlugins } from "../channels/plugins/index.js";
import type { ChannelPlugin } from "../channels/plugins/types.js";
import { ONBOARD_PROVIDER_AUTH_FLAGS } from "../commands/onboard-provider-auth-flags.js";
import { listChannelOnboardingAdapters } from "../commands/onboarding/registry.js";
import { formatAuthChoiceChoicesForCli } from "../commands/auth-choice-options.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { createChannelTestPluginBase, createTestRegistry } from "../test-utils/channel-plugins.js";
import { withEnvAsync } from "../test-utils/env.js";
import { registerNodesCli } from "../cli/nodes-cli/register.js";
import { getCoreCliCommandNames } from "../cli/program/command-registry.js";
import { getSubCliEntries } from "../cli/program/register.subclis.js";

const EMPTY_REGISTRY = createTestRegistry([]);

function createPlugin(id: string): ChannelPlugin {
  return {
    ...createChannelTestPluginBase({ id: id as ChannelPlugin["id"] }),
    onboarding: {
      channel: id as never,
      getStatus: async () => ({
        channel: id as never,
        configured: false,
        statusLines: [],
      }),
      configure: async ({ cfg }) => ({ cfg }),
    },
  };
}

describe("WeiClaw minimal regression guardrails", () => {
  beforeEach(() => {
    setActivePluginRegistry(EMPTY_REGISTRY);
  });

  afterEach(() => {
    setActivePluginRegistry(EMPTY_REGISTRY);
  });

  it("defaults channel exposure to telegram only", () => {
    const registry = createTestRegistry([
      { pluginId: "slack", plugin: createPlugin("slack"), source: "test" },
      { pluginId: "telegram", plugin: createPlugin("telegram"), source: "test" },
    ]);
    setActivePluginRegistry(registry, "weiclaw-defaults");

    expect(listChannelPlugins().map((plugin) => plugin.id)).toEqual(["telegram"]);
  });

  it("can re-enable all channels via env override", async () => {
    const registry = createTestRegistry([
      { pluginId: "slack", plugin: createPlugin("slack"), source: "test" },
      { pluginId: "telegram", plugin: createPlugin("telegram"), source: "test" },
    ]);
    setActivePluginRegistry(registry, "weiclaw-defaults");

    await withEnvAsync({ WEICLAW_ENABLE_ALL_CHANNELS: "1" }, async () => {
      expect(listChannelPlugins().map((plugin) => plugin.id).toSorted()).toEqual([
        "slack",
        "telegram",
      ]);
    });
  });

  it("defaults onboarding adapters to telegram only", () => {
    const registry = createTestRegistry([
      { pluginId: "slack", plugin: createPlugin("slack"), source: "test" },
      { pluginId: "telegram", plugin: createPlugin("telegram"), source: "test" },
    ]);
    setActivePluginRegistry(registry, "weiclaw-defaults");

    expect(listChannelOnboardingAdapters().map((adapter) => adapter.channel)).toEqual(["telegram"]);
  });

  it("keeps onboarding auth choices focused on OpenAI-compatible paths", () => {
    expect(formatAuthChoiceChoicesForCli()).toBe("openai-api-key|litellm-api-key|skip");
    expect(ONBOARD_PROVIDER_AUTH_FLAGS.map((flag) => flag.authChoice)).toEqual([
      "openai-api-key",
      "litellm-api-key",
    ]);
  });

  it("keeps required core/subcli entrypoints registered", () => {
    const core = getCoreCliCommandNames();
    const sub = getSubCliEntries().map((entry) => entry.name);

    expect(core).toEqual(expect.arrayContaining(["setup", "onboard", "status"]));
    expect(core).not.toContain("dashboard");
    expect(sub).toEqual(expect.arrayContaining(["tui", "channels", "skills", "cron"]));
    expect(sub).not.toContain("browser");
  });

  it("keeps default build detached from optional UI bundle steps", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
      bin?: Record<string, string>;
      files?: string[];
    };
    const build = packageJson.scripts?.build ?? "";
    const strictSmoke = packageJson.scripts?.["build:strict-smoke"] ?? "";
    const bundle = packageJson.scripts?.["canvas:a2ui:bundle"] ?? "";
    const runtimePack = packageJson.scripts?.["runtime:pack"] ?? "";
    const start = packageJson.scripts?.start ?? "";
    const openclawScript = packageJson.scripts?.openclaw ?? "";
    const weiclawScript = packageJson.scripts?.weiclaw ?? "";
    const weiclawBin = packageJson.bin?.weiclaw ?? "";
    const files = packageJson.files ?? [];

    expect(build).not.toContain("bash scripts/bundle-a2ui.sh");
    expect(build).toContain("node --import tsx scripts/build-a2ui-if-enabled.ts");
    expect(strictSmoke).not.toContain("canvas:a2ui:bundle");
    expect(bundle).toBe("node scripts/build-a2ui.mjs");
    expect(runtimePack).toBe("node scripts/pack-runtime.mjs");
    expect(start).toContain("gateway");
    expect(start).toContain("--bind loopback");
    expect(start).toContain("--port 19789");
    expect(start).toContain("--allow-unconfigured");
    expect(start).not.toContain("--host");
    expect(weiclawScript).toBe(openclawScript);
    expect(weiclawBin).toBe("openclaw.mjs");
    expect(files).toEqual(expect.arrayContaining(["dist/", "extensions/telegram/", "skills/"]));
    expect(files).not.toEqual(expect.arrayContaining(["docs/", "assets/", "extensions/feishu/"]));
  });

  it("keeps runtime delivery and bootstrap installer entrypoints aligned", () => {
    const readme = fs.readFileSync(path.resolve(process.cwd(), "README.md"), "utf8");
    const installSh = path.resolve(process.cwd(), "scripts/bootstrap/install.sh");
    const installPs1 = path.resolve(process.cwd(), "scripts/bootstrap/install.ps1");
    const roadmap = path.resolve(process.cwd(), "ROADMAP.md");

    expect(fs.existsSync(installSh)).toBe(true);
    expect(fs.existsSync(installPs1)).toBe(true);
    expect(fs.existsSync(roadmap)).toBe(true);
    expect(readme).toContain("scripts/bootstrap/install.sh");
    expect(readme).toContain("scripts/bootstrap/install.ps1");
    expect(readme).toContain("weiclaw setup --bootstrap");
    expect(readme).toContain("Telegram");
    expect(readme).toContain("Feishu");
  });

  it("disables nodes media/canvas commands by default and allows opt-in", async () => {
    const baseProgram = new Command();
    registerNodesCli(baseProgram);
    const nodes = baseProgram.commands.find((entry) => entry.name() === "nodes");
    expect(nodes).toBeDefined();
    const baseSubcommands = nodes?.commands.map((entry) => entry.name()) ?? [];
    expect(baseSubcommands).not.toEqual(expect.arrayContaining(["canvas", "camera", "screen"]));

    await withEnvAsync({ WEICLAW_ENABLE_NODE_MEDIA: "1" }, async () => {
      const mediaProgram = new Command();
      registerNodesCli(mediaProgram);
      const mediaNodes = mediaProgram.commands.find((entry) => entry.name() === "nodes");
      const mediaSubcommands = mediaNodes?.commands.map((entry) => entry.name()) ?? [];
      expect(mediaSubcommands).toEqual(expect.arrayContaining(["canvas", "camera", "screen"]));
    });
  });
});
