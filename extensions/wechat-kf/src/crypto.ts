import crypto from "node:crypto";
import type { WechatKfCallbackEvent, WechatKfWebhookAuthResult } from "./types.js";

function extractXmlTag(xml: string, tag: string): string | undefined {
  const patterns = [
    new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"),
    new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(xml);
    const value = match?.[1]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function pickString(xml: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = extractXmlTag(xml, key);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function decodeAesKey(encodingAesKey: string): Buffer {
  const normalized = `${encodingAesKey.trim()}=`;
  const key = Buffer.from(normalized, "base64");
  if (key.length !== 32) {
    throw new Error("invalid WeChat KF encodingAesKey");
  }
  return key;
}

function removePkcs7Padding(buffer: Buffer): Buffer {
  const pad = buffer[buffer.length - 1] ?? 0;
  if (pad < 1 || pad > 32) {
    throw new Error("invalid WeChat KF PKCS7 padding");
  }
  return buffer.subarray(0, buffer.length - pad);
}

function sha1Signature(parts: string[]): string {
  return crypto.createHash("sha1").update(parts.toSorted().join(""), "utf8").digest("hex");
}

export function verifyWechatKfSignature(params: {
  token: string;
  timestamp?: string | null;
  nonce?: string | null;
  encrypted: string;
  signature?: string | null;
}): boolean {
  const signature = params.signature?.trim();
  if (!signature) {
    return false;
  }
  const computed = sha1Signature([
    params.token.trim(),
    params.timestamp?.trim() ?? "",
    params.nonce?.trim() ?? "",
    params.encrypted.trim(),
  ]);
  return computed === signature;
}

export function decryptWechatKfCiphertext(params: {
  encodingAesKey: string;
  encrypted: string;
  receiveId?: string;
}): string {
  const key = decodeAesKey(params.encodingAesKey);
  const iv = key.subarray(0, 16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  decipher.setAutoPadding(false);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(params.encrypted.trim(), "base64")),
    decipher.final(),
  ]);
  const payload = removePkcs7Padding(decrypted);
  if (payload.length < 20) {
    throw new Error("invalid WeChat KF payload length");
  }
  const bodyLength = payload.readUInt32BE(16);
  const bodyStart = 20;
  const bodyEnd = bodyStart + bodyLength;
  if (bodyEnd > payload.length) {
    throw new Error("invalid WeChat KF payload body");
  }
  const body = payload.subarray(bodyStart, bodyEnd).toString("utf8");
  const receiveId = payload.subarray(bodyEnd).toString("utf8");
  if (params.receiveId?.trim() && receiveId.trim() && receiveId.trim() !== params.receiveId.trim()) {
    throw new Error("WeChat KF receiveId mismatch");
  }
  return body;
}

export function authenticateWechatKfWebhook(params: {
  query: URLSearchParams;
  token: string;
  encodingAesKey: string;
  corpId?: string;
  rawBody?: string;
}): WechatKfWebhookAuthResult {
  const signature = params.query.get("msg_signature");
  const timestamp = params.query.get("timestamp");
  const nonce = params.query.get("nonce");
  const echostr = params.query.get("echostr");

  if (echostr) {
    if (
      !verifyWechatKfSignature({
        token: params.token,
        timestamp,
        nonce,
        encrypted: echostr,
        signature,
      })
    ) {
      throw new Error("invalid WeChat KF verification signature");
    }
    return {
      kind: "verify",
      echo: decryptWechatKfCiphertext({
        encodingAesKey: params.encodingAesKey,
        encrypted: echostr,
        receiveId: params.corpId,
      }),
    };
  }

  const rawBody = params.rawBody?.trim();
  if (!rawBody) {
    throw new Error("missing WeChat KF request body");
  }
  const encrypted = pickString(rawBody, ["Encrypt", "encrypt"]);
  if (!encrypted) {
    return { kind: "message", xml: rawBody, encrypted: false };
  }
  if (
    !verifyWechatKfSignature({
      token: params.token,
      timestamp,
      nonce,
      encrypted,
      signature,
    })
  ) {
    throw new Error("invalid WeChat KF message signature");
  }
  return {
    kind: "message",
    xml: decryptWechatKfCiphertext({
      encodingAesKey: params.encodingAesKey,
      encrypted,
      receiveId: params.corpId,
    }),
    encrypted: true,
  };
}

export function parseWechatKfCallbackEvent(xml: string): WechatKfCallbackEvent {
  return {
    msgType: pickString(xml, ["MsgType", "msgtype", "msgType"]),
    event: pickString(xml, ["Event", "event"]),
    token: pickString(xml, ["Token", "token"]),
    openKfId: pickString(xml, ["OpenKfId", "OpenKfID", "open_kfid", "openKfId"]),
  };
}
