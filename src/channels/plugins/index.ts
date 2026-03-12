import {
  getActivePluginRegistryVersion,
  requireActivePluginRegistry,
} from "../../plugins/runtime.js";
import { isTruthyEnvValue } from "../../infra/env.js";
import { CHAT_CHANNEL_ORDER, type ChatChannelId, normalizeAnyChannelId } from "../registry.js";
import type { ChannelId, ChannelPlugin } from "./types.js";

// Channel plugins registry (runtime).
//
// This module is intentionally "heavy" (plugins may import channel monitors, web login, etc).
// Shared code paths (reply flow, command auth, sandbox explain) should depend on `src/channels/dock.ts`
// instead, and only call `getChannelPlugin()` at execution boundaries.
//
function dedupeChannels(channels: ChannelPlugin[]): ChannelPlugin[] {
  const seen = new Set<string>();
  const resolved: ChannelPlugin[] = [];
  for (const plugin of channels) {
    const id = String(plugin.id).trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    resolved.push(plugin);
  }
  return resolved;
}

type CachedChannelPlugins = {
  registryVersion: number;
  sorted: ChannelPlugin[];
  byId: Map<string, ChannelPlugin>;
};

const EMPTY_CHANNEL_PLUGIN_CACHE: CachedChannelPlugins = {
  registryVersion: -1,
  sorted: [],
  byId: new Map(),
};

let cachedChannelPlugins = EMPTY_CHANNEL_PLUGIN_CACHE;

function resolveDefaultChannelAllowlist(): Set<string> {
  const allowAll =
    isTruthyEnvValue(process.env.WEICLAW_ENABLE_ALL_CHANNELS) ||
    isTruthyEnvValue(process.env.OPENCLAW_ENABLE_ALL_CHANNELS);
  if (allowAll) {
    return new Set<string>();
  }
  const raw = process.env.WEICLAW_CHANNELS?.trim() || process.env.OPENCLAW_DEFAULT_CHANNELS?.trim();
  const defaults = raw && raw.length > 0 ? raw : "telegram";
  return new Set(
    defaults
      .split(",")
      .map((value) => normalizeAnyChannelId(value))
      .filter((value): value is string => Boolean(value)),
  );
}

function resolveCachedChannelPlugins(): CachedChannelPlugins {
  const registry = requireActivePluginRegistry();
  const registryVersion = getActivePluginRegistryVersion();
  const cached = cachedChannelPlugins;
  if (cached.registryVersion === registryVersion) {
    return cached;
  }

  const allowed = resolveDefaultChannelAllowlist();
  const sorted = dedupeChannels(registry.channels.map((entry) => entry.plugin))
    .filter((plugin) => allowed.size === 0 || allowed.has(plugin.id))
    .toSorted((a, b) => {
      const indexA = CHAT_CHANNEL_ORDER.indexOf(a.id as ChatChannelId);
      const indexB = CHAT_CHANNEL_ORDER.indexOf(b.id as ChatChannelId);
      const orderA = a.meta.order ?? (indexA === -1 ? 999 : indexA);
      const orderB = b.meta.order ?? (indexB === -1 ? 999 : indexB);
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.id.localeCompare(b.id);
    });
  const byId = new Map<string, ChannelPlugin>();
  for (const plugin of sorted) {
    byId.set(plugin.id, plugin);
  }

  const next: CachedChannelPlugins = {
    registryVersion,
    sorted,
    byId,
  };
  cachedChannelPlugins = next;
  return next;
}

export function listChannelPlugins(): ChannelPlugin[] {
  return resolveCachedChannelPlugins().sorted.slice();
}

export function getChannelPlugin(id: ChannelId): ChannelPlugin | undefined {
  const resolvedId = String(id).trim();
  if (!resolvedId) {
    return undefined;
  }
  return resolveCachedChannelPlugins().byId.get(resolvedId);
}

export function normalizeChannelId(raw?: string | null): ChannelId | null {
  // Channel docking: keep input normalization centralized in src/channels/registry.ts.
  // Plugin registry must be initialized before calling.
  return normalizeAnyChannelId(raw);
}
export {
  listDiscordDirectoryGroupsFromConfig,
  listDiscordDirectoryPeersFromConfig,
  listSlackDirectoryGroupsFromConfig,
  listSlackDirectoryPeersFromConfig,
  listTelegramDirectoryGroupsFromConfig,
  listTelegramDirectoryPeersFromConfig,
  listWhatsAppDirectoryGroupsFromConfig,
  listWhatsAppDirectoryPeersFromConfig,
} from "./directory-config.js";
export {
  applyChannelMatchMeta,
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveChannelEntryMatch,
  resolveChannelEntryMatchWithFallback,
  resolveChannelMatchConfig,
  resolveNestedAllowlistDecision,
  type ChannelEntryMatch,
  type ChannelMatchSource,
} from "./channel-config.js";
export {
  formatAllowlistMatchMeta,
  type AllowlistMatch,
  type AllowlistMatchSource,
} from "./allowlist-match.js";
export type { ChannelId, ChannelPlugin } from "./types.js";
