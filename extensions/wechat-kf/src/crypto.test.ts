import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  authenticateWechatKfWebhook,
  decryptWechatKfCiphertext,
  parseWechatKfCallbackEvent,
  verifyWechatKfSignature,
} from "./crypto.js";

function padPkcs7(buffer: Buffer, blockSize = 32): Buffer {
  const remainder = buffer.length % blockSize;
  const pad = remainder === 0 ? blockSize : blockSize - remainder;
  return Buffer.concat([buffer, Buffer.alloc(pad, pad)]);
}

function encryptWechatPayload(params: {
  encodingAesKey: string;
  corpId: string;
  xml: string;
}): string {
  const key = Buffer.from(`${params.encodingAesKey}=`, "base64");
  const iv = key.subarray(0, 16);
  const message = Buffer.from(params.xml, "utf8");
  const random = Buffer.alloc(16, 7);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(message.length, 0);
  const corpId = Buffer.from(params.corpId, "utf8");
  const payload = padPkcs7(Buffer.concat([random, length, message, corpId]));
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(payload), cipher.final()]).toString("base64");
}

function createSignature(token: string, timestamp: string, nonce: string, encrypted: string) {
  return crypto
    .createHash("sha1")
    .update([token, timestamp, nonce, encrypted].sort().join(""), "utf8")
    .digest("hex");
}

describe("wechat-kf crypto", () => {
  it("verifies and decrypts webhook payloads", () => {
    const token = "verify-token";
    const timestamp = "1700000000";
    const nonce = "nonce";
    const corpId = "wxcorp123";
    const encodingAesKey = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
    const xml = "<xml><Token><![CDATA[sync-token]]></Token><OpenKfId><![CDATA[kf-1]]></OpenKfId></xml>";
    const encrypted = encryptWechatPayload({
      encodingAesKey,
      corpId,
      xml,
    });
    const signature = createSignature(token, timestamp, nonce, encrypted);
    expect(
      verifyWechatKfSignature({
        token,
        timestamp,
        nonce,
        encrypted,
        signature,
      }),
    ).toBe(true);
    expect(
      decryptWechatKfCiphertext({
        encodingAesKey,
        encrypted,
        receiveId: corpId,
      }),
    ).toBe(xml);
    const auth = authenticateWechatKfWebhook({
      query: new URLSearchParams({
        msg_signature: signature,
        timestamp,
        nonce,
      }),
      rawBody: `<xml><Encrypt><![CDATA[${encrypted}]]></Encrypt></xml>`,
      token,
      encodingAesKey,
      corpId,
    });
    expect(auth).toEqual({
      kind: "message",
      xml,
      encrypted: true,
    });
    expect(parseWechatKfCallbackEvent(xml)).toEqual({
      msgType: undefined,
      event: undefined,
      token: "sync-token",
      openKfId: "kf-1",
    });
  });
});
