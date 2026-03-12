import type { OpenClawConfig } from "../config/config.js";
import type { DmScope } from "../config/types.base.js";
import type { ToolProfileId } from "../config/types.tools.js";

export const ONBOARDING_DEFAULT_DM_SCOPE: DmScope = "per-channel-peer";
export const ONBOARDING_DEFAULT_TOOLS_PROFILE: ToolProfileId = "coding";

function mergeUniqueStrings(existing: string[] | undefined, additions: string[]): string[] {
  return [...new Set([...(existing ?? []), ...additions])];
}

export function applyOnboardingLocalWorkspaceConfig(
  baseConfig: OpenClawConfig,
  workspaceDir: string,
): OpenClawConfig {
  const toolsAlsoAllow = mergeUniqueStrings(baseConfig.tools?.alsoAllow, [
    "gateway",
    "web_fetch",
    "web_search",
  ]);
  return {
    ...baseConfig,
    agents: {
      ...baseConfig.agents,
      defaults: {
        ...baseConfig.agents?.defaults,
        workspace: workspaceDir,
        sandbox: {
          ...baseConfig.agents?.defaults?.sandbox,
          mode: baseConfig.agents?.defaults?.sandbox?.mode ?? "off",
        },
      },
    },
    gateway: {
      ...baseConfig.gateway,
      mode: "local",
      auth: {
        ...baseConfig.gateway?.auth,
        mode: baseConfig.gateway?.auth?.mode ?? "none",
      },
      controlUi: {
        ...baseConfig.gateway?.controlUi,
        enabled: baseConfig.gateway?.controlUi?.enabled ?? false,
        allowInsecureAuth: baseConfig.gateway?.controlUi?.allowInsecureAuth ?? true,
        dangerouslyDisableDeviceAuth:
          baseConfig.gateway?.controlUi?.dangerouslyDisableDeviceAuth ?? true,
      },
    },
    browser: {
      ...baseConfig.browser,
      enabled: baseConfig.browser?.enabled ?? false,
    },
    session: {
      ...baseConfig.session,
      dmScope: baseConfig.session?.dmScope ?? ONBOARDING_DEFAULT_DM_SCOPE,
    },
    tools: {
      ...baseConfig.tools,
      profile: baseConfig.tools?.profile ?? ONBOARDING_DEFAULT_TOOLS_PROFILE,
      alsoAllow: toolsAlsoAllow,
      fs: {
        ...baseConfig.tools?.fs,
        workspaceOnly: baseConfig.tools?.fs?.workspaceOnly ?? false,
      },
      exec: {
        ...baseConfig.tools?.exec,
        host: baseConfig.tools?.exec?.host ?? "gateway",
        security: baseConfig.tools?.exec?.security ?? "full",
        ask: baseConfig.tools?.exec?.ask ?? "off",
        applyPatch: {
          ...baseConfig.tools?.exec?.applyPatch,
          enabled: baseConfig.tools?.exec?.applyPatch?.enabled ?? true,
          workspaceOnly: baseConfig.tools?.exec?.applyPatch?.workspaceOnly ?? false,
        },
      },
    },
    channels: {
      ...baseConfig.channels,
      telegram: {
        ...baseConfig.channels?.telegram,
        dmPolicy: baseConfig.channels?.telegram?.dmPolicy ?? "open",
        allowFrom: baseConfig.channels?.telegram?.allowFrom ?? ["*"],
        groupPolicy: baseConfig.channels?.telegram?.groupPolicy ?? "open",
        groupAllowFrom: baseConfig.channels?.telegram?.groupAllowFrom ?? ["*"],
      },
    },
  };
}
