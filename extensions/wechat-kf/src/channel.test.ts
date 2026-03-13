import { describe, expect, it } from "vitest";
import { wechatKfPlugin } from "./channel.js";

function collectWechatKfIssues(snapshot: Record<string, unknown>) {
  const collect = wechatKfPlugin.status?.collectStatusIssues;
  if (!collect) {
    return [];
  }
  return collect(
    [
      {
        accountId: "default",
        enabled: true,
        configured: true,
        webhookPath: "/plugins/wechat-kf/default",
        defaultOpenKfId: "wkf_123",
        ...snapshot,
      },
    ] as never,
  );
}

describe("wechat-kf status issues", () => {
  it("warns when webhookUrl is missing", () => {
    const issues = collectWechatKfIssues({ webhookUrl: undefined });
    expect(issues.map((issue) => issue.message)).toContain(
      "WeChat KF webhookUrl is missing. Enterprise WeChat needs a public HTTPS callback URL; webhookPath only defines the local route.",
    );
  });

  it("warns when webhookUrl is not https", () => {
    const issues = collectWechatKfIssues({
      webhookUrl: "http://bot.example.com/plugins/wechat-kf/default",
    });
    expect(issues.map((issue) => issue.message)).toContain(
      "WeChat KF webhookUrl must use HTTPS for Enterprise WeChat callbacks.",
    );
  });

  it("warns when webhookUrl points to loopback or the wrong path", () => {
    const issues = collectWechatKfIssues({
      webhookUrl: "https://127.0.0.1/plugins/wechat-kf/other",
    });
    const messages = issues.map((issue) => issue.message);
    expect(messages).toContain(
      "WeChat KF webhookUrl points to localhost or another loopback host. Enterprise WeChat cannot reach that address.",
    );
    expect(messages).toContain(
      "WeChat KF webhookUrl path does not match webhookPath, so callback requests may hit the wrong route.",
    );
  });

  it("does not emit callback warnings for a public https URL that matches webhookPath", () => {
    const issues = collectWechatKfIssues({
      webhookUrl: "https://bot.example.com/plugins/wechat-kf/default",
    });
    expect(issues.map((issue) => issue.message)).not.toContain(
      "WeChat KF webhookUrl is missing. Enterprise WeChat needs a public HTTPS callback URL; webhookPath only defines the local route.",
    );
    expect(issues.map((issue) => issue.message)).not.toContain(
      "WeChat KF webhookUrl must use HTTPS for Enterprise WeChat callbacks.",
    );
    expect(issues.map((issue) => issue.message)).not.toContain(
      "WeChat KF webhookUrl points to localhost or another loopback host. Enterprise WeChat cannot reach that address.",
    );
    expect(issues.map((issue) => issue.message)).not.toContain(
      "WeChat KF webhookUrl path does not match webhookPath, so callback requests may hit the wrong route.",
    );
  });
});
