import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig, PluginRuntime, RuntimeEnv } from "openclaw/plugin-sdk";
import { createWechatKfMonitorState, processWechatKfCallbackEvent } from "./monitor.js";
import type { ResolvedWechatKfAccount } from "./types.js";

function createRuntime(logs: string[]): RuntimeEnv {
  return {
    log: (message: string) => logs.push(message),
    error: (message: string) => logs.push(`ERR:${message}`),
    exit: () => undefined,
  } as unknown as RuntimeEnv;
}

function createChannelRuntime(dispatchMock: ReturnType<typeof vi.fn>): PluginRuntime["channel"] {
  return {
    routing: {
      resolveAgentRoute: ({ accountId, peer }: { accountId: string; peer: { id: string } }) => ({
        agentId: "main",
        accountId,
        sessionKey: `wechat-kf:${String(peer.id)}`,
      }),
    },
    session: {
      resolveStorePath: () => "sessions.json",
      readSessionUpdatedAt: () => undefined,
      recordSessionMetaFromInbound: vi.fn().mockResolvedValue(undefined),
    },
    reply: {
      resolveEnvelopeFormatOptions: () => ({}),
      formatAgentEnvelope: ({ body }: { body: string }) => body,
      finalizeInboundContext: (ctx: unknown) => ctx,
      dispatchReplyWithBufferedBlockDispatcher: dispatchMock,
    },
    pairing: {
      readAllowFromStore: vi.fn().mockResolvedValue([
        "open_kfid:kf-1|external_userid:wm-user-9",
      ]),
      upsertPairingRequest: vi.fn(),
      buildPairingReply: vi.fn(),
    },
  } as unknown as PluginRuntime["channel"];
}

function createAccount(): ResolvedWechatKfAccount {
  return {
    accountId: "default",
    enabled: true,
    configured: true,
    corpId: "wxcorp123",
    corpSecret: "corp-secret",
    token: "verify-token",
    encodingAesKey: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    webhookPath: "/plugins/wechat-kf/default",
    config: {
      dmPolicy: "pairing",
      inboundOrigins: [3],
      syncLimit: 100,
      mediaAsTextFallback: true,
      defaultOpenKfId: "kf-1",
      allowFrom: [],
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("wechat-kf monitor", () => {
  it("pulls sync_msg and dispatches customer text into the reply pipeline", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errcode: 0, access_token: "token-1", expires_in: 7200 }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 0,
            has_more: false,
            msg_list: [
              {
                msgid: "msg-1",
                msgtype: "text",
                origin: 3,
                open_kfid: "kf-1",
                external_userid: "wm-user-9",
                text: { content: "hello from customer" },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const logs: string[] = [];
    const dispatchMock = vi.fn().mockResolvedValue(undefined);
    await processWechatKfCallbackEvent({
      cfg: { session: { store: "json" } } as OpenClawConfig,
      account: createAccount(),
      runtime: createRuntime(logs),
      channelRuntime: createChannelRuntime(dispatchMock),
      state: createWechatKfMonitorState(),
      event: { token: "sync-token", openKfId: "kf-1" },
    });
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
