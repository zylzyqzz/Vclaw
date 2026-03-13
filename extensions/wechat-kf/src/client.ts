import crypto from "node:crypto";
import type {
  ResolvedWechatKfAccount,
  WechatKfSendTextResponse,
  WechatKfSyncResponse,
  WechatKfTokenResponse,
} from "./types.js";

const API_BASE = "https://qyapi.weixin.qq.com/cgi-bin";
const REQUEST_TIMEOUT_MS = 30_000;

type TokenCacheEntry = {
  accessToken: string;
  expiresAt: number;
};

const tokenCache = new Map<string, TokenCacheEntry>();

function resolveAbortSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

async function fetchWechatKfJson<T extends { errcode?: number; errmsg?: string }>(params: {
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
}): Promise<T> {
  const { signal, cleanup } = resolveAbortSignal(params.signal, REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(params.url, {
      method: params.method ?? "GET",
      headers: params.body ? { "content-type": "application/json" } : undefined,
      body: params.body ? JSON.stringify(params.body) : undefined,
      signal,
    });
    if (!response.ok) {
      throw new Error(`WeChat KF API HTTP ${response.status}`);
    }
    const data = (await response.json()) as T;
    if ((data.errcode ?? 0) !== 0) {
      throw new Error(`WeChat KF API ${data.errcode}: ${data.errmsg ?? "unknown error"}`);
    }
    return data;
  } finally {
    cleanup();
  }
}

export function clearWechatKfTokenCache(accountId?: string): void {
  if (accountId) {
    tokenCache.delete(accountId);
    return;
  }
  tokenCache.clear();
}

export async function getWechatKfAccessToken(params: {
  account: ResolvedWechatKfAccount;
  signal?: AbortSignal;
}): Promise<string> {
  const { account, signal } = params;
  const cached = tokenCache.get(account.accountId);
  if (cached && cached.expiresAt - Date.now() > 60_000) {
    return cached.accessToken;
  }
  if (!account.corpId || !account.corpSecret) {
    throw new Error(`WeChat KF account "${account.accountId}" is not configured`);
  }
  const query = new URLSearchParams({
    corpid: account.corpId,
    corpsecret: account.corpSecret,
  });
  const response = await fetchWechatKfJson<WechatKfTokenResponse>({
    url: `${API_BASE}/gettoken?${query.toString()}`,
    signal,
  });
  const accessToken = response.access_token?.trim();
  if (!accessToken) {
    throw new Error("WeChat KF gettoken returned no access_token");
  }
  const expiresIn = Math.max(60, Math.trunc(response.expires_in ?? 7200));
  tokenCache.set(account.accountId, {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  });
  return accessToken;
}

export async function syncWechatKfMessages(params: {
  account: ResolvedWechatKfAccount;
  syncToken: string;
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<WechatKfSyncResponse> {
  const accessToken = await getWechatKfAccessToken({
    account: params.account,
    signal: params.signal,
  });
  return await fetchWechatKfJson<WechatKfSyncResponse>({
    url: `${API_BASE}/kf/sync_msg?access_token=${encodeURIComponent(accessToken)}`,
    method: "POST",
    body: {
      token: params.syncToken,
      ...(params.cursor ? { cursor: params.cursor } : {}),
      limit: params.limit ?? params.account.config.syncLimit,
    },
    signal: params.signal,
  });
}

export async function sendWechatKfTextMessage(params: {
  account: ResolvedWechatKfAccount;
  openKfId: string;
  externalUserId: string;
  text: string;
  messageId?: string;
  signal?: AbortSignal;
}): Promise<{ messageId: string }> {
  const accessToken = await getWechatKfAccessToken({
    account: params.account,
    signal: params.signal,
  });
  const response = await fetchWechatKfJson<WechatKfSendTextResponse>({
    url: `${API_BASE}/kf/send_msg?access_token=${encodeURIComponent(accessToken)}`,
    method: "POST",
    body: {
      touser: params.externalUserId,
      open_kfid: params.openKfId,
      msgtype: "text",
      text: {
        content: params.text,
      },
      msgid: params.messageId ?? crypto.randomUUID(),
    },
    signal: params.signal,
  });
  return {
    messageId: response.msgid?.trim() || params.messageId || crypto.randomUUID(),
  };
}

export async function probeWechatKfAccount(params: {
  account: ResolvedWechatKfAccount;
  signal?: AbortSignal;
}): Promise<{ ok: true; accessTokenReady: true }> {
  await getWechatKfAccessToken(params);
  return { ok: true, accessTokenReady: true };
}
