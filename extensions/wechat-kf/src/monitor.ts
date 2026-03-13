import {
  beginWebhookRequestPipelineOrReject,
  createReplyPrefixOptions,
  createWebhookInFlightLimiter,
  readWebhookBodyOrReject,
  registerPluginHttpRoute,
  resolveInboundRouteEnvelopeBuilderWithRuntime,
  waitUntilAbort,
  type OpenClawConfig,
  type PluginRuntime,
  type RuntimeEnv,
} from "openclaw/plugin-sdk";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveWechatKfWebhookPath } from "./accounts.js";
import { sendWechatKfTextMessage, syncWechatKfMessages } from "./client.js";
import { authenticateWechatKfWebhook, parseWechatKfCallbackEvent } from "./crypto.js";
import { formatWechatKfTarget, normalizeWechatKfAllowEntry } from "./targets.js";
import type {
  ResolvedWechatKfAccount,
  WechatKfCallbackEvent,
  WechatKfSyncMessage,
  WechatKfTarget,
} from "./types.js";

const webhookInFlightLimiter = createWebhookInFlightLimiter();
const MAX_RECENT_IDS = 2048;

type WechatKfStatusPatch = {
  running?: boolean;
  lastStartAt?: number;
  lastStopAt?: number;
  lastWebhookAt?: number;
  lastInboundAt?: number;
  lastOutboundAt?: number;
  lastError?: string | null;
  webhookPath?: string;
};

export type WechatKfStatusSink = (patch: WechatKfStatusPatch) => void;

export type WechatKfMonitorState = {
  syncTasks: Map<string, Promise<void>>;
  seenInboundIds: Map<string, number>;
  seenOutboundIds: Map<string, number>;
};

export function createWechatKfMonitorState(): WechatKfMonitorState {
  return {
    syncTasks: new Map(),
    seenInboundIds: new Map(),
    seenOutboundIds: new Map(),
  };
}

function pruneRecentIds(store: Map<string, number>) {
  while (store.size > MAX_RECENT_IDS) {
    const firstKey = store.keys().next().value as string | undefined;
    if (!firstKey) {
      break;
    }
    store.delete(firstKey);
  }
}

function rememberRecentId(store: Map<string, number>, id: string | undefined) {
  const normalized = id?.trim();
  if (!normalized) {
    return;
  }
  store.set(normalized, Date.now());
  pruneRecentIds(store);
}

function hasRecentId(store: Map<string, number>, id: string | undefined): boolean {
  const normalized = id?.trim();
  return normalized ? store.has(normalized) : false;
}

function normalizeSendTime(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function extractInboundBody(message: WechatKfSyncMessage): string | null {
  const msgtype = message.msgtype?.trim().toLowerCase();
  if (!msgtype) {
    return null;
  }
  if (msgtype === "text") {
    const text = message.text?.content?.trim();
    return text || null;
  }
  if (msgtype === "link") {
    const title = message.link?.title?.trim();
    const url = message.link?.url?.trim();
    return [title, url].filter(Boolean).join("\n") || "[wechat-kf link]";
  }
  if (msgtype === "event") {
    const eventType = message.event?.event_type?.trim();
    return eventType ? `[wechat-kf event] ${eventType}` : "[wechat-kf event]";
  }
  return `[wechat-kf ${msgtype}]`;
}

function resolveMessageTarget(params: {
  account: ResolvedWechatKfAccount;
  message: WechatKfSyncMessage;
  callbackEvent?: WechatKfCallbackEvent;
}): WechatKfTarget | null {
  const openKfId =
    params.message.open_kfid?.trim() ||
    params.callbackEvent?.openKfId?.trim() ||
    params.account.config.defaultOpenKfId;
  const externalUserId = params.message.external_userid?.trim();
  if (!openKfId || !externalUserId) {
    return null;
  }
  return { openKfId, externalUserId };
}

async function applyWechatKfDmAccessPolicy(params: {
  account: ResolvedWechatKfAccount;
  channelRuntime: PluginRuntime["channel"] | undefined;
  runtime: RuntimeEnv;
  target: WechatKfTarget;
  signal?: AbortSignal;
}): Promise<{ allowed: boolean; commandAuthorized: boolean }> {
  const { account, channelRuntime, runtime, target, signal } = params;
  const normalizedTarget = normalizeWechatKfAllowEntry(formatWechatKfTarget(target));
  const configuredAllow = (account.config.allowFrom ?? [])
    .map((entry) => normalizeWechatKfAllowEntry(String(entry)))
    .filter(Boolean);
  const storedAllow = channelRuntime
    ? await channelRuntime.pairing.readAllowFromStore({
        channel: "wechat-kf",
        accountId: account.accountId,
      })
    : [];
  const allowSet = new Set([...configuredAllow, ...storedAllow].map(normalizeWechatKfAllowEntry));
  if (account.config.dmPolicy === "open") {
    return { allowed: true, commandAuthorized: true };
  }
  if (allowSet.has(normalizedTarget)) {
    return { allowed: true, commandAuthorized: true };
  }
  if (account.config.dmPolicy !== "pairing") {
    runtime.log?.(`[wechat-kf] blocked sender ${normalizedTarget} by allowlist policy`);
    return { allowed: false, commandAuthorized: false };
  }
  if (!channelRuntime) {
    runtime.log?.(
      `[wechat-kf] pairing required for ${normalizedTarget}, but channel runtime is unavailable`,
    );
    return { allowed: false, commandAuthorized: false };
  }
  const pairing = await channelRuntime.pairing.upsertPairingRequest({
    channel: "wechat-kf",
    accountId: account.accountId,
    id: normalizedTarget,
    meta: {
      openKfId: target.openKfId,
      externalUserId: target.externalUserId,
    },
  });
  const reply = channelRuntime.pairing.buildPairingReply({
    channel: "wechat-kf",
    idLine: `Your wechatKfUserId: ${normalizedTarget}`,
    code: pairing.code,
  });
  await sendWechatKfTextMessage({
    account,
    openKfId: target.openKfId,
    externalUserId: target.externalUserId,
    text: reply,
    signal,
  });
  return { allowed: false, commandAuthorized: false };
}

async function deliverWechatKfReply(params: {
  account: ResolvedWechatKfAccount;
  target: WechatKfTarget;
  payload: { text?: string; mediaUrls?: string[]; mediaUrl?: string };
  state: WechatKfMonitorState;
  statusSink?: WechatKfStatusSink;
  signal?: AbortSignal;
}): Promise<void> {
  const mediaList = params.payload.mediaUrls?.length
    ? params.payload.mediaUrls
    : params.payload.mediaUrl
      ? [params.payload.mediaUrl]
      : [];
  const parts = [params.payload.text?.trim() ?? ""];
  if (mediaList.length > 0 && params.account.config.mediaAsTextFallback) {
    parts.push(mediaList.join("\n"));
  }
  const text = parts.filter(Boolean).join("\n\n").trim();
  if (!text) {
    return;
  }
  const result = await sendWechatKfTextMessage({
    account: params.account,
    openKfId: params.target.openKfId,
    externalUserId: params.target.externalUserId,
    text,
    signal: params.signal,
  });
  rememberRecentId(params.state.seenOutboundIds, result.messageId);
  params.statusSink?.({
    lastOutboundAt: Date.now(),
  });
}

async function processWechatKfSyncMessage(params: {
  cfg: OpenClawConfig;
  account: ResolvedWechatKfAccount;
  runtime: RuntimeEnv;
  channelRuntime?: PluginRuntime["channel"];
  state: WechatKfMonitorState;
  message: WechatKfSyncMessage;
  callbackEvent?: WechatKfCallbackEvent;
  statusSink?: WechatKfStatusSink;
  signal?: AbortSignal;
}): Promise<void> {
  const {
    cfg,
    account,
    runtime,
    channelRuntime,
    state,
    message,
    callbackEvent,
    statusSink,
    signal,
  } = params;
  const messageId = message.msgid?.trim();
  if (
    !messageId ||
    hasRecentId(state.seenInboundIds, messageId) ||
    hasRecentId(state.seenOutboundIds, messageId)
  ) {
    return;
  }
  rememberRecentId(state.seenInboundIds, messageId);
  if (
    typeof message.origin === "number" &&
    Array.isArray(account.config.inboundOrigins) &&
    account.config.inboundOrigins.length > 0 &&
    !account.config.inboundOrigins.includes(message.origin)
  ) {
    return;
  }
  const target = resolveMessageTarget({
    account,
    message,
    callbackEvent,
  });
  const rawBody = extractInboundBody(message);
  if (!target || !rawBody) {
    return;
  }
  const access = await applyWechatKfDmAccessPolicy({
    account,
    channelRuntime,
    runtime,
    target,
    signal,
  });
  if (!access.allowed || !channelRuntime) {
    return;
  }
  const targetId = formatWechatKfTarget(target);
  const peer = {
    kind: "direct" as const,
    id: targetId,
  };
  const { route, buildEnvelope } = resolveInboundRouteEnvelopeBuilderWithRuntime({
    cfg,
    channel: "wechat-kf",
    accountId: account.accountId,
    peer,
    runtime: channelRuntime,
    sessionStore: cfg.session?.store,
  });
  const { storePath, body } = buildEnvelope({
    channel: "WeChat KF",
    from: targetId,
    timestamp: normalizeSendTime(message.send_time),
    body: rawBody,
  });
  const ctxPayload = channelRuntime.reply.finalizeInboundContext({
    Body: body,
    BodyForAgent: rawBody,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: `wechat-kf:${targetId}`,
    To: `wechat-kf:${targetId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: "direct",
    ConversationLabel: target.externalUserId,
    SenderId: targetId,
    CommandAuthorized: access.commandAuthorized,
    Provider: "wechat-kf",
    Surface: "wechat-kf",
    MessageSid: messageId,
    MessageSidFull: messageId,
    OriginatingChannel: "wechat-kf",
    OriginatingTo: `wechat-kf:${targetId}`,
  });
  void channelRuntime.session
    .recordSessionMetaFromInbound({
      storePath,
      sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
      ctx: ctxPayload,
    })
    .catch((err) => {
      runtime.error?.(`wechat-kf: failed updating session meta: ${String(err)}`);
    });
  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg,
    channel: "wechat-kf",
    accountId: route.accountId,
    agentId: route.agentId,
  });
  await channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg,
    dispatcherOptions: {
      ...prefixOptions,
      deliver: async (payload) => {
        await deliverWechatKfReply({
          account,
          target,
          payload,
          state,
          statusSink,
          signal,
        });
      },
      onError: (err, info) => {
        runtime.error?.(`[wechat-kf] ${info.kind} reply failed: ${String(err)}`);
      },
    },
    replyOptions: {
      onModelSelected,
    },
  });
  statusSink?.({
    lastInboundAt: Date.now(),
  });
}

export async function processWechatKfCallbackEvent(params: {
  cfg: OpenClawConfig;
  account: ResolvedWechatKfAccount;
  runtime: RuntimeEnv;
  channelRuntime?: PluginRuntime["channel"];
  state: WechatKfMonitorState;
  event: WechatKfCallbackEvent;
  statusSink?: WechatKfStatusSink;
  signal?: AbortSignal;
}): Promise<void> {
  const { account, event, state } = params;
  const syncToken = event.token?.trim();
  if (!syncToken) {
    return;
  }
  const syncKey = `${event.openKfId?.trim() || account.config.defaultOpenKfId || "default"}:${syncToken}`;
  const existing = state.syncTasks.get(syncKey);
  if (existing) {
    await existing;
    return;
  }
  const task = (async () => {
    let cursor: string | undefined;
    let rounds = 0;
    while (!params.signal?.aborted && rounds < 20) {
      const batch = await syncWechatKfMessages({
        account,
        syncToken,
        cursor,
        signal: params.signal,
      });
      for (const message of batch.msg_list ?? []) {
        await processWechatKfSyncMessage({
          cfg: params.cfg,
          account,
          runtime: params.runtime,
          channelRuntime: params.channelRuntime,
          state,
          message,
          callbackEvent: event,
          statusSink: params.statusSink,
          signal: params.signal,
        });
      }
      const hasMore =
        batch.has_more === true || batch.has_more === 1 || String(batch.has_more) === "true";
      cursor = batch.next_cursor?.trim() || undefined;
      rounds += 1;
      if (!hasMore || !cursor) {
        break;
      }
    }
  })().finally(() => {
    state.syncTasks.delete(syncKey);
  });
  state.syncTasks.set(syncKey, task);
  await task;
}

function writeWebhookError(
  res: ServerResponse,
  runtime: RuntimeEnv,
  statusSink: WechatKfStatusSink | undefined,
  error: unknown,
  statusCode = 400,
) {
  const message = error instanceof Error ? error.message : String(error);
  runtime.error?.(`[wechat-kf] webhook error: ${message}`);
  statusSink?.({ lastError: message });
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(message);
}

export async function handleWechatKfWebhookRequest(params: {
  req: IncomingMessage;
  res: ServerResponse;
  cfg: OpenClawConfig;
  account: ResolvedWechatKfAccount;
  runtime: RuntimeEnv;
  channelRuntime?: PluginRuntime["channel"];
  state: WechatKfMonitorState;
  statusSink?: WechatKfStatusSink;
  signal?: AbortSignal;
}): Promise<boolean> {
  const pipeline = beginWebhookRequestPipelineOrReject({
    req: params.req,
    res: params.res,
    allowMethods: ["GET", "POST"],
    inFlightLimiter: webhookInFlightLimiter,
    inFlightKey: `wechat-kf:${params.account.accountId}`,
  });
  if (!pipeline.ok) {
    return true;
  }
  try {
    const query = new URL(params.req.url ?? "/", "http://localhost").searchParams;
    if (params.req.method === "GET") {
      try {
        const auth = authenticateWechatKfWebhook({
          query,
          token: params.account.token ?? "",
          encodingAesKey: params.account.encodingAesKey ?? "",
          corpId: params.account.corpId,
        });
        if (auth.kind !== "verify") {
          throw new Error("invalid WeChat KF verification request");
        }
        params.statusSink?.({
          lastWebhookAt: Date.now(),
          lastError: null,
        });
        params.res.statusCode = 200;
        params.res.setHeader("Content-Type", "text/plain; charset=utf-8");
        params.res.end(auth.echo);
        return true;
      } catch (error) {
        writeWebhookError(params.res, params.runtime, params.statusSink, error, 401);
        return true;
      }
    }

    const body = await readWebhookBodyOrReject({
      req: params.req,
      res: params.res,
      profile: "pre-auth",
      invalidBodyMessage: "invalid WeChat KF webhook body",
    });
    if (!body.ok) {
      return true;
    }

    try {
      const auth = authenticateWechatKfWebhook({
        query,
        rawBody: body.value,
        token: params.account.token ?? "",
        encodingAesKey: params.account.encodingAesKey ?? "",
        corpId: params.account.corpId,
      });
      if (auth.kind !== "message") {
        throw new Error("invalid WeChat KF callback payload");
      }
      const event = parseWechatKfCallbackEvent(auth.xml);
      params.statusSink?.({
        lastWebhookAt: Date.now(),
        lastError: null,
      });
      void processWechatKfCallbackEvent({
        cfg: params.cfg,
        account: params.account,
        runtime: params.runtime,
        channelRuntime: params.channelRuntime,
        state: params.state,
        event,
        statusSink: params.statusSink,
        signal: params.signal,
      }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        params.runtime.error?.(`[wechat-kf] sync processing failed: ${message}`);
        params.statusSink?.({ lastError: message });
      });
      params.res.statusCode = 200;
      params.res.setHeader("Content-Type", "text/plain; charset=utf-8");
      params.res.end("success");
      return true;
    } catch (error) {
      writeWebhookError(params.res, params.runtime, params.statusSink, error, 401);
      return true;
    }
  } finally {
    pipeline.release();
  }
}

export async function startWechatKfMonitor(params: {
  cfg: OpenClawConfig;
  account: ResolvedWechatKfAccount;
  runtime: RuntimeEnv;
  channelRuntime?: PluginRuntime["channel"];
  abortSignal: AbortSignal;
  statusSink?: WechatKfStatusSink;
}): Promise<void> {
  const state = createWechatKfMonitorState();
  const webhookPath = resolveWechatKfWebhookPath({
    accountId: params.account.accountId,
    configuredPath: params.account.config.webhookPath,
  });
  const unregister = registerPluginHttpRoute({
    path: webhookPath,
    auth: "plugin",
    replaceExisting: true,
    pluginId: "wechat-kf",
    source: "wechat-kf-webhook",
    accountId: params.account.accountId,
    log: params.runtime.log,
    handler: async (req, res) =>
      await handleWechatKfWebhookRequest({
        req,
        res,
        cfg: params.cfg,
        account: params.account,
        runtime: params.runtime,
        channelRuntime: params.channelRuntime,
        state,
        statusSink: params.statusSink,
        signal: params.abortSignal,
      }),
  });
  await waitUntilAbort(params.abortSignal);
  unregister();
}
