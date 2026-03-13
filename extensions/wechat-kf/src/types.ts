import type { OpenClawConfig, SecretInput } from "openclaw/plugin-sdk";

export type WechatKfDmPolicy = "open" | "pairing" | "allowlist";

export type WechatKfAccountConfig = {
  enabled?: boolean;
  name?: string;
  corpId?: string;
  corpSecret?: SecretInput;
  token?: SecretInput;
  encodingAesKey?: SecretInput;
  webhookPath?: string;
  webhookUrl?: string;
  defaultOpenKfId?: string;
  defaultTo?: string;
  allowFrom?: Array<string | number>;
  dmPolicy?: WechatKfDmPolicy;
  inboundOrigins?: number[];
  syncLimit?: number;
  mediaAsTextFallback?: boolean;
};

export type WechatKfConfig = WechatKfAccountConfig & {
  defaultAccount?: string;
  accounts?: Record<string, WechatKfAccountConfig>;
};

export type WechatKfResolvedConfig = WechatKfAccountConfig & {
  dmPolicy: WechatKfDmPolicy;
  inboundOrigins: number[];
  syncLimit: number;
  mediaAsTextFallback: boolean;
};

export type ResolvedWechatKfAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  corpId?: string;
  corpSecret?: string;
  token?: string;
  encodingAesKey?: string;
  webhookPath: string;
  webhookUrl?: string;
  config: WechatKfResolvedConfig;
};

export type WechatKfApiResponse = {
  errcode?: number;
  errmsg?: string;
};

export type WechatKfTokenResponse = WechatKfApiResponse & {
  access_token?: string;
  expires_in?: number;
};

export type WechatKfSyncMessageText = {
  content?: string;
};

export type WechatKfSyncMessageLink = {
  title?: string;
  url?: string;
};

export type WechatKfSyncMessageEvent = {
  event_type?: string;
  scene?: string;
};

export type WechatKfSyncMessage = {
  msgid?: string;
  msgtype?: string;
  origin?: number;
  send_time?: number;
  open_kfid?: string;
  external_userid?: string;
  servicer_userid?: string;
  text?: WechatKfSyncMessageText;
  link?: WechatKfSyncMessageLink;
  event?: WechatKfSyncMessageEvent;
};

export type WechatKfSyncResponse = WechatKfApiResponse & {
  next_cursor?: string;
  has_more?: 0 | 1 | boolean;
  msg_list?: WechatKfSyncMessage[];
};

export type WechatKfSendTextResponse = WechatKfApiResponse & {
  msgid?: string;
};

export type WechatKfCallbackEvent = {
  msgType?: string;
  event?: string;
  token?: string;
  openKfId?: string;
};

export type WechatKfTarget = {
  openKfId: string;
  externalUserId: string;
};

export type WechatKfWebhookAuthResult =
  | { kind: "verify"; echo: string }
  | { kind: "message"; xml: string; encrypted: boolean };

export type WechatKfWebhookTargetContext = {
  account: ResolvedWechatKfAccount;
  cfg: OpenClawConfig;
};
