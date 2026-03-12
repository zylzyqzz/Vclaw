import type { AgentOsStorage } from "../storage/storage.js";
import type { MemoryLayer, MemoryRecord, TaskRequest, TaskResult } from "../types.js";

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
