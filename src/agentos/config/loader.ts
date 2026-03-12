import { existsSync } from "node:fs";
import path from "node:path";
import { defaultDemoPresets } from "../runtime/defaults.js";
import type { OrchestratorConfig } from "../types.js";

export const PREFERRED_AGENTOS_DATA_DIR = ".vclaw";
export const LEGACY_AGENTOS_DATA_DIR = ".weiclaw-agentos";

export function resolveAgentOsDataDir(cwd = process.cwd()): string {
  const preferred = path.join(cwd, PREFERRED_AGENTOS_DATA_DIR);
  if (existsSync(preferred)) {
    return preferred;
  }

  const legacy = path.join(cwd, LEGACY_AGENTOS_DATA_DIR);
  if (existsSync(legacy)) {
    return legacy;
  }

  return preferred;
}

export function defaultOrchestratorConfig(cwd = process.cwd()): OrchestratorConfig {
  const dataDir = resolveAgentOsDataDir(cwd);
  return {
    storagePath: path.join(dataDir, "agentos.db"),
    fallbackPath: path.join(dataDir, "agentos.fallback.json"),
    defaultSessionId: "local-main",
    projectName: "Vclaw",
    logLevel: "info",
    defaultPreset: "default-demo",
    presets: defaultDemoPresets(),
    routing: {
      taskTypeRules: {
        build: { requiredCapabilities: ["build"], preferredRoles: ["builder"] },
        review: { requiredCapabilities: ["review"], preferredRoles: ["reviewer"] },
        research: { requiredCapabilities: ["research"], preferredRoles: ["planner"] },
        qa: { requiredCapabilities: ["qa"], preferredRoles: ["reviewer"] },
      },
      capabilityKeywords: {
        planning: ["plan", "strategy"],
        build: ["build", "implement", "code"],
        review: ["review", "risk"],
        qa: ["test", "quality"],
        ops: ["deploy", "ops"],
        research: ["research", "investigate"],
      },
      weights: {
        requiredCapability: 6,
        preferredRole: 3,
        keywordMatch: 2,
        coordinationConstraint: 1,
      },
      maxDynamicRoles: 4,
    },
  };
}

export function loadOrchestratorConfig(cwd = process.cwd()): OrchestratorConfig {
  return defaultOrchestratorConfig(cwd);
}
