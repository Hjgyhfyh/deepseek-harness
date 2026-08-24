# @deepseek-ai/dsh-client-ui-botforge

[English](README.md) | 中文

员工界面插件（浏览器端部分）。「设置 → 员工」（slot `settings.section`，id `employees`，order 22）编辑 host 的 `botforge-workers` 与 `botforge-orchestrator` 文档：插件总开关、编排器人设与 MCP 列表，以及每位员工的系统提示词、skills 和 MCP 服务器。右侧 `shell.overlay` 侧栏列出当前会话（或其父会话）中 label 能匹配到员工的 child，并通过 `sessions.openSubagent` 打开它们。overlay 根节点就是侧栏面板本身，因此 shell 其余部分保持 `pointer-events: none`。

关闭插件会隐藏侧栏；设置页保持挂载，以便用户重新打开。不再注册此前侧栏底部的 BotForge 按钮和假聊天浮层。

`/client` 的导出接口包括插件本体（`apply`/`inject`）以及设置页与侧栏的注入面。

## 模型体验

间接影响：本页写入 host 的 `botforge-workers` 与 `botforge-orchestrator` 设置，面向模型的提示词分段和 `delegate_employee` 工具由 [`dsh-botforge`](../../botforge/botforge/README.md) 持有。

#### KV Cache 影响

本包没有影响。host 设置提交后，`dsh-botforge` 重建提示词分段或重新挂载工具时，可能会使父级请求前缀的缓存复用失效。

## 已知限制与暂缓事项

- **侧栏只做匹配** — 它不会启动员工；host 工具创建 child，本 overlay 只展示匹配到的 catalog 行。
