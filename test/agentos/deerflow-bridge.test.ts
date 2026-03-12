import { describe, expect, it } from "vitest";
import { defaultOrchestratorConfig } from "../../src/agentos/config/loader.js";
import {
  DeerFlowEmbeddedBridge,
  parseDeerFlowMarkdownResponse,
  shouldUseDeerFlow,
} from "../../src/agentos/integration/deerflow-bridge.js";

describe("deerflow bridge", () => {
  it("activates only for enabled research-shaped tasks unless forced", () => {
    const config = defaultOrchestratorConfig(process.cwd()).deerflow;

    const disabled = shouldUseDeerFlow(config, {
      sessionId: "s1",
      goal: "research market trends",
      taskType: "research",
    });
    expect(disabled.use).toBe(false);

    const enabled = shouldUseDeerFlow(
      {
        ...config,
        enabled: true,
      },
      {
        sessionId: "s2",
        goal: "research market trends",
        taskType: "research",
      },
    );
    expect(enabled.use).toBe(true);
    expect(enabled.reasons.join(" ")).toContain("taskType matched: research");

    const forced = shouldUseDeerFlow(config, {
      sessionId: "s3",
      goal: "quick check",
      deerflow: { force: true },
    });
    expect(forced.use).toBe(true);
    expect(forced.reasons).toEqual(["forced per request"]);
  });

  it("parses DeerFlow markdown into the Vclaw task contract", () => {
    const parsed = parseDeerFlowMarkdownResponse(
      [
        "Conclusion",
        "DeerFlow synthesized a stronger research answer.",
        "",
        "Plan",
        "- collect source material",
        "- compare direct competitors",
        "",
        "Risks",
        "- source drift",
        "",
        "Acceptance",
        "- includes actionable summary",
        "",
        "Sources",
        "- https://example.com/report",
      ].join("\n"),
      "ultra",
    );

    expect(parsed.ok).toBe(true);
    expect(parsed.conclusion).toContain("stronger research answer");
    expect(parsed.plan).toEqual(["collect source material", "compare direct competitors"]);
    expect(parsed.risks).toEqual(["source drift"]);
    expect(parsed.acceptance).toEqual(["includes actionable summary"]);
    expect(parsed.sources).toEqual(["https://example.com/report"]);
  });

  it("returns unavailable when the DeerFlow backend is not configured", async () => {
    const config = {
      ...defaultOrchestratorConfig(process.cwd()).deerflow,
      enabled: true,
      embedded: {
        ...defaultOrchestratorConfig(process.cwd()).deerflow.embedded,
        backendPath: undefined,
      },
    };
    const bridge = new DeerFlowEmbeddedBridge(config);

    const result = await bridge.run({
      taskId: "task-1",
      sessionId: "session-1",
      goal: "research integration fit",
      constraints: [],
      requestedOutput: "conclusion + plan + risks + acceptance",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("unavailable");
    expect(result.error).toContain("not configured");
  });
});
