import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Vclaw install entry contracts", () => {
  it("keeps the Unix installer as a thin GitHub bootstrap wrapper", async () => {
    const raw = await readFile(path.resolve("scripts/install.sh"), "utf8");

    expect(raw).toContain("Vclaw Installer");
    expect(raw).toContain("vclaw-bootstrap.sh");
    expect(raw).toContain("https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts");
    expect(raw).toContain("Compatible with openclaw skills");
    expect(raw).toContain("--git-dir");
  });

  it("keeps the Windows installer as a thin GitHub bootstrap wrapper", async () => {
    const raw = await readFile(path.resolve("scripts/install.ps1"), "utf8");

    expect(raw).toContain("Vclaw Installer");
    expect(raw).toContain("vclaw-bootstrap.ps1");
    expect(raw).toContain("https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/install.ps1");
    expect(raw).toContain("Compatible with openclaw skills");
    expect(raw).toContain("-GitDir");
  });
});
