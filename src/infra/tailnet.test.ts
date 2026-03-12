import os from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listTailnetAddresses, pickPrimaryTailnetIPv4, pickPrimaryTailnetIPv6 } from "./tailnet.js";

describe("tailnet address discovery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty results when network interface inspection throws", () => {
    vi.spyOn(os, "networkInterfaces").mockImplementation(() => {
      throw new Error("sandbox denied");
    });

    expect(listTailnetAddresses()).toEqual({ ipv4: [], ipv6: [] });
    expect(pickPrimaryTailnetIPv4()).toBeUndefined();
    expect(pickPrimaryTailnetIPv6()).toBeUndefined();
  });
});
