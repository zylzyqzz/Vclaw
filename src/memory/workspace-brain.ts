import fs from "node:fs";
import path from "node:path";
import type { MemorySearchConfig, OpenClawConfig } from "../config/config.js";
import type { MemoryConfig } from "../config/types.memory.js";

const WORKSPACE_BRAIN_VERSION = 1;
const WORKSPACE_BRAIN_DIRNAME = path.join(".vclaw", "brain");
const WORKSPACE_BRAIN_MANIFEST_FILENAME = "manifest.json";

export type WorkspaceBrainSkillsState = {
  mode: "workspace";
  count: number;
  names: string[];
  syncedAt: string;
};

export type WorkspaceBrainAgentState = {
  memory?: {
    search?: MemorySearchConfig;
  };
};

export type WorkspaceBrainManifest = {
  version: number;
  generatedAt: string;
  memory?: {
    config?: MemoryConfig;
  };
  agents?: Record<string, WorkspaceBrainAgentState>;
  skills?: WorkspaceBrainSkillsState;
};

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeSkillNames(names: string[] | undefined): string[] {
  if (!names?.length) {
    return [];
  }
  return Array.from(
    new Set(
      names
        .map((name) => name.trim())
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    ),
  );
}

function sanitizeMemoryConfig(memory: MemoryConfig | undefined): MemoryConfig | undefined {
  if (!memory) {
    return undefined;
  }
  return cloneJsonValue(memory);
}

function sanitizeMemorySearchConfig(
  memorySearch: MemorySearchConfig | undefined | null,
): MemorySearchConfig | undefined {
  if (!memorySearch) {
    return undefined;
  }
  const sanitized = cloneJsonValue(memorySearch);
  if (sanitized.remote) {
    delete sanitized.remote.apiKey;
    delete sanitized.remote.headers;
    if (Object.keys(sanitized.remote).length === 0) {
      delete sanitized.remote;
    }
  }
  return sanitized;
}

function sanitizeManifest(
  manifest: WorkspaceBrainManifest | null | undefined,
): WorkspaceBrainManifest | null {
  if (!manifest || typeof manifest !== "object") {
    return null;
  }
  const version =
    typeof manifest.version === "number" && Number.isFinite(manifest.version)
      ? Math.floor(manifest.version)
      : WORKSPACE_BRAIN_VERSION;
  const generatedAt =
    typeof manifest.generatedAt === "string" && manifest.generatedAt.trim()
      ? manifest.generatedAt
      : new Date(0).toISOString();

  const agents: Record<string, WorkspaceBrainAgentState> = {};
  for (const [agentId, state] of Object.entries(manifest.agents ?? {})) {
    const normalizedAgentId = agentId.trim();
    if (!normalizedAgentId || !state || typeof state !== "object") {
      continue;
    }
    const search = sanitizeMemorySearchConfig(state.memory?.search);
    if (search) {
      agents[normalizedAgentId] = { memory: { search } };
    }
  }

  const names = normalizeSkillNames(manifest.skills?.names);
  const skills =
    manifest.skills && names.length > 0
      ? {
          mode: "workspace" as const,
          count:
            typeof manifest.skills.count === "number" && Number.isFinite(manifest.skills.count)
              ? Math.max(0, Math.floor(manifest.skills.count))
              : names.length,
          names,
          syncedAt:
            typeof manifest.skills.syncedAt === "string" && manifest.skills.syncedAt.trim()
              ? manifest.skills.syncedAt
              : generatedAt,
        }
      : undefined;

  const sanitized: WorkspaceBrainManifest = {
    version,
    generatedAt,
  };

  const memoryConfig = sanitizeMemoryConfig(manifest.memory?.config);
  if (memoryConfig) {
    sanitized.memory = { config: memoryConfig };
  }
  if (Object.keys(agents).length > 0) {
    sanitized.agents = agents;
  }
  if (skills) {
    sanitized.skills = skills;
  }

  return sanitized;
}

export function resolveWorkspaceBrainDir(workspaceDir: string): string {
  return path.join(workspaceDir, WORKSPACE_BRAIN_DIRNAME);
}

export function resolveWorkspaceBrainManifestPath(workspaceDir: string): string {
  return path.join(resolveWorkspaceBrainDir(workspaceDir), WORKSPACE_BRAIN_MANIFEST_FILENAME);
}

export function readWorkspaceBrainManifestSync(workspaceDir: string): WorkspaceBrainManifest | null {
  const manifestPath = resolveWorkspaceBrainManifestPath(workspaceDir);
  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const parsed = JSON.parse(raw) as WorkspaceBrainManifest;
    return sanitizeManifest(parsed);
  } catch {
    return null;
  }
}

export async function readWorkspaceBrainManifest(
  workspaceDir: string,
): Promise<WorkspaceBrainManifest | null> {
  return readWorkspaceBrainManifestSync(workspaceDir);
}

export async function writeWorkspaceBrainManifest(params: {
  workspaceDir: string;
  manifest: WorkspaceBrainManifest;
}): Promise<string> {
  const manifestPath = resolveWorkspaceBrainManifestPath(params.workspaceDir);
  const sanitized = sanitizeManifest(params.manifest);
  if (!sanitized) {
    throw new Error("workspace brain manifest is empty");
  }
  await fs.promises.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.promises.writeFile(`${manifestPath}.tmp`, JSON.stringify(sanitized, null, 2) + "\n");
  await fs.promises.rm(manifestPath, { force: true });
  await fs.promises.rename(`${manifestPath}.tmp`, manifestPath);
  return manifestPath;
}

export function resolveWorkspaceBrainMemoryConfig(
  workspaceDir: string,
): OpenClawConfig["memory"] | undefined {
  return readWorkspaceBrainManifestSync(workspaceDir)?.memory?.config;
}

export function resolveWorkspaceBrainMemorySearchConfig(
  workspaceDir: string,
  agentId: string,
): MemorySearchConfig | undefined {
  return readWorkspaceBrainManifestSync(workspaceDir)?.agents?.[agentId]?.memory?.search;
}

export function applyWorkspaceBrainPack(params: {
  current?: WorkspaceBrainManifest | null;
  agentId: string;
  memoryConfig?: MemoryConfig;
  memorySearch?: MemorySearchConfig | null;
  skillNames?: string[];
  generatedAt?: string;
}): WorkspaceBrainManifest {
  const generatedAt = params.generatedAt ?? new Date().toISOString();
  const next = sanitizeManifest(params.current) ?? {
    version: WORKSPACE_BRAIN_VERSION,
    generatedAt,
  };

  next.version = WORKSPACE_BRAIN_VERSION;
  next.generatedAt = generatedAt;

  const sanitizedMemoryConfig = sanitizeMemoryConfig(params.memoryConfig);
  if (sanitizedMemoryConfig) {
    next.memory = { config: sanitizedMemoryConfig };
  }

  const sanitizedMemorySearch = sanitizeMemorySearchConfig(params.memorySearch);
  if (sanitizedMemorySearch) {
    next.agents = { ...(next.agents ?? {}) };
    next.agents[params.agentId] = {
      ...(next.agents[params.agentId] ?? {}),
      memory: {
        ...(next.agents[params.agentId]?.memory ?? {}),
        search: sanitizedMemorySearch,
      },
    };
  }

  const normalizedSkillNames = normalizeSkillNames(params.skillNames);
  if (normalizedSkillNames.length > 0) {
    next.skills = {
      mode: "workspace",
      count: normalizedSkillNames.length,
      names: normalizedSkillNames,
      syncedAt: generatedAt,
    };
  }

  return next;
}
