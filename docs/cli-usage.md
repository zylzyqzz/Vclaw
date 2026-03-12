# Vclaw AgentOS CLI Usage

## 推荐入口

首选入口:

```bash
pnpm vclaw:agentos -- <command>
```

兼容入口:

```bash
pnpm agentos -- <command>
```

## 命令分组

### 运行

- `demo [--goal <text>] [--preset <id>] [--session <id>]`
- `run --goal <text> [--roles a,b] [--preset <id>] [--task-type <type>] [--required-capabilities a,b] [--preferred-roles a,b] [--excluded-roles a,b]`
- `chat [--roles a,b] [--preset <id>]`

### 角色

- `list-roles`
- `inspect-role --id <roleId>`
- `create-role --id <roleId> ...`
- `update-role --id <roleId> ...`
- `enable-role --id <roleId>`
- `disable-role --id <roleId>`
- `delete-role --id <roleId>`
- `export-role --id <roleId> --file <path.json>`
- `import-role --file <path.json> [--overwrite true|false]`
- `validate-role --id <roleId> | --file <path.json>`

### 预设

- `list-presets`
- `inspect-preset --id <presetId>`
- `create-preset --id <presetId> --roles a,b --order a,b`
- `update-preset --id <presetId> ...`
- `delete-preset --id <presetId>`
- `export-preset --id <presetId> --file <path.json>`
- `import-preset --file <path.json> [--overwrite true|false]`
- `validate-preset --id <presetId> | --file <path.json>`

### 记忆

- `inspect-memory [--session <id>] [--layer short-term|long-term|project-entity]`

兼容别名:

- `list-agents` 仍可用，建议统一迁移到 `list-roles`

## 常见用法

### 强制角色执行

```bash
pnpm vclaw:agentos -- run --goal "评审当前风险" --roles planner,reviewer
```

### 使用预设组合

```bash
pnpm vclaw:agentos -- run --goal "完成 v2.1.0 发布规划" --preset default-demo
```

### 动态路由

```bash
pnpm vclaw:agentos -- run --goal "调查性能瓶颈" --task-type research --required-capabilities research --preset ""
```

### 机器可读模式

```bash
pnpm vclaw:agentos -- run --goal "输出 JSON 契约" --preset default-demo --json
```

### 观察 memory 写入

```bash
pnpm vclaw:agentos -- demo --session demo-main
pnpm vclaw:agentos -- inspect-memory --session demo-main --json
```

默认一次 `run` 会写入三层 memory:

- `short-term`
- `long-term`
- `project-entity`

## Exit Codes

- `0` 成功
- `1` 参数错误 / 未知命令 / 未预期错误
- `2` 校验失败
- `3` 资源不存在或冲突

结构化错误对象见 `docs/cli-schema.md`。

## Vclaw Bridge

通过 AgentOS 统一入口把任务委托给外部 `Vclaw` 执行:

```bash
pnpm vclaw:agentos -- vclaw-run --task "scan workspace and summarize risks" --json
```

可选参数:

- `--vclaw-bin <path>`: 显式指定 Vclaw 可执行文件
- `--vclaw-config <path>`: 透传 Vclaw 配置文件
- `--allow-write true|false`: 控制是否允许写入
- `--timeout-ms <number>`: 子进程超时毫秒数
