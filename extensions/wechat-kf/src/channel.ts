import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  collectStatusIssuesFromLastError,
  createDefaultChannelRuntimeState,
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  missingTargetError,
  normalizeAccountId,
  setAccountEnabledInConfigSection,
  type ChannelDock,
  type ChannelPlugin,
  type ChannelStatusIssue,
  type OpenClawConfig,
} from "openclaw/plugin-sdk";
import { z } from "zod";
import {
  resolveDefaultWechatKfAccountId,
  resolveWechatKfAccount,
  resolveWechatKfWebhookPath,
} from "./accounts.js";
import { probeWechatKfAccount, sendWechatKfTextMessage } from "./client.js";
import { startWechatKfMonitor } from "./monitor.js";
import { getWechatKfRuntime } from "./runtime.js";
import {
  formatWechatKfTarget,
  normalizeWechatKfAllowEntry,
  parseWechatKfTarget,
  resolveWechatKfTarget,
} from "./targets.js";
import type { ResolvedWechatKfAccount } from "./types.js";

const meta = {
  id: "wechat-kf",
  label: "WeChat KF",
  selectionLabel: "WeChat KF (企微客服)",
  detailLabel: "Enterprise WeChat Customer Service",
  docsPath: "/channels/wechat-kf",
  docsLabel: "wechat-kf",
  blurb: "Enterprise WeChat customer service via official callback + sync_msg APIs.",
  aliases: ["wecom-kf", "wechatkf", "wecom"],
  order: 58,
};

const secretInputSchema = z.union([
  z.string(),
  z.object({
    source: z.enum(["env", "file", "exec"]),
    provider: z.string().min(1),
    id: z.string().min(1),
  }),
]);

const WechatKfAccountSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().optional(),
  corpId: z.string().optional(),
  corpSecret: secretInputSchema.optional(),
  token: secretInputSchema.optional(),
  encodingAesKey: secretInputSchema.optional(),
  webhookPath: z.string().optional(),
  webhookUrl: z.string().optional(),
  defaultOpenKfId: z.string().optional(),
  defaultTo: z.string().optional(),
  allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
  dmPolicy: z.enum(["open", "pairing", "allowlist"]).optional(),
  inboundOrigins: z.array(z.number().int()).optional(),
  syncLimit: z.number().int().min(1).max(1000).optional(),
  mediaAsTextFallback: z.boolean().optional(),
});

const WechatKfConfigSchema = z.object({
  enabled: z.boolean().optional(),
  defaultAccount: z.string().optional(),
  corpId: z.string().optional(),
  corpSecret: secretInputSchema.optional(),
  token: secretInputSchema.optional(),
  encodingAesKey: secretInputSchema.optional(),
  webhookPath: z.string().optional(),
  webhookUrl: z.string().optional(),
  defaultOpenKfId: z.string().optional(),
  defaultTo: z.string().optional(),
  allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
  dmPolicy: z.enum(["open", "pairing", "allowlist"]).optional(),
  inboundOrigins: z.array(z.number().int()).optional(),
  syncLimit: z.number().int().min(1).max(1000).optional(),
  mediaAsTextFallback: z.boolean().optional(),
  accounts: z.record(z.string(), WechatKfAccountSchema).optional(),
});

function formatAllowFromEntry(entry: string): string {
  return normalizeWechatKfAllowEntry(entry);
}

function resolveDefaultSendTarget(cfg: OpenClawConfig, accountId?: string | null): string | undefined {
  const account = resolveWechatKfAccount({ cfg, accountId });
  const configured = account.config.defaultTo?.trim();
  if (configured) {
    const resolved = resolveWechatKfTarget(configured, account.config.defaultOpenKfId);
    return resolved ? formatWechatKfTarget(resolved) : configured;
  }
  return undefined;
}

function readSnapshotString(snapshot: unknown, key: string): string | undefined {
  const value = (snapshot as Record<string, unknown> | null)?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readSnapshotNumber(snapshot: unknown, key: string): number | null {
  const value = (snapshot as Record<string, unknown> | null)?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export const wechatKfDock: ChannelDock = {
  id: "wechat-kf",
  capabilities: {
    chatTypes: ["direct"],
    media: false,
    threads: false,
    reactions: false,
  },
  outbound: {
    textChunkLimit: 1800,
  },
  config: {
    resolveAllowFrom: ({ cfg, accountId }) =>
      (resolveWechatKfAccount({ cfg, accountId }).config.allowFrom ?? []).map((entry) =>
        String(entry),
      ),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry))
        .filter(Boolean)
        .map(formatAllowFromEntry),
    resolveDefaultTo: ({ cfg, accountId }) => resolveDefaultSendTarget(cfg, accountId),
  },
};

export const wechatKfPlugin: ChannelPlugin<ResolvedWechatKfAccount> = {
  id: "wechat-kf",
  meta,
  pairing: {
    idLabel: "wechatKfUserId",
    normalizeAllowEntry: (entry) => formatAllowFromEntry(entry),
    notifyApproval: async ({ cfg, id }) => {
      const account = resolveWechatKfAccount({ cfg });
      const target = resolveWechatKfTarget(id, account.config.defaultOpenKfId);
      if (!target) {
        return;
      }
      await sendWechatKfTextMessage({
        account,
        openKfId: target.openKfId,
        externalUserId: target.externalUserId,
        text: "Vclaw: access approved. You can send messages now.",
      });
    },
  },
  capabilities: {
    chatTypes: ["direct"],
    threads: false,
    media: false,
    reactions: false,
  },
  agentPrompt: {
    messageToolHints: () => [
      "- WeChat KF target syntax: `open_kfid:<OPEN_KFID>|external_userid:<EXTERNAL_USERID>`.",
      "- If `channels.wechat-kf.defaultOpenKfId` is configured, you can omit the open_kfid and send to just the external_userid.",
      "- This first version sends text reliably; media falls back to plain links.",
    ],
  },
  reload: {
    configPrefixes: ["channels.wechat-kf"],
  },
  configSchema: buildChannelConfigSchema(WechatKfConfigSchema),
  config: {
    listAccountIds: (cfg) => {
      const accounts = cfg.channels?.["wechat-kf"]?.accounts;
      if (!accounts || typeof accounts !== "object") {
        return [DEFAULT_ACCOUNT_ID];
      }
      const ids = Object.keys(accounts).filter(Boolean);
      return ids.length === 0 ? [DEFAULT_ACCOUNT_ID] : ids.toSorted((a, b) => a.localeCompare(b));
    },
    resolveAccount: (cfg, accountId) => resolveWechatKfAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultWechatKfAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg,
        sectionKey: "wechat-kf",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg,
        sectionKey: "wechat-kf",
        accountId,
        clearBaseFields: [
          "corpId",
          "corpSecret",
          "token",
          "encodingAesKey",
          "webhookPath",
          "webhookUrl",
          "defaultOpenKfId",
          "defaultTo",
          "name",
        ],
      }),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      name: account.name,
      corpId: account.corpId,
      webhookPath: account.webhookPath,
      defaultOpenKfId: account.config.defaultOpenKfId,
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      (resolveWechatKfAccount({ cfg, accountId }).config.allowFrom ?? []).map((entry) =>
        String(entry),
      ),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry))
        .filter(Boolean)
        .map(formatAllowFromEntry),
    resolveDefaultTo: ({ cfg, accountId }) => resolveDefaultSendTarget(cfg, accountId),
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(cfg.channels?.["wechat-kf"]?.accounts?.[resolvedAccountId]);
      const allowFromPath = useAccountPath
        ? `channels.wechat-kf.accounts.${resolvedAccountId}.allowFrom`
        : "channels.wechat-kf.allowFrom";
      return {
        policy: account.config.dmPolicy,
        allowFrom: account.config.allowFrom ?? [],
        allowFromPath,
        approveHint: formatPairingApproveHint("wechat-kf"),
        normalizeEntry: (raw) => formatAllowFromEntry(raw),
      };
    },
    collectWarnings: ({ account }) => {
      const warnings: string[] = [];
      if (account.config.dmPolicy === "open") {
        warnings.push(
          "- WeChat KF DMs are open to any customer who reaches this callback. Prefer `pairing` or `allowlist` for production.",
        );
      }
      if (!account.config.defaultOpenKfId) {
        warnings.push(
          "- WeChat KF defaultOpenKfId is empty. Current-conversation replies still work, but manual sends need an explicit open_kfid target.",
        );
      }
      return warnings;
    },
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) =>
      applyAccountNameToChannelSection({
        cfg,
        channelKey: "wechat-kf",
        accountId,
        name,
      }),
    validateInput: ({ input }) => {
      const missing = [
        !input.corpId?.trim() ? "--corp-id" : null,
        !input.corpSecret?.trim() ? "--corp-secret" : null,
        !input.token?.trim() ? "--token" : null,
        !input.encodingAesKey?.trim() ? "--encoding-aes-key" : null,
      ].filter(Boolean);
      if (missing.length > 0) {
        return `WeChat KF setup is missing required flags: ${missing.join(", ")}`;
      }
      if (!input.webhookPath && !input.webhookUrl) {
        return "WeChat KF setup needs --webhook-path so Enterprise WeChat can call back into Vclaw.";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg,
        channelKey: "wechat-kf",
        accountId,
        name: input.name,
      });
      const next =
        accountId !== DEFAULT_ACCOUNT_ID
          ? {
              ...namedConfig,
              channels: {
                ...namedConfig.channels,
                "wechat-kf": {
                  ...namedConfig.channels?.["wechat-kf"],
                  enabled: true,
                  accounts: {
                    ...namedConfig.channels?.["wechat-kf"]?.accounts,
                  },
                },
              },
            }
          : namedConfig;
      const patch = {
        ...(input.corpId?.trim() ? { corpId: input.corpId.trim() } : {}),
        ...(input.corpSecret?.trim() ? { corpSecret: input.corpSecret.trim() } : {}),
        ...(input.token?.trim() ? { token: input.token.trim() } : {}),
        ...(input.encodingAesKey?.trim()
          ? { encodingAesKey: input.encodingAesKey.trim() }
          : {}),
        ...(input.defaultOpenKfId?.trim()
          ? { defaultOpenKfId: input.defaultOpenKfId.trim() }
          : {}),
        ...(input.dmPolicy?.trim() ? { dmPolicy: input.dmPolicy.trim() } : {}),
        ...(input.allowFrom && input.allowFrom.length > 0 ? { allowFrom: input.allowFrom } : {}),
        ...(input.webhookPath?.trim() ? { webhookPath: input.webhookPath.trim() } : {}),
        ...(input.webhookUrl?.trim() ? { webhookUrl: input.webhookUrl.trim() } : {}),
      };
      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...next,
          channels: {
            ...next.channels,
            "wechat-kf": {
              ...next.channels?.["wechat-kf"],
              enabled: true,
              ...patch,
            },
          },
        } as OpenClawConfig;
      }
      return {
        ...next,
        channels: {
          ...next.channels,
          "wechat-kf": {
            ...next.channels?.["wechat-kf"],
            enabled: true,
            accounts: {
              ...next.channels?.["wechat-kf"]?.accounts,
              [accountId]: {
                ...next.channels?.["wechat-kf"]?.accounts?.[accountId],
                enabled: true,
                ...patch,
              },
            },
          },
        },
      } as OpenClawConfig;
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getWechatKfRuntime().channel.text.chunkText(text, limit),
    chunkerMode: "text",
    textChunkLimit: 1800,
    resolveTarget: ({ cfg, to, accountId }) => {
      const account = cfg ? resolveWechatKfAccount({ cfg, accountId }) : undefined;
      const input = to?.trim() || account?.config.defaultTo?.trim();
      const target = resolveWechatKfTarget(input, account?.config.defaultOpenKfId);
      if (!target) {
        return {
          ok: false,
          error: missingTargetError(
            "WeChat KF",
            "open_kfid:<OPEN_KFID>|external_userid:<EXTERNAL_USERID>",
          ),
        };
      }
      return {
        ok: true,
        to: formatWechatKfTarget(target),
      };
    },
    sendText: async ({ cfg, to, text, accountId }) => {
      const account = resolveWechatKfAccount({ cfg, accountId });
      const target = resolveWechatKfTarget(to, account.config.defaultOpenKfId);
      if (!target) {
        throw missingTargetError(
          "WeChat KF",
          "open_kfid:<OPEN_KFID>|external_userid:<EXTERNAL_USERID>",
        );
      }
      const result = await sendWechatKfTextMessage({
        account,
        openKfId: target.openKfId,
        externalUserId: target.externalUserId,
        text,
      });
      return {
        channel: "wechat-kf",
        messageId: result.messageId,
        chatId: formatWechatKfTarget(target),
      };
    },
    sendMedia: async ({ cfg, to, text, mediaUrl, accountId }) => {
      const account = resolveWechatKfAccount({ cfg, accountId });
      const target = resolveWechatKfTarget(to, account.config.defaultOpenKfId);
      if (!target) {
        throw missingTargetError(
          "WeChat KF",
          "open_kfid:<OPEN_KFID>|external_userid:<EXTERNAL_USERID>",
        );
      }
      const fallbackText = [text?.trim(), mediaUrl?.trim()].filter(Boolean).join("\n\n");
      const result = await sendWechatKfTextMessage({
        account,
        openKfId: target.openKfId,
        externalUserId: target.externalUserId,
        text: fallbackText || "[media]",
      });
      return {
        channel: "wechat-kf",
        messageId: result.messageId,
        chatId: formatWechatKfTarget(target),
      };
    },
  },
  messaging: {
    normalizeTarget: (raw) => {
      const parsed = parseWechatKfTarget(raw);
      return parsed ? formatWechatKfTarget(parsed) : raw.trim();
    },
    targetResolver: {
      looksLikeId: (raw, normalized) => Boolean(parseWechatKfTarget(normalized ?? raw.trim())),
      hint: "open_kfid:<OPEN_KFID>|external_userid:<EXTERNAL_USERID>",
    },
  },
  status: {
    defaultRuntime: createDefaultChannelRuntimeState(DEFAULT_ACCOUNT_ID, {
      webhookPath: resolveWechatKfWebhookPath({ accountId: DEFAULT_ACCOUNT_ID }),
      lastWebhookAt: null,
    }),
    collectStatusIssues: (accounts): ChannelStatusIssue[] => {
      const issues = collectStatusIssuesFromLastError("wechat-kf", accounts);
      for (const entry of accounts) {
        if (
          entry.enabled !== false &&
          entry.configured === true &&
          !readSnapshotString(entry, "defaultOpenKfId")
        ) {
          issues.push({
            channel: "wechat-kf",
            accountId: String(entry.accountId ?? DEFAULT_ACCOUNT_ID),
            kind: "config",
            message:
              "WeChat KF defaultOpenKfId is missing. Manual sends need explicit open_kfid in the target.",
            fix: "Set channels.wechat-kf.defaultOpenKfId if you want simpler direct sends.",
          });
        }
      }
      return issues;
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      corpId: readSnapshotString(snapshot, "corpId") ?? null,
      webhookPath: snapshot.webhookPath ?? null,
      webhookUrl: snapshot.webhookUrl ?? null,
      defaultOpenKfId: readSnapshotString(snapshot, "defaultOpenKfId") ?? null,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastWebhookAt: readSnapshotNumber(snapshot, "lastWebhookAt"),
      lastInboundAt: snapshot.lastInboundAt ?? null,
      lastOutboundAt: snapshot.lastOutboundAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async ({ account, timeoutMs }) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await probeWechatKfAccount({ account, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    },
    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      corpId: account.corpId,
      webhookPath: account.webhookPath,
      webhookUrl: account.webhookUrl,
      defaultOpenKfId: account.config.defaultOpenKfId,
      dmPolicy: account.config.dmPolicy,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastWebhookAt: readSnapshotNumber(runtime, "lastWebhookAt"),
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
      lastError: runtime?.lastError ?? null,
      probe,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const webhookPath = resolveWechatKfWebhookPath({
        accountId: account.accountId,
        configuredPath: account.config.webhookPath,
      });
      ctx.log?.info(`[${account.accountId}] starting WeChat KF webhook at ${webhookPath}`);
      ctx.setStatus({
        accountId: account.accountId,
        running: true,
        webhookPath,
        lastStartAt: Date.now(),
        lastError: null,
      });
      await startWechatKfMonitor({
        cfg: ctx.cfg,
        account,
        runtime: ctx.runtime,
        channelRuntime: ctx.channelRuntime,
        abortSignal: ctx.abortSignal,
        statusSink: (patch) => ctx.setStatus({ accountId: account.accountId, ...patch }),
      });
      ctx.setStatus({
        accountId: account.accountId,
        running: false,
        lastStopAt: Date.now(),
      });
    },
  },
};
