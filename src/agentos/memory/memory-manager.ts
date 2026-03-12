import type { AgentOsStorage } from "../storage/storage.js";
import type { DeerFlowBridgeResponse, MemoryLayer, MemoryRecord } from "../types.js";

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

  async captureRun(
    sessionId: string,
    goal: string,
    conclusion: string,
    taskId: string,
    deerflow?: DeerFlowBridgeResponse,
  ): Promise<void> {
    await this.write(sessionId, "short-term", `session:${sessionId}`, goal, taskId);
    await this.write(sessionId, "long-term", "long-term:summary", conclusion, taskId, conclusion);
    await this.write(
      sessionId,
      "project-entity",
      "entity:delivery",
      `Task ${taskId} completed with conclusion: ${conclusion}`,
      taskId,
    );
    if (deerflow?.ok) {
      await this.write(
        sessionId,
        "long-term",
        "long-term:deerflow",
        deerflow.summary,
        taskId,
        deerflow.summary,
      );
      if (deerflow.sources.length > 0 || deerflow.artifacts.length > 0) {
        await this.write(
          sessionId,
          "project-entity",
          "entity:research",
          JSON.stringify(
            {
              sources: deerflow.sources,
              artifacts: deerflow.artifacts,
            },
            null,
            2,
          ),
          taskId,
          deerflow.summary,
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
