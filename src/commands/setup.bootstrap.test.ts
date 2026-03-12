import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWizardPrompter } from "../../test/helpers/wizard-prompter.js";

const writeConfigFile = vi.hoisted(() => vi.fn(async () => {}));
const ensureAgentWorkspace = vi.hoisted(() => vi.fn(async () => ({ dir: "/tmp/workspace" })));
const installPluginFromNpmSpec = vi.hoisted(() =>
  vi.fn(async () => ({
    ok: true,
    pluginId: "feishu",
    targetDir: "/tmp/feishu",
    extensions: [],
  })),
);
const runTui = vi.hoisted(() => vi.fn(async () => {}));
const probeGatewayReachable = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
const resolveOpenClawPackageRoot = vi.hoisted(() => vi.fn(async () => "/repo"));
const mkdirMock = vi.hoisted(() => vi.fn(async () => {}));
const setQianfanApiKey = vi.hoisted(() => vi.fn());
const setMoonshotApiKey = vi.hoisted(() => vi.fn(async () => {}));
const setKimiCodingApiKey = vi.hoisted(() => vi.fn(async () => {}));
const spawnMock = vi.hoisted(() =>
  vi.fn(() => ({
    unref: vi.fn(),
  })),
);

vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: mkdirMock,
  },
}));

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    createConfigIO: vi.fn(() => ({ configPath: "/tmp/.openclaw/openclaw.json" })),
    writeConfigFile,
  };
});

vi.mock("../agents/workspace.js", () => ({
  DEFAULT_AGENT_WORKSPACE_DIR: "/tmp/workspace",
  ensureAgentWorkspace,
}));

vi.mock("../config/sessions.js", () => ({
  resolveSessionTranscriptsDir: vi.fn(() => "/tmp/.openclaw/sessions"),
}));

vi.mock("./onboard-auth.js", () => ({
  applyQianfanConfig: vi.fn((cfg) => ({
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        model: { primary: "qianfan/deepseek-v3.2" },
      },
    },
  })),
  applyQianfanProviderConfig: vi.fn((cfg) => cfg),
  applyKimiCodeConfig: vi.fn((cfg) => ({
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        model: { primary: "kimi-coding/k2p5" },
      },
    },
  })),
  applyKimiCodeProviderConfig: vi.fn((cfg) => cfg),
  applyMoonshotConfig: vi.fn((cfg) => ({
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        model: { primary: "moonshot/kimi-k2.5" },
      },
    },
  })),
  applyMoonshotProviderConfig: vi.fn((cfg) => cfg),
  setQianfanApiKey,
  setMoonshotApiKey,
  setKimiCodingApiKey,
}));

describe("runSetupBootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    writeConfigFile.mockClear();
    ensureAgentWorkspace.mockClear();
    installPluginFromNpmSpec.mockClear();
    runTui.mockClear();
    probeGatewayReachable.mockClear();
    resolveOpenClawPackageRoot.mockClear();
    mkdirMock.mockClear();
    setQianfanApiKey.mockClear();
    setMoonshotApiKey.mockClear();
    setKimiCodingApiKey.mockClear();
    spawnMock.mockClear();
  });

  it("writes a Telegram-first minimal config without installing Feishu", async () => {
    const selections = ["qianfan", "telegram"];
    const texts = ["", "123456:telegram-token"];
    const prompter = createWizardPrompter({
      intro: vi.fn(async () => {}),
      outro: vi.fn(async () => {}),
      select: vi.fn(async () => selections.shift()) as never,
      text: vi.fn(async () => texts.shift() ?? "") as never,
    });

    const { runSetupBootstrap } = await import("./setup-bootstrap.js");
    await runSetupBootstrap(
      { skipTui: true },
      {
        log: vi.fn(),
        error: vi.fn(),
        exit: vi.fn(),
      },
      {
        createPrompter: () => prompter,
        installPluginFromNpmSpec: installPluginFromNpmSpec as never,
        runTui,
        probeGatewayReachable,
        resolveOpenClawPackageRoot,
        spawn: spawnMock as never,
      },
    );

    expect(installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(setQianfanApiKey).not.toHaveBeenCalled();
    expect(writeConfigFile).toHaveBeenCalledWith(
      expect.objectContaining({
        gateway: expect.objectContaining({
          mode: "local",
          port: 19789,
          bind: "loopback",
          controlUi: expect.objectContaining({ enabled: false }),
        }),
        agents: expect.objectContaining({
          defaults: expect.objectContaining({
            model: { primary: "qianfan/deepseek-v3.2" },
          }),
        }),
        channels: expect.objectContaining({
          telegram: expect.objectContaining({
            enabled: true,
            botToken: "123456:telegram-token",
          }),
        }),
      }),
    );
  });

  it("installs Feishu on demand and can open TUI", async () => {
    const selections = ["moonshot", "feishu"];
    const texts = ["", "cli_app_id", "cli_app_secret"];
    const confirms = [true];
    const prompter = createWizardPrompter({
      intro: vi.fn(async () => {}),
      outro: vi.fn(async () => {}),
      select: vi.fn(async () => selections.shift()) as never,
      text: vi.fn(async () => texts.shift() ?? "") as never,
      confirm: vi.fn(async () => confirms.shift() ?? false),
      note: vi.fn(async () => {}),
    });
    probeGatewayReachable
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });

    const { runSetupBootstrap } = await import("./setup-bootstrap.js");
    await runSetupBootstrap(
      {},
      {
        log: vi.fn(),
        error: vi.fn(),
        exit: vi.fn(),
      },
      {
        createPrompter: () => prompter,
        installPluginFromNpmSpec: installPluginFromNpmSpec as never,
        runTui,
        probeGatewayReachable,
        resolveOpenClawPackageRoot,
        spawn: spawnMock as never,
        sleep: async () => {},
      },
    );

    expect(installPluginFromNpmSpec).toHaveBeenCalledWith(
      expect.objectContaining({ spec: "@openclaw/feishu" }),
    );
    expect(setMoonshotApiKey).not.toHaveBeenCalled();
    expect(spawnMock).toHaveBeenCalled();
    expect(runTui).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "ws://127.0.0.1:19789",
        deliver: false,
      }),
    );
    expect(writeConfigFile).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: expect.objectContaining({
          feishu: expect.objectContaining({
            enabled: true,
            appId: "cli_app_id",
            appSecret: "cli_app_secret",
          }),
        }),
      }),
    );
  });
});
