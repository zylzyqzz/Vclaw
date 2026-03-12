import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { createOpenClawCodingTools } from "../agents/pi-tools.js";
import { normalizeToolName } from "../agents/tool-policy-shared.js";
import { createOpenClawTools } from "../agents/openclaw-tools.js";
import { applyOpenAIConfig, OPENAI_DEFAULT_MODEL } from "../commands/openai-model-default.js";
import { LITELLM_DEFAULT_MODEL_REF } from "../commands/onboard-auth.credentials.js";
import { applyLitellmConfig, LITELLM_BASE_URL } from "../commands/onboard-auth.config-litellm.js";
import { registerCronCli } from "../cli/cron-cli/register.js";
import { resolveTelegramAccount } from "../telegram/accounts.js";

describe("WeiClaw minimal usable closure", () => {
  it("normalizes shell/file/http aliases to core skill tools", () => {
    expect(normalizeToolName("shell_command")).toBe("exec");
    expect(normalizeToolName("file_read")).toBe("read");
    expect(normalizeToolName("file_write")).toBe("write");
    expect(normalizeToolName("http_request")).toBe("web_fetch");
  });

  it("keeps core execution tools available for Telegram sessions", () => {
    const tools = createOpenClawCodingTools({
      workspaceDir: process.cwd(),
      messageProvider: "telegram",
      config: {},
    });
    const names = new Set(tools.map((tool) => tool.name));
    expect([...names]).toEqual(expect.arrayContaining(["exec", "read", "write", "web_fetch"]));
    expect(names.has("browser")).toBe(false);
  });

  it("keeps cron tool available in the core OpenClaw tool set", () => {
    const tools = createOpenClawTools({
      agentSessionKey: "agent:main:main",
      agentChannel: "telegram",
      config: {},
    });
    expect(tools.map((tool) => tool.name)).toContain("cron");
  });

  it("keeps Telegram minimal config path resolvable", () => {
    const account = resolveTelegramAccount({
      cfg: {
        channels: {
          telegram: {
            enabled: true,
            botToken: "123456:fake-token",
          },
        },
      },
    });
    expect(account.enabled).toBe(true);
    expect(account.token).toBe("123456:fake-token");
    expect(account.tokenSource).toBe("config");
  });

  it("keeps OpenAI-compatible config path runnable for openai and litellm", () => {
    const openaiCfg = applyOpenAIConfig({});
    expect(openaiCfg.agents?.defaults?.model).toEqual({ primary: OPENAI_DEFAULT_MODEL });
    expect(openaiCfg.agents?.defaults?.models?.[OPENAI_DEFAULT_MODEL]).toBeDefined();

    const litellmCfg = applyLitellmConfig({});
    expect(litellmCfg.agents?.defaults?.model).toEqual({ primary: LITELLM_DEFAULT_MODEL_REF });
    expect(litellmCfg.models?.providers?.litellm?.api).toBe("openai-completions");
    expect(litellmCfg.models?.providers?.litellm?.baseUrl).toBe(LITELLM_BASE_URL);
  });

  it("keeps scheduler create/list/enable/disable command chain registered", () => {
    const program = new Command();
    registerCronCli(program);
    const cron = program.commands.find((entry) => entry.name() === "cron");
    expect(cron).toBeDefined();
    const subcommands = new Set(cron?.commands.map((entry) => entry.name()) ?? []);
    expect([...subcommands]).toEqual(
      expect.arrayContaining(["status", "list", "add", "enable", "disable"]),
    );
  });
});
