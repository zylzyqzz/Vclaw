import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defaultDemoPresets } from "../runtime/defaults.js";
import type { DeerFlowExecutionMode, OrchestratorConfig } from "../types.js";

export const PREFERRED_AGENTOS_DATA_DIR = ".vclaw";

interface DeerFlowRuntimeState {
  enabled?: boolean;
  status?: string;
  repoRoot?: string;
  backendPath?: string;
  configPath?: string;
  pythonBin?: string;
  mode?: DeerFlowExecutionMode;
}

function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function readEnvFlag(...keys: string[]): boolean | undefined {
  const value = readEnv(...keys);
  if (!value) {
    return undefined;
  }
  if (value === "1" || value.toLowerCase() === "true") {
    return true;
  }
  if (value === "0" || value.toLowerCase() === "false") {
    return false;
  }
  return undefined;
}

function resolveExistingDir(candidates: Array<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (existsSync(path.join(candidate, "src", "client.py"))) {
      return candidate;
    }
  }
  return undefined;
}

function readDeerFlowRuntimeState(cwd = process.cwd()): DeerFlowRuntimeState | undefined {
  const runtimePath = path.join(resolveAgentOsDataDir(cwd), "deerflow", "runtime.json");
  if (!existsSync(runtimePath)) {
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(runtimePath, "utf8")) as DeerFlowRuntimeState;
  } catch {
    return undefined;
  }
}

export function resolveDeerFlowBackendPath(cwd = process.cwd()): string | undefined {
  const runtime = readDeerFlowRuntimeState(cwd);
  return resolveExistingDir([
    runtime?.backendPath,
    readEnv(
      "VCLAW_DEERFLOW_BACKEND_PATH",
      "OPENCLAW_AGENTOS_DEERFLOW_BACKEND_PATH",
      "DEERFLOW_BACKEND_PATH",
    ),
    path.join(cwd, ".vclaw", "deerflow", "backend"),
    path.join(cwd, ".vclaw", "vendor", "deer-flow", "backend"),
    path.join(cwd, "vendor", "deer-flow", "backend"),
    path.join(cwd, "..", "deer-flow", "backend"),
    path.join(cwd, "..", "DeerFlow", "backend"),
  ]);
}

export function resolveDeerFlowConfigPath(
  backendPath?: string,
  cwd = process.cwd(),
): string | undefined {
  const runtime = readDeerFlowRuntimeState(cwd);
  const explicit = readEnv(
    "VCLAW_DEERFLOW_CONFIG_PATH",
    "OPENCLAW_AGENTOS_DEERFLOW_CONFIG_PATH",
    "DEER_FLOW_CONFIG_PATH",
  );
  if (explicit) {
    return explicit;
  }
  if (runtime?.configPath && existsSync(runtime.configPath)) {
    return runtime.configPath;
  }
  if (!backendPath) {
    return undefined;
  }
  const rootConfig = path.join(path.dirname(backendPath), "config.yaml");
  return existsSync(rootConfig) ? rootConfig : undefined;
}

function resolveDeerFlowMode(runtime?: DeerFlowRuntimeState): DeerFlowExecutionMode {
  const mode = readEnv(
    "VCLAW_DEERFLOW_MODE",
    "OPENCLAW_AGENTOS_DEERFLOW_MODE",
    "DEERFLOW_MODE",
  )?.toLowerCase() ?? runtime?.mode;
  switch (mode) {
    case "flash":
    case "standard":
    case "pro":
    case "ultra":
      return mode;
    default:
      return "ultra";
  }
}

export function resolveAgentOsDataDir(cwd = process.cwd()): string {
  return path.join(cwd, PREFERRED_AGENTOS_DATA_DIR);
}

export function defaultOrchestratorConfig(cwd = process.cwd()): OrchestratorConfig {
  const dataDir = resolveAgentOsDataDir(cwd);
  const deerflowRuntime = readDeerFlowRuntimeState(cwd);
  const deerflowBackendPath = resolveDeerFlowBackendPath(cwd);
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
    deerflow: {
      enabled:
        readEnvFlag("VCLAW_DEERFLOW_ENABLED", "OPENCLAW_AGENTOS_DEERFLOW_ENABLED") ??
        deerflowRuntime?.enabled ??
        false,
      timeoutMs: Number(
        readEnv("VCLAW_DEERFLOW_TIMEOUT_MS", "OPENCLAW_AGENTOS_DEERFLOW_TIMEOUT_MS") ?? "600000",
      ),
      mode: resolveDeerFlowMode(deerflowRuntime),
      threadPrefix: "vclaw",
      route: {
        taskTypes: ["research", "report", "market-research", "competitive-analysis"],
        requiredCapabilities: ["research"],
        goalKeywords: [
          "research",
          "investigate",
          "analysis",
          "benchmark",
          "compare",
          "competitive",
          "report",
          "synthesis",
        ],
      },
      embedded: {
        pythonBin:
          readEnv("VCLAW_DEERFLOW_PYTHON_BIN", "OPENCLAW_AGENTOS_DEERFLOW_PYTHON_BIN") ??
          deerflowRuntime?.pythonBin ??
          "python",
        backendPath: deerflowBackendPath,
        configPath: resolveDeerFlowConfigPath(deerflowBackendPath, cwd),
        modelName: readEnv(
          "VCLAW_DEERFLOW_MODEL_NAME",
          "OPENCLAW_AGENTOS_DEERFLOW_MODEL_NAME",
          "DEERFLOW_MODEL_NAME",
        ),
      },
    },
  };
}

export function loadOrchestratorConfig(cwd = process.cwd()): OrchestratorConfig {
  return defaultOrchestratorConfig(cwd);
}
