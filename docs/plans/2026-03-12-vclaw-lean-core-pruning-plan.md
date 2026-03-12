# Vclaw Lean Core 瘦身计划（WeiClaw 基线）

日期：2026-03-12  
目标：在保持主线能力不退化的前提下，大幅瘦身仓库与运行面，形成 Vclaw 最小可用内核。

## 1. 主线能力（必须保留）

以下能力为硬约束，不可删：

1. 多智能体编排（orchestrator + registry + session）
2. 自动执行任务（含 CLI 驱动）
3. 技能可扩展（兼容 OpenClaw Skill 生态）
4. 永久记忆（三层 memory + 持久化）
5. 代码/文件/终端执行能力

## 2. 目标形态（Lean Core）

最终收敛为：

- 单一主入口：`vclaw`（兼容别名短期保留）
- 主代码域：
  - `src/agentos/**`
  - `src/cli/agentos.ts`
  - 与主线直接相关的执行/技能/安全最小依赖模块
- 存储：SQLite 主 + file fallback
- 文档：只保留主线文档与迁移文档

## 3. 白名单（保留）

第一阶段建议明确保留：

1. `src/agentos/**`（核心）
2. `src/cli/agentos.ts`（主 CLI）
3. `test/agentos/**`（主回归）
4. `skills/**`（技能生态兼容）
5. `docs/architecture.md`、`docs/roadmap.md`、`docs/cli-schema.md`、`docs/cli-usage.md`、`docs/plans/**`
6. 最小构建链：`package.json` 中与 AgentOS 相关脚本、`tsconfig.json`、`vitest*`（按需裁剪）

## 4. 黑名单候选（删除或下沉）

按“与主线无直接关系”分批处理：

1. 多端 App 与 UI：
  - `apps/**`
  - `ui/**`
2. 非主线渠道与插件大集合（先下沉，不直接硬删）：
  - `extensions/**`（保留与主线强依赖的最小集合，其他移到 `packages/optional-extensions`）
3. 旧 OpenClaw 网关重模块（按依赖图分批裁剪）：
  - `src/gateway/**`, `src/channels/**`, `src/discord/**`, `src/slack/**`, `src/telegram/**`, `src/whatsapp/**`, `src/signal/**`, `src/line/**`, `src/imessage/**`
4. 非主线工具链与历史资产：
  - 大量 Docker/e2e/平台打包脚本
  - `vendor/**`（若主线不依赖）
  - 多语言文档目录（`docs/zh-CN`, `docs/ja-JP`）可延后归档

## 5. 分波次执行

## Wave 0（基线冻结）

1. 冻结当前可运行基线（命令、JSON、记忆行为）
2. 补齐主线回归测试（见第 6 节）
3. 建立“删减安全阈值”：任何波次必须全绿

## Wave 1（品牌与入口收敛）

1. 统一品牌为 Vclaw（用户可见层）
2. CLI 主入口收敛为 `vclaw`
3. 保留兼容别名（`openclaw/weiclaw`）一段迁移窗口

## Wave 2（外围模块下沉）

1. 将 `extensions/**` 切分为 optional 包
2. 默认安装不带非主线扩展
3. 文档中把扩展能力标记为“按需安装”

## Wave 3（主仓物理瘦身）

1. 删除 apps/ui/重渠道模块
2. 删除不再引用脚本
3. 清理依赖并重写 scripts（最小脚本集）

## Wave 4（收口）

1. 依赖审计（`pnpm why` + deadcode）
2. 启动性能、包体积、冷启动时间对比
3. 输出 release note 与迁移指南

## 6. 验收测试矩阵（必须全绿）

## A. 主线功能

1. `agentos run`：显式角色 / preset / dynamic 三路
2. `chat` 基本回合
3. `inspect-memory` 三层一致性
4. `list-agents(list-roles)` / `inspect-role`

## B. 技能兼容

1. OpenClaw 风格 `SKILL.md` 识别
2. 技能匹配与执行路径
3. 异常技能输入的安全拒绝

## C. 执行能力

1. 终端命令执行
2. 文件写入/修改
3. 安全策略拦截（危险命令）

## D. 兼容与回退

1. 旧配置迁移
2. 旧命令别名可用（迁移窗口）
3. SQLite 不可用时 fallback 可用

## 7. 立即动作（下一步可执行）

1. 先做模块依赖图（只看主线引用链）
2. 产出“可删目录第一批（无引用）”
3. 先删 `apps/**` + `ui/**`（若主线零依赖）
4. 回归测试全跑，记录体积和启动时间变化

## 8. 风险

1. 直接物理删除可能破坏隐式依赖
2. 插件生态裁剪不当会影响技能兼容
3. 文档/脚本未同步会导致安装与运维失败

## 9. 完成标准

1. 主线能力无回退
2. 默认安装体积与依赖显著下降
3. 构建与测试时间显著下降
4. 用户可见层全部为 Vclaw，兼容层可控且可追踪
