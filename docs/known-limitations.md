# Vclaw AgentOS Known Limitations

## Scope

- 当前仍是本地优先、单机主线，不是分布式多机编排系统。
- 当前没有复杂前端控制台，CLI 仍是主入口。

## Routing

- `dynamic routing` 目前是配置驱动的可解释评分，不是自学习路由器。
- 路由质量仍依赖角色能力标签、preset 定义和 routing 配置质量。

## Memory

- 现阶段的 memory 主要用于执行留痕、回放与辅助检索，不是完整知识库系统。
- 还没有做高级压缩、冲突合并、自动淘汰等更重的记忆治理。

## CLI

- `chat` 更偏本地调试入口，不是外部协议网关。
- 需要稳定集成时，优先使用 `--json`，不要依赖人类可读文本。

## Compatibility

- `.weiclaw-agentos.json` 已降级为兼容迁移输入，不应再作为新写入目标。
- `openclaw/plugin-sdk`、`OPENCLAW_*` 环境变量和部分旧路径仍保留，以保证技能生态与插件兼容。
