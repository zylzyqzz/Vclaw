# WeiClaw-AgentOS 体检报告（2026-03-12）

## 1. 体检范围
- 仓库结构与关键目录
- AgentOS v2.1.0 核心能力覆盖
- 本地运行环境与依赖
- CLI 可用性 smoke
- AgentOS 测试集（`test/agentos`）

## 2. 环境与基础状态
- Node: `v25.8.0`
- pnpm: `10.23.0`
- 依赖安装: `pnpm install --frozen-lockfile` 成功
- 结论: 可执行体检环境已具备

## 3. MVP 对齐检查结果

### 3.1 关键模块
已发现并实现：
- orchestrator: `src/agentos/orchestrator/orchestrator.ts`
- agent registry: `src/agentos/registry/agent-registry.ts`
- session store: `src/agentos/session/session-store.ts`
- memory manager: `src/agentos/memory/memory-manager.ts`
- config loader: `src/agentos/config/loader.ts`
- CLI entry: `src/cli/agentos.ts`

### 3.2 核心类型
已存在并命名匹配：
- `AgentDefinition`（未发现同名；当前模型采用 `RoleTemplate` + `RuntimeAgent`）
- `TaskRequest`
- `TaskResult`
- `SessionState`
- `MemoryRecord`
- `OrchestratorConfig`

说明：当前代码基线以 `RoleTemplate + RuntimeAgent` 替代单一 `AgentDefinition`，语义更细化。

### 3.3 三层记忆
已实现并落库：
- short-term session memory
- long-term summarized memory
- project/entity memory

证据：`MemoryManager.captureRun()` 会写入三层记录；`inspect-memory --json` 实测返回三层各 1 条。

### 3.4 存储策略
已实现：
- SQLite 主存储：`src/agentos/storage/sqlite-storage.ts`
- file fallback：`src/agentos/storage/file-storage.ts`
- 抽象接口：`src/agentos/storage/storage.ts`

### 3.5 CLI 最低命令
已实现并可调用：
- `run`
- `chat`
- `inspect-memory`
- `list-agents`（兼容别名，映射至 `list-roles`）

### 3.6 Demo 角色
已内置：
- commander
- planner
- builder
- reviewer

证据：`src/agentos/runtime/defaults.ts`。

## 4. 可执行体检结果

### 4.1 CLI smoke
- `pnpm agentos -- help`：通过
- `pnpm agentos -- demo --json`：通过
- `pnpm agentos -- inspect-memory --session demo-main --json`：通过

结论：核心 CLI 路径在当前环境可运行。

### 4.2 测试集（test/agentos）
执行：`pnpm exec vitest run test/agentos`

结果：
- Test Files: 12
- 通过: 8
- 失败: 4
- Tests: 23
- 通过: 16
- 失败: 7

失败集中在两类：

1) CLI 测试启动参数与 Windows + Node 25 不兼容
- 受影响：
  - `test/agentos/cli-help-demo.test.ts`
  - `test/agentos/cli-json-exit.test.ts`
  - `test/agentos/readme-smoke.test.ts`
- 根因：测试里使用 `node --import <绝对Windows路径到loader.mjs>`；Node 25 在 Windows 下要求 `file://` URL 或可解析 specifier，直接 `E:\...` 会触发 `ERR_UNSUPPORTED_ESM_URL_SCHEME`。
- 现象：子进程退出码统一变为 1，导致断言失败。

2) fallback 测试的跨平台路径假设不稳
- 受影响：`test/agentos/storage-fallback.test.ts`
- 根因：测试用 `storagePath: /dev/null/agentos.db` 触发 SQLite 失败并走 fallback，这一前提在当前环境未稳定满足，导致未生成 fallback 文件。

## 5. 代码质量观察（非阻塞）
- `README.md` 在当前工作区显示明显编码异常（中文乱码），会影响可读性与对外文档质量。
- 体系文档（`docs/architecture.md`, `docs/roadmap.md`）结构完整，和代码主体基本一致。

## 6. 体检结论（分级）
- 总体评级：`B+`（主功能健康，可本地运行；测试跨平台兼容需修复）
- 发布建议：
  - 若目标是“本地手工运行演示”，当前可继续推进
  - 若目标是“CI 稳定绿灯 / 可发布质量”，需先修复上述 4 个失败测试文件

## 7. 建议修复顺序
1. 修 CLI 测试启动方式
- 将测试中的 `--import <absolute loader path>` 改为跨平台稳定写法（例如 `--import tsx` 或 `file://` URL 化）。

2. 修 fallback 测试用例
- 用可控 mock/环境变量方式强制走 fallback，而不是依赖 `/dev/null` 路径行为。

3. 修 README 编码问题
- 统一 UTF-8（无 BOM）并重新保存，恢复中文可读性。

## 8. Output Contract

### conclusion
核心 AgentOS 路径已落地并可运行，MVP 覆盖度高；当前主要风险是测试兼容性（Windows + Node 25）和文档编码质量。

### plan
- 优先修复 `test/agentos` 中 4 个失败文件
- 回归执行 `pnpm exec vitest run test/agentos`
- 修复并校验 `README.md` 编码

### risks
- 测试不稳定会阻塞 CI 与版本发布信心
- 文档乱码会影响协作与使用门槛

### acceptance
- `pnpm exec vitest run test/agentos` 全绿
- `pnpm agentos -- help/demo/inspect-memory --json` 持续通过
- README 中文显示正常、命令可复制执行
