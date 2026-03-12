import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const primaryDocs = [
  "README.md",
  "docs/index.md",
  "docs/start/getting-started.md",
  "docs/start/quickstart.md",
  "docs/start/setup.md",
  "docs/start/personal-assistant.md",
  "docs/gateway/index.md",
];

describe("Vclaw documentation surface", () => {
  it("keeps primary entry docs free from legacy public branding", async () => {
    const legacyPattern = /\b(?:OpenClaw|openclaw|WeiClaw|weiclaw|Wei Claw|Open Claw)\b/;

    for (const relativePath of primaryDocs) {
      const raw = await readFile(path.resolve(relativePath), "utf8");
      expect(raw, relativePath).not.toMatch(legacyPattern);
    }
  });

  it("shows the date-based release number on primary entry docs", async () => {
    for (const relativePath of [
      "README.md",
      "docs/index.md",
      "docs/start/getting-started.md",
      "docs/start/setup.md",
      "docs/start/personal-assistant.md",
      "docs/gateway/index.md",
    ]) {
      const raw = await readFile(path.resolve(relativePath), "utf8");
      expect(raw, relativePath).toContain("2026.3.12");
    }
  });

  it("documents GitHub bootstrap installation on the primary install docs", async () => {
    const expectedUrls = [
      "https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/vclaw-bootstrap.sh",
      "https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/vclaw-bootstrap.ps1",
    ];

    for (const relativePath of ["README.md", "docs/index.md", "docs/start/getting-started.md"]) {
      const raw = await readFile(path.resolve(relativePath), "utf8");
      for (const url of expectedUrls) {
        expect(raw, `${relativePath} should include ${url}`).toContain(url);
      }
    }
  });
});
