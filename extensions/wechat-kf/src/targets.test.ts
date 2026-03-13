import { describe, expect, it } from "vitest";
import {
  formatWechatKfTarget,
  normalizeWechatKfAllowEntry,
  parseWechatKfTarget,
  resolveWechatKfTarget,
} from "./targets.js";

describe("wechat-kf targets", () => {
  it("formats and parses explicit targets", () => {
    const target = formatWechatKfTarget({
      openKfId: "open_kf_123",
      externalUserId: "wm-user-9",
    });
    expect(target).toBe("open_kfid:open_kf_123|external_userid:wm-user-9");
    expect(parseWechatKfTarget(target)).toEqual({
      openKfId: "open_kf_123",
      externalUserId: "wm-user-9",
    });
  });

  it("resolves bare external user ids with a default open_kfid", () => {
    expect(resolveWechatKfTarget("wm-user-9", "open_kf_123")).toEqual({
      openKfId: "open_kf_123",
      externalUserId: "wm-user-9",
    });
  });

  it("normalizes channel-prefixed allow entries", () => {
    expect(
      normalizeWechatKfAllowEntry(
        "wechat-kf:open_kfid:open_kf_123|external_userid:wm-user-9",
      ),
    ).toBe("open_kfid:open_kf_123|external_userid:wm-user-9");
  });
});
