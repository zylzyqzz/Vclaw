import {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId,
} from "openclaw/plugin-sdk/account-id";
import {
  normalizeResolvedSecretInputString,
  type OpenClawConfig,
} from "openclaw/plugin-sdk";
import type { ResolvedWechatKfAccount, WechatKfAccountConfig, WechatKfConfig } from "./types.js";

const DEFAULT_SYNC_LIMIT = 100;
const DEFAULT_INBOUND_ORIGINS = [3];
const DEFAULT_WEBHOOK_PATH = "/plugins/wechat-kf";

function getChannelConfig(cfg: OpenClawConfig): WechatKfConfig | undefined {
  return cfg.channels?.["wechat-kf"] as WechatKfConfig | undefined;
}

function listConfiguredAccountIds(cfg: OpenClawConfig): string[] {
  const accounts = getChannelConfig(cfg)?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return [];
  }
  return Object.keys(accounts).filter(Boolean);
}

export function listWechatKfAccountIds(cfg: OpenClawConfig): string[] {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}

export function resolveDefaultWechatKfAccountId(cfg: OpenClawConfig): string {
  const preferred = normalizeOptionalAccountId(getChannelConfig(cfg)?.defaultAccount);
  if (
    preferred &&
    listWechatKfAccountIds(cfg).some((accountId) => normalizeAccountId(accountId) === preferred)
  ) {
    return preferred;
  }
  const ids = listWechatKfAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

function resolveNamedAccountConfig(
  cfg: OpenClawConfig,
  accountId: string,
): WechatKfAccountConfig | undefined {
  const accounts = getChannelConfig(cfg)?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return undefined;
  }
  return accounts[accountId];
}

function mergeWechatKfAccountConfig(cfg: OpenClawConfig, accountId: string): WechatKfAccountConfig {
  const channel = getChannelConfig(cfg) ?? {};
  const { accounts: _ignored, defaultAccount: _ignored2, ...base } = channel;
  const account = resolveNamedAccountConfig(cfg, accountId) ?? {};
  return {
    ...base,
    ...account,
  } as WechatKfAccountConfig;
}

export function resolveWechatKfWebhookPath(params: {
  accountId: string;
  configuredPath?: string | null;
}): string {
  const configuredPath = params.configuredPath?.trim();
  if (configuredPath) {
    return configuredPath.startsWith("/") ? configuredPath : `/${configuredPath}`;
  }
  if (params.accountId === DEFAULT_ACCOUNT_ID) {
    return `${DEFAULT_WEBHOOK_PATH}/default`;
  }
  return `${DEFAULT_WEBHOOK_PATH}/${params.accountId}`;
}

function resolveSecretField(params: {
  value: unknown;
  path: string;
}): string | undefined {
  return normalizeResolvedSecretInputString({
    value: params.value,
    path: params.path,
  });
}

export function resolveWechatKfAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedWechatKfAccount {
  const accountId = normalizeAccountId(params.accountId);
  const channel = getChannelConfig(params.cfg);
  const merged = mergeWechatKfAccountConfig(params.cfg, accountId);
  const topLevelEnabled = channel?.enabled !== false;
  const accountEnabled = merged.enabled !== false;
  const enabled = topLevelEnabled && accountEnabled;
  const basePath =
    accountId === DEFAULT_ACCOUNT_ID
      ? "channels.wechat-kf"
      : `channels.wechat-kf.accounts.${accountId}`;
  const corpId = merged.corpId?.trim() || undefined;
  const corpSecret = resolveSecretField({
    value: merged.corpSecret,
    path: `${basePath}.corpSecret`,
  });
  const token = resolveSecretField({
    value: merged.token,
    path: `${basePath}.token`,
  });
  const encodingAesKey = resolveSecretField({
    value: merged.encodingAesKey,
    path: `${basePath}.encodingAesKey`,
  });
  const webhookPath = resolveWechatKfWebhookPath({
    accountId,
    configuredPath: merged.webhookPath,
  });
  const webhookUrl = merged.webhookUrl?.trim() || undefined;
  const configured = Boolean(corpId && corpSecret && token && encodingAesKey);
  const inboundOrigins =
    Array.isArray(merged.inboundOrigins) && merged.inboundOrigins.length > 0
      ? merged.inboundOrigins
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
          .map((value) => Math.trunc(value))
      : DEFAULT_INBOUND_ORIGINS;
  const syncLimit = Math.max(1, Math.min(1000, Math.trunc(merged.syncLimit ?? DEFAULT_SYNC_LIMIT)));

  return {
    accountId,
    name: merged.name?.trim() || undefined,
    enabled,
    configured,
    corpId,
    corpSecret,
    token,
    encodingAesKey,
    webhookPath,
    webhookUrl,
    config: {
      ...merged,
      dmPolicy: merged.dmPolicy ?? "pairing",
      inboundOrigins,
      syncLimit,
      mediaAsTextFallback: merged.mediaAsTextFallback !== false,
      defaultOpenKfId: merged.defaultOpenKfId?.trim() || undefined,
      defaultTo: merged.defaultTo?.trim() || undefined,
      webhookPath,
      webhookUrl,
    },
  };
}

export function listEnabledWechatKfAccounts(cfg: OpenClawConfig): ResolvedWechatKfAccount[] {
  return listWechatKfAccountIds(cfg)
    .map((accountId) => resolveWechatKfAccount({ cfg, accountId }))
    .filter((account) => account.enabled);
}
