import type { AgentOsStorage } from "../storage/storage.js";
import type {
  MemoryLayer,
  MemoryRecall,
  MemoryRecallHit,
  MemoryRecord,
  TaskRequest,
  TaskResult,
} from "../types.js";

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9\u4e00-\u9fa5]+/u)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  );
}

function memoryPreview(record: MemoryRecord): string {
  return collapseWhitespace(record.summary ?? record.content).slice(0, 180);
}

function scoreRecord(
  record: MemoryRecord,
  keywords: string[],
  index: number,
): number {
  const haystack = `${record.scope} ${record.summary ?? ""} ${record.content}`.toLowerCase();
  const matches = keywords.filter((keyword) => haystack.includes(keyword));
  const layerWeight =
    record.layer === "short-term" ? 4 : record.layer === "project-entity" ? 3 : 2;
  return matches.length * 6 + layerWeight + Math.max(0, 12 - index);
}

function recallSummary(hits: MemoryRecallHit[]): string[] {
  if (hits.length === 0) {
    return ["No prior session memory matched this task yet."];
  }
  return Array.from(new Set(hits.map((hit) => `[${hit.layer}] ${hit.summary}`)));
}

function shouldExcludeFromRecall(record: MemoryRecord): boolean {
  return (
    record.scope.endsWith(":memory-recall") ||
    record.scope.endsWith(":route") ||
    record.scope.endsWith(":goal")
  );
}

export class MemoryManager {
  constructor(private readonly storage: AgentOsStorage) {}

  async write(
    sessionId: string,
    layer: MemoryLayer,
    scope: string,
    content: string,
    sourceTaskId?: string,
    summary?: string,
  ): Promise<MemoryRecord> {
    return this.storage.appendMemory({
      sessionId,
      layer,
      scope,
      content,
      sourceTaskId,
      summary,
    });
  }

  async recall(request: TaskRequest, limit = 6): Promise<MemoryRecall> {
    const keywords = tokenize(
      [request.goal, request.taskType ?? "", ...(request.constraints ?? [])].join(" "),
    );
    const recent = (await this.storage.listMemory({
      sessionId: request.sessionId,
      limit: Math.max(limit * 8, 24),
    })).filter((record) => !shouldExcludeFromRecall(record));

    const scored = recent
      .map((record, index) => ({
        record,
        score: scoreRecord(record, keywords, index),
      }))
      .filter((entry) => entry.score > 0)
      .toSorted((left, right) => right.score - left.score)
      .slice(0, limit);

    const fallback = scored.length > 0 ? scored : recent.slice(0, Math.min(limit, 3)).map((record, index) => ({
      record,
      score: Math.max(1, 3 - index),
    }));

    const hits = [] as MemoryRecallHit[];
    const seen = new Set<string>();
    for (const { record, score } of fallback) {
      const summary = memoryPreview(record);
      const dedupeKey = `${record.layer}|${summary}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      hits.push({
        id: record.id,
        layer: record.layer,
        scope: record.scope,
        summary,
        sourceTaskId: record.sourceTaskId,
        createdAt: record.createdAt,
        score,
      });
    }

    return {
      query: request.goal,
      hits,
      summary: recallSummary(hits),
    };
  }

  async captureRun(request: TaskRequest, result: TaskResult): Promise<void> {
    await this.write(
      request.sessionId,
      "short-term",
      `session:${request.sessionId}:goal`,
      request.goal,
      result.requestId,
    );
    await this.write(
      request.sessionId,
      "short-term",
      `session:${request.sessionId}:route`,
      JSON.stringify(
        {
          routeSummary: result.routeSummary,
          selectedRoles: result.selectedRoles,
          selectionReasons: result.selectionReasons,
          executionMode: result.executionMode,
        },
        null,
        2,
      ),
      result.requestId,
      result.routeSummary,
    );
    if (result.memoryContext.hits.length > 0) {
      await this.write(
        request.sessionId,
        "short-term",
        `session:${request.sessionId}:memory-recall`,
        JSON.stringify(result.memoryContext, null, 2),
        result.requestId,
        result.memoryContext.summary.join(" | "),
      );
    }
    await this.write(
      request.sessionId,
      "long-term",
      "long-term:summary",
      result.conclusion,
      result.requestId,
      result.conclusion,
    );
    await this.write(
      request.sessionId,
      "project-entity",
      "entity:delivery",
      JSON.stringify(
        {
          requestId: result.requestId,
          goal: request.goal,
          conclusion: result.conclusion,
          selectedRoles: result.selectedRoles,
          executionMode: result.executionMode,
        },
        null,
        2,
      ),
      result.requestId,
      result.conclusion,
    );
    for (const execution of result.roleExecutions) {
      await this.write(
        request.sessionId,
        "short-term",
        `session:${request.sessionId}:role:${execution.roleId}`,
        execution.output,
        result.requestId,
        execution.conclusion,
      );
    }
    if (result.deerflow?.ok) {
      await this.write(
        request.sessionId,
        "long-term",
        "long-term:deerflow",
        result.deerflow.summary,
        result.requestId,
        result.deerflow.summary,
      );
      if (result.deerflow.sources.length > 0 || result.deerflow.artifacts.length > 0) {
        await this.write(
          request.sessionId,
          "project-entity",
          "entity:research",
          JSON.stringify(
            {
              sources: result.deerflow.sources,
              artifacts: result.deerflow.artifacts,
            },
            null,
            2,
          ),
          result.requestId,
          result.deerflow.summary,
        );
      }
    }
  }

  async inspect(sessionId: string, limit = 20): Promise<MemoryRecord[]> {
    return this.storage.listMemory({ sessionId, limit });
  }

  async inspectByLayer(sessionId: string, layer: MemoryLayer, limit = 20): Promise<MemoryRecord[]> {
    return this.storage.listMemory({ sessionId, layer, limit });
  }
}
