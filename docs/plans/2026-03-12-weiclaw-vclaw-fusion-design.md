# WeiClaw + Vclaw 融合设计（第一阶段）

日期：2026-03-12

## 目标
- 在不重写现有两套内核的前提下，先实现可运行融合。
- 以 WeiClaw-AgentOS 作为统一入口，接入 Vclaw 的执行能力。
- 保持本地优先、低风险、可回退。

## 方案选择
- 方案 A（本次落地）：CLI Bridge
- 方案 B：进程级 RPC Bridge（后续）
- 方案 C：内核级重构合并（最后阶段）

本次采用方案 A，原因：
- 改动小，今天就能跑。
- 不破坏两边现有发布路径。
- 为后续 RPC 统一协议打基础。

## 第一阶段落地内容
- 新增 `src/agentos/integration/vclaw-bridge.ts`
  - 解析 `vclaw` 可执行文件路径
  - 调用 `vclaw run <task>`
  - 返回统一结构：`ok/exitCode/stdout/stderr/durationMs`
- 新增 `agentos` 命令：`vclaw-run`
  - `--task` / `--goal`
  - `--allow-write`
  - `--vclaw-bin`
  - `--vclaw-config`
  - `--timeout-ms`
- 输出统一为 AgentOS 契约字段（`conclusion/plan/risks/acceptance` + bridge 详情）。

## 下一阶段（建议）
1. 增加 `vclaw status`、`vclaw logs` 桥接命令。
2. 为 `vclaw-run` 增加会话记忆写入（short-term/long-term/project-entity）。
3. 定义 WeiClaw ↔ Vclaw 的 JSON-RPC 协议，替代纯 CLI 调用。
4. 对齐统一配置模型（provider/model/channel）。

## 风险
- `vclaw run` 依赖 Vclaw 本地配置和密钥，未配置会非零退出。
- CLI 输出文本格式可能变化，后续应切换到结构化 RPC。

## 验收标准
- `pnpm agentos -- vclaw-run --task "..." --json` 可执行并返回统一结构。
- 二进制缺失时返回结构化失败，不崩溃。
