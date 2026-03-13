import os from "node:os";
import path from "node:path";
import type { OpenClawConfig, MemorySearchConfig } from "../config/config.js";
import { resolveStateDir } from "../config/paths.js";
import type { SecretInput } from "../config/types.secrets.js";
import { resolveWorkspaceBrainMemorySearchConfig } from "../memory/workspace-brain.js";
import { clampInt, clampNumber, resolveUserPath } from "../utils.js";
import { resolveAgentConfig, resolveAgentWorkspaceDir } from "./agent-scope.js";

export type ResolvedMemorySearchConfig = {
  enabled: boolean;
  sources: Array<"memory" | "sessions">;
  extraPaths: string[];
  provider: "openai" | "local" | "gemini" | "voyage" | "mistral" | "ollama" | "auto";
  remote?: {
    baseUrl?: string;
    apiKey?: SecretInput;
    headers?: Record<string, string>;
    batch?: {
      enabled: boolean;
      wait: boolean;
      concurrency: number;
      pollIntervalMs: number;
      timeoutMinutes: number;
    };
  };
  experimental: {
    sessionMemory: boolean;
  };
  fallback: "openai" | "gemini" | "local" | "voyage" | "mistral" | "ollama" | "none";
  model: string;
  local: {
    modelPath?: string;
    modelCacheDir?: string;
  };
  store: {
    driver: "sqlite";
    path: string;
    vector: {
      enabled: boolean;
      extensionPath?: string;
    };
  };
  chunking: {
    tokens: number;
    overlap: number;
  };
  sync: {
    onSessionStart: boolean;
    onSearch: boolean;
    watch: boolean;
    watchDebounceMs: number;
    intervalMinutes: number;
    sessions: {
      deltaBytes: number;
      deltaMessages: number;
    };
  };
  query: {
    maxResults: number;
    minScore: number;
    hybrid: {
      enabled: boolean;
      vectorWeight: number;
      textWeight: number;
      candidateMultiplier: number;
      mmr: {
        enabled: boolean;
        lambda: number;
      };
      temporalDecay: {
        enabled: boolean;
        halfLifeDays: number;
      };
    };
  };
  cache: {
    enabled: boolean;
    maxEntries?: number;
  };
};

const DEFAULT_OPENAI_MODEL = "text-embedding-3-small";
const DEFAULT_GEMINI_MODEL = "gemini-embedding-001";
const DEFAULT_VOYAGE_MODEL = "voyage-4-large";
const DEFAULT_MISTRAL_MODEL = "mistral-embed";
const DEFAULT_OLLAMA_MODEL = "nomic-embed-text";
const DEFAULT_CHUNK_TOKENS = 400;
const DEFAULT_CHUNK_OVERLAP = 80;
const DEFAULT_WATCH_DEBOUNCE_MS = 1500;
const DEFAULT_SESSION_DELTA_BYTES = 100_000;
const DEFAULT_SESSION_DELTA_MESSAGES = 50;
const DEFAULT_MAX_RESULTS = 6;
const DEFAULT_MIN_SCORE = 0.35;
const DEFAULT_HYBRID_ENABLED = true;
const DEFAULT_HYBRID_VECTOR_WEIGHT = 0.7;
const DEFAULT_HYBRID_TEXT_WEIGHT = 0.3;
const DEFAULT_HYBRID_CANDIDATE_MULTIPLIER = 4;
const DEFAULT_MMR_ENABLED = false;
const DEFAULT_MMR_LAMBDA = 0.7;
const DEFAULT_TEMPORAL_DECAY_ENABLED = false;
const DEFAULT_TEMPORAL_DECAY_HALF_LIFE_DAYS = 30;
const DEFAULT_CACHE_ENABLED = true;
const DEFAULT_SOURCES: Array<"memory" | "sessions"> = ["memory"];

function mergeMemorySearchRemoteConfig(
  defaults: MemorySearchConfig["remote"],
  overrides: MemorySearchConfig["remote"],
): MemorySearchConfig["remote"] | undefined {
  if (!defaults && !overrides) {
    return undefined;
  }
  const batch =
    defaults?.batch || overrides?.batch
      ? {
          enabled: overrides?.batch?.enabled ?? defaults?.batch?.enabled,
          wait: overrides?.batch?.wait ?? defaults?.batch?.wait,
          concurrency: overrides?.batch?.concurrency ?? defaults?.batch?.concurrency,
          pollIntervalMs: overrides?.batch?.pollIntervalMs ?? defaults?.batch?.pollIntervalMs,
          timeoutMinutes: overrides?.batch?.timeoutMinutes ?? defaults?.batch?.timeoutMinutes,
        }
      : undefined;
  return {
    baseUrl: overrides?.baseUrl ?? defaults?.baseUrl,
    apiKey: overrides?.apiKey ?? defaults?.apiKey,
    headers: overrides?.headers ?? defaults?.headers,
    ...(batch ? { batch } : {}),
  };
}

function mergeMemorySearchStoreConfig(
  defaults: MemorySearchConfig["store"],
  overrides: MemorySearchConfig["store"],
): MemorySearchConfig["store"] | undefined {
  if (!defaults && !overrides) {
    return undefined;
  }
  const vector =
    defaults?.vector || overrides?.vector
      ? {
          enabled: overrides?.vector?.enabled ?? defaults?.vector?.enabled,
          extensionPath: overrides?.vector?.extensionPath ?? defaults?.vector?.extensionPath,
        }
      : undefined;
  const cache =
    defaults?.cache || overrides?.cache
      ? {
          enabled: overrides?.cache?.enabled ?? defaults?.cache?.enabled,
          maxEntries: overrides?.cache?.maxEntries ?? defaults?.cache?.maxEntries,
        }
      : undefined;
  return {
    driver: overrides?.driver ?? defaults?.driver,
    path: overrides?.path ?? defaults?.path,
    ...(vector ? { vector } : {}),
    ...(cache ? { cache } : {}),
  };
}

function mergeMemorySearchSyncConfig(
  defaults: MemorySearchConfig["sync"],
  overrides: MemorySearchConfig["sync"],
): MemorySearchConfig["sync"] | undefined {
  if (!defaults && !overrides) {
    return undefined;
  }
  const sessions =
    defaults?.sessions || overrides?.sessions
      ? {
          deltaBytes: overrides?.sessions?.deltaBytes ?? defaults?.sessions?.deltaBytes,
          deltaMessages: overrides?.sessions?.deltaMessages ?? defaults?.sessions?.deltaMessages,
        }
      : undefined;
  return {
    onSessionStart: overrides?.onSessionStart ?? defaults?.onSessionStart,
    onSearch: overrides?.onSearch ?? defaults?.onSearch,
    watch: overrides?.watch ?? defaults?.watch,
    watchDebounceMs: overrides?.watchDebounceMs ?? defaults?.watchDebounceMs,
    intervalMinutes: overrides?.intervalMinutes ?? defaults?.intervalMinutes,
    ...(sessions ? { sessions } : {}),
  };
}

function mergeMemorySearchQueryConfig(
  defaults: MemorySearchConfig["query"],
  overrides: MemorySearchConfig["query"],
): MemorySearchConfig["query"] | undefined {
  if (!defaults && !overrides) {
    return undefined;
  }
  const mmr =
    defaults?.hybrid?.mmr || overrides?.hybrid?.mmr
      ? {
          enabled: overrides?.hybrid?.mmr?.enabled ?? defaults?.hybrid?.mmr?.enabled,
          lambda: overrides?.hybrid?.mmr?.lambda ?? defaults?.hybrid?.mmr?.lambda,
        }
      : undefined;
  const temporalDecay =
    defaults?.hybrid?.temporalDecay || overrides?.hybrid?.temporalDecay
      ? {
          enabled:
            overrides?.hybrid?.temporalDecay?.enabled ??
            defaults?.hybrid?.temporalDecay?.enabled,
          halfLifeDays:
            overrides?.hybrid?.temporalDecay?.halfLifeDays ??
            defaults?.hybrid?.temporalDecay?.halfLifeDays,
        }
      : undefined;
  const hybrid =
    defaults?.hybrid || overrides?.hybrid
      ? {
          enabled: overrides?.hybrid?.enabled ?? defaults?.hybrid?.enabled,
          vectorWeight: overrides?.hybrid?.vectorWeight ?? defaults?.hybrid?.vectorWeight,
          textWeight: overrides?.hybrid?.textWeight ?? defaults?.hybrid?.textWeight,
          candidateMultiplier:
            overrides?.hybrid?.candidateMultiplier ?? defaults?.hybrid?.candidateMultiplier,
          ...(mmr ? { mmr } : {}),
          ...(temporalDecay ? { temporalDecay } : {}),
        }
      : undefined;
  return {
    maxResults: overrides?.maxResults ?? defaults?.maxResults,
    minScore: overrides?.minScore ?? defaults?.minScore,
    ...(hybrid ? { hybrid } : {}),
  };
}

export function mergeMemorySearchConfigLayers(
  defaults: MemorySearchConfig | undefined,
  overrides: MemorySearchConfig | undefined,
): MemorySearchConfig | undefined {
  if (!defaults && !overrides) {
    return undefined;
  }
  const rawPaths = [...(defaults?.extraPaths ?? []), ...(overrides?.extraPaths ?? [])]
    .map((value) => value.trim())
    .filter(Boolean);
  const extraPaths = Array.from(new Set(rawPaths));
  return {
    enabled: overrides?.enabled ?? defaults?.enabled,
    sources: overrides?.sources ?? defaults?.sources,
    ...(extraPaths.length > 0 ? { extraPaths } : {}),
    experimental:
      defaults?.experimental || overrides?.experimental
        ? {
            sessionMemory:
              overrides?.experimental?.sessionMemory ?? defaults?.experimental?.sessionMemory,
          }
        : undefined,
    provider: overrides?.provider ?? defaults?.provider,
    remote: mergeMemorySearchRemoteConfig(defaults?.remote, overrides?.remote),
    fallback: overrides?.fallback ?? defaults?.fallback,
    model: overrides?.model ?? defaults?.model,
    local:
      defaults?.local || overrides?.local
        ? {
            modelPath: overrides?.local?.modelPath ?? defaults?.local?.modelPath,
            modelCacheDir: overrides?.local?.modelCacheDir ?? defaults?.local?.modelCacheDir,
          }
        : undefined,
    store: mergeMemorySearchStoreConfig(defaults?.store, overrides?.store),
    chunking:
      defaults?.chunking || overrides?.chunking
        ? {
            tokens: overrides?.chunking?.tokens ?? defaults?.chunking?.tokens,
            overlap: overrides?.chunking?.overlap ?? defaults?.chunking?.overlap,
          }
        : undefined,
    sync: mergeMemorySearchSyncConfig(defaults?.sync, overrides?.sync),
    query: mergeMemorySearchQueryConfig(defaults?.query, overrides?.query),
    cache:
      defaults?.cache || overrides?.cache
        ? {
            enabled: overrides?.cache?.enabled ?? defaults?.cache?.enabled,
            maxEntries: overrides?.cache?.maxEntries ?? defaults?.cache?.maxEntries,
          }
        : undefined,
  };
}

function resolveMemorySearchDefaults(
  cfg: OpenClawConfig,
  agentId: string,
): MemorySearchConfig | undefined {
  const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
  const manifestDefaults = resolveWorkspaceBrainMemorySearchConfig(workspaceDir, agentId);
  return mergeMemorySearchConfigLayers(manifestDefaults, cfg.agents?.defaults?.memorySearch);
}

export function buildPortableMemorySearchConfig(
  cfg: OpenClawConfig,
  agentId: string,
): MemorySearchConfig | undefined {
  const defaults = resolveMemorySearchDefaults(cfg, agentId);
  const overrides = resolveAgentConfig(cfg, agentId)?.memorySearch;
  return mergeMemorySearchConfigLayers(defaults, overrides);
}

function normalizeSources(
  sources: Array<"memory" | "sessions"> | undefined,
  sessionMemoryEnabled: boolean,
): Array<"memory" | "sessions"> {
  const normalized = new Set<"memory" | "sessions">();
  const input = sources?.length ? sources : DEFAULT_SOURCES;
  for (const source of input) {
    if (source === "memory") {
      normalized.add("memory");
    }
    if (source === "sessions" && sessionMemoryEnabled) {
      normalized.add("sessions");
    }
  }
  if (normalized.size === 0) {
    normalized.add("memory");
  }
  return Array.from(normalized);
}

function resolveStorePath(agentId: string, raw?: string): string {
  const stateDir = resolveStateDir(process.env, os.homedir);
  const fallback = path.join(stateDir, "memory", `${agentId}.sqlite`);
  if (!raw) {
    return fallback;
  }
  const withToken = raw.includes("{agentId}") ? raw.replaceAll("{agentId}", agentId) : raw;
  return resolveUserPath(withToken);
}

function mergeConfig(
  defaults: MemorySearchConfig | undefined,
  overrides: MemorySearchConfig | undefined,
  agentId: string,
): ResolvedMemorySearchConfig {
  const enabled = overrides?.enabled ?? defaults?.enabled ?? true;
  const sessionMemory =
    overrides?.experimental?.sessionMemory ?? defaults?.experimental?.sessionMemory ?? false;
  const provider = overrides?.provider ?? defaults?.provider ?? "auto";
  const defaultRemote = defaults?.remote;
  const overrideRemote = overrides?.remote;
  const hasRemoteConfig = Boolean(
    overrideRemote?.baseUrl ||
    overrideRemote?.apiKey ||
    overrideRemote?.headers ||
    defaultRemote?.baseUrl ||
    defaultRemote?.apiKey ||
    defaultRemote?.headers,
  );
  const includeRemote =
    hasRemoteConfig ||
    provider === "openai" ||
    provider === "gemini" ||
    provider === "voyage" ||
    provider === "mistral" ||
    provider === "ollama" ||
    provider === "auto";
  const batch = {
    enabled: overrideRemote?.batch?.enabled ?? defaultRemote?.batch?.enabled ?? false,
    wait: overrideRemote?.batch?.wait ?? defaultRemote?.batch?.wait ?? true,
    concurrency: Math.max(
      1,
      overrideRemote?.batch?.concurrency ?? defaultRemote?.batch?.concurrency ?? 2,
    ),
    pollIntervalMs:
      overrideRemote?.batch?.pollIntervalMs ?? defaultRemote?.batch?.pollIntervalMs ?? 2000,
    timeoutMinutes:
      overrideRemote?.batch?.timeoutMinutes ?? defaultRemote?.batch?.timeoutMinutes ?? 60,
  };
  const remote = includeRemote
    ? {
        baseUrl: overrideRemote?.baseUrl ?? defaultRemote?.baseUrl,
        apiKey: overrideRemote?.apiKey ?? defaultRemote?.apiKey,
        headers: overrideRemote?.headers ?? defaultRemote?.headers,
        batch,
      }
    : undefined;
  const fallback = overrides?.fallback ?? defaults?.fallback ?? "none";
  const modelDefault =
    provider === "gemini"
      ? DEFAULT_GEMINI_MODEL
      : provider === "openai"
        ? DEFAULT_OPENAI_MODEL
        : provider === "voyage"
          ? DEFAULT_VOYAGE_MODEL
          : provider === "mistral"
            ? DEFAULT_MISTRAL_MODEL
            : provider === "ollama"
              ? DEFAULT_OLLAMA_MODEL
              : undefined;
  const model = overrides?.model ?? defaults?.model ?? modelDefault ?? "";
  const local = {
    modelPath: overrides?.local?.modelPath ?? defaults?.local?.modelPath,
    modelCacheDir: overrides?.local?.modelCacheDir ?? defaults?.local?.modelCacheDir,
  };
  const sources = normalizeSources(overrides?.sources ?? defaults?.sources, sessionMemory);
  const rawPaths = [...(defaults?.extraPaths ?? []), ...(overrides?.extraPaths ?? [])]
    .map((value) => value.trim())
    .filter(Boolean);
  const extraPaths = Array.from(new Set(rawPaths));
  const vector = {
    enabled: overrides?.store?.vector?.enabled ?? defaults?.store?.vector?.enabled ?? true,
    extensionPath:
      overrides?.store?.vector?.extensionPath ?? defaults?.store?.vector?.extensionPath,
  };
  const store = {
    driver: overrides?.store?.driver ?? defaults?.store?.driver ?? "sqlite",
    path: resolveStorePath(agentId, overrides?.store?.path ?? defaults?.store?.path),
    vector,
  };
  const chunking = {
    tokens: overrides?.chunking?.tokens ?? defaults?.chunking?.tokens ?? DEFAULT_CHUNK_TOKENS,
    overlap: overrides?.chunking?.overlap ?? defaults?.chunking?.overlap ?? DEFAULT_CHUNK_OVERLAP,
  };
  const sync = {
    onSessionStart: overrides?.sync?.onSessionStart ?? defaults?.sync?.onSessionStart ?? true,
    onSearch: overrides?.sync?.onSearch ?? defaults?.sync?.onSearch ?? true,
    watch: overrides?.sync?.watch ?? defaults?.sync?.watch ?? true,
    watchDebounceMs:
      overrides?.sync?.watchDebounceMs ??
      defaults?.sync?.watchDebounceMs ??
      DEFAULT_WATCH_DEBOUNCE_MS,
    intervalMinutes: overrides?.sync?.intervalMinutes ?? defaults?.sync?.intervalMinutes ?? 0,
    sessions: {
      deltaBytes:
        overrides?.sync?.sessions?.deltaBytes ??
        defaults?.sync?.sessions?.deltaBytes ??
        DEFAULT_SESSION_DELTA_BYTES,
      deltaMessages:
        overrides?.sync?.sessions?.deltaMessages ??
        defaults?.sync?.sessions?.deltaMessages ??
        DEFAULT_SESSION_DELTA_MESSAGES,
    },
  };
  const query = {
    maxResults: overrides?.query?.maxResults ?? defaults?.query?.maxResults ?? DEFAULT_MAX_RESULTS,
    minScore: overrides?.query?.minScore ?? defaults?.query?.minScore ?? DEFAULT_MIN_SCORE,
  };
  const hybrid = {
    enabled:
      overrides?.query?.hybrid?.enabled ??
      defaults?.query?.hybrid?.enabled ??
      DEFAULT_HYBRID_ENABLED,
    vectorWeight:
      overrides?.query?.hybrid?.vectorWeight ??
      defaults?.query?.hybrid?.vectorWeight ??
      DEFAULT_HYBRID_VECTOR_WEIGHT,
    textWeight:
      overrides?.query?.hybrid?.textWeight ??
      defaults?.query?.hybrid?.textWeight ??
      DEFAULT_HYBRID_TEXT_WEIGHT,
    candidateMultiplier:
      overrides?.query?.hybrid?.candidateMultiplier ??
      defaults?.query?.hybrid?.candidateMultiplier ??
      DEFAULT_HYBRID_CANDIDATE_MULTIPLIER,
    mmr: {
      enabled:
        overrides?.query?.hybrid?.mmr?.enabled ??
        defaults?.query?.hybrid?.mmr?.enabled ??
        DEFAULT_MMR_ENABLED,
      lambda:
        overrides?.query?.hybrid?.mmr?.lambda ??
        defaults?.query?.hybrid?.mmr?.lambda ??
        DEFAULT_MMR_LAMBDA,
    },
    temporalDecay: {
      enabled:
        overrides?.query?.hybrid?.temporalDecay?.enabled ??
        defaults?.query?.hybrid?.temporalDecay?.enabled ??
        DEFAULT_TEMPORAL_DECAY_ENABLED,
      halfLifeDays:
        overrides?.query?.hybrid?.temporalDecay?.halfLifeDays ??
        defaults?.query?.hybrid?.temporalDecay?.halfLifeDays ??
        DEFAULT_TEMPORAL_DECAY_HALF_LIFE_DAYS,
    },
  };
  const cache = {
    enabled: overrides?.cache?.enabled ?? defaults?.cache?.enabled ?? DEFAULT_CACHE_ENABLED,
    maxEntries: overrides?.cache?.maxEntries ?? defaults?.cache?.maxEntries,
  };

  const overlap = clampNumber(chunking.overlap, 0, Math.max(0, chunking.tokens - 1));
  const minScore = clampNumber(query.minScore, 0, 1);
  const vectorWeight = clampNumber(hybrid.vectorWeight, 0, 1);
  const textWeight = clampNumber(hybrid.textWeight, 0, 1);
  const sum = vectorWeight + textWeight;
  const normalizedVectorWeight = sum > 0 ? vectorWeight / sum : DEFAULT_HYBRID_VECTOR_WEIGHT;
  const normalizedTextWeight = sum > 0 ? textWeight / sum : DEFAULT_HYBRID_TEXT_WEIGHT;
  const candidateMultiplier = clampInt(hybrid.candidateMultiplier, 1, 20);
  const temporalDecayHalfLifeDays = Math.max(
    1,
    Math.floor(
      Number.isFinite(hybrid.temporalDecay.halfLifeDays)
        ? hybrid.temporalDecay.halfLifeDays
        : DEFAULT_TEMPORAL_DECAY_HALF_LIFE_DAYS,
    ),
  );
  const deltaBytes = clampInt(sync.sessions.deltaBytes, 0, Number.MAX_SAFE_INTEGER);
  const deltaMessages = clampInt(sync.sessions.deltaMessages, 0, Number.MAX_SAFE_INTEGER);
  return {
    enabled,
    sources,
    extraPaths,
    provider,
    remote,
    experimental: {
      sessionMemory,
    },
    fallback,
    model,
    local,
    store,
    chunking: { tokens: Math.max(1, chunking.tokens), overlap },
    sync: {
      ...sync,
      sessions: {
        deltaBytes,
        deltaMessages,
      },
    },
    query: {
      ...query,
      minScore,
      hybrid: {
        enabled: Boolean(hybrid.enabled),
        vectorWeight: normalizedVectorWeight,
        textWeight: normalizedTextWeight,
        candidateMultiplier,
        mmr: {
          enabled: Boolean(hybrid.mmr.enabled),
          lambda: Number.isFinite(hybrid.mmr.lambda)
            ? Math.max(0, Math.min(1, hybrid.mmr.lambda))
            : DEFAULT_MMR_LAMBDA,
        },
        temporalDecay: {
          enabled: Boolean(hybrid.temporalDecay.enabled),
          halfLifeDays: temporalDecayHalfLifeDays,
        },
      },
    },
    cache: {
      enabled: Boolean(cache.enabled),
      maxEntries:
        typeof cache.maxEntries === "number" && Number.isFinite(cache.maxEntries)
          ? Math.max(1, Math.floor(cache.maxEntries))
          : undefined,
    },
  };
}

export function resolveMemorySearchConfig(
  cfg: OpenClawConfig,
  agentId: string,
): ResolvedMemorySearchConfig | null {
  const defaults = resolveMemorySearchDefaults(cfg, agentId);
  const overrides = resolveAgentConfig(cfg, agentId)?.memorySearch;
  const resolved = mergeConfig(defaults, overrides, agentId);
  if (!resolved.enabled) {
    return null;
  }
  return resolved;
}
