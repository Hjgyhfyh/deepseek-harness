# @deepseek-ai/dsh-botforge

[English](README.md) | 中文

员工名册、编排器提示词，以及 `delegate_employee` 工具。配置位于 host 设置文档：`botforge-workers` 保存名册，`botforge-orchestrator` 保存总开关与编排器人设。Web 设置页与侧栏见 [`dsh-client-ui-botforge`](../../client/ui-botforge/README.md)。

总开关 `enabled`（默认 `true`）会同时去掉编排器 system-prompt 分段并注销 `delegate_employee`。设置页保持挂载，以便用户重新打开插件。被禁用的员工仍会保存，但不会出现在提示词中，工具也会拒绝他们。

每位员工有自己的系统提示词、skill 名称和 MCP 服务器。`delegate_employee` 默认通过进程内 `spawn` provider 启动一个可继续 child，将其 label 设为 `employee:<id>: <description>` 供侧栏匹配；在 provider 声明 persona 能力时写入人设；启动前从 `ctx.skills` 加载 skill 正文；并在 child 发布后把该员工的 MCP 服务器挂到 child 的 context 上。

## 设置

| Namespace | 字段 |
|---|---|
| `botforge-workers` | `workers[]`，含 `id`、`enabled`、`name`、`role`、`roleDescription`、`skills`、`hint`、`triggers`、`systemPrompt`、`avatar`、`avatarSeed`、`mcp[]` |
| `botforge-orchestrator` | `enabled`、`name`、`systemPrompt`、`mcp[]` |

重复或空的员工 id 会让 workers 分段校验失败。空的已存名册回退到内置员工。编排器的 MCP 行只出现在父级提示词中，不会自动挂到父 agent 上。

## 事件

`botforge/config` 在 live 设置提交后触发。`botforge/routed` 在后台 `delegate_employee` 成功启动后触发，携带 child id、prompt 文本、所选员工 id，以及增强后的提示词文本。

## 模型体验

### 编排器提示词分段

#### 模型看到的内容

当 `enabled` 为 true 时，名为 `botforge:workers` 的 system-prompt 分段（order 12）包含已存储的编排器人设、下面这段稳定包装文字，以及每位已启用员工的一条列表（id、名称、简介、skills、系统提示词、MCP）。已启用但名册为空时渲染 `- (no enabled employees)`。关闭插件，或为委派 child 组装（`origin: 'subagent'` 或 `delegationDepth > 0`），会返回空字符串，因此该分段不会进入这个 agent 的提示词。

##### 委派包装文字

```markdown
Delegate with delegate_employee(employee_id, description, prompt). employee_id must be one of the ids below.
```

##### 员工列表标题

```markdown
Employees (each has its own system prompt, skills, and MCP):
```

#### Token 影响

取决于总开关，以及正在组装的 agent 是否为根会话。体积跟随已存储的编排器提示词，以及每位已启用员工的简介、skills、系统提示词和 MCP 列表；插件对该根 agent 保持开启时会一直保留到压缩（compaction）。

#### KV Cache 影响

只要 `enabled`、编排器人设和已启用名册文本不变，前缀就保持稳定。切换插件或编辑这些已存字段会使从此分段起的缓存复用失效。

### 员工 child 身份

#### 模型看到的内容

员工 child 不会收到编排器分段。其 `deployment:persona` 以 `Ты — сотрудник «<name>» (id <id>), специалист. Ты не оркестратор. Выполни порученную задачу сам. Не порождай других агентов.` 开头，随后是已存储的员工系统提示词和已加载的 skill 正文。启动请求还会传入 `toolFilter.deny`，点名父级当前可见的派生工具（`delegate_employee`、`subagent`、`subagent_*`、`send_message`、`interrupt_agent`、`list_agents`）。child 加入父级 preset 之后，同一份 deny 列表会应用到 `childCtx.tools` 上，并且当调用者是员工 child 时，进程级 guard 会拒绝这些名称。来自委派会话的嵌套 `delegate_employee` 调用会被拒绝，错误为 `Error: delegate_employee is only available to the orchestrator`。

#### Token 影响

这段 specialist 段落是每个员工 child 请求上的固定前缀。被拒绝的工具 schema 离开 child 请求；它们仍留在父级上。

#### KV Cache 影响

只要该员工已存储的提示词、已加载的 skill 正文和被拒绝的工具集合不变，单个 child 的前缀就保持稳定。不同的员工 id 或名称会改变开头段落。

### 委派工具

#### 模型看到的内容

插件开启时，根 agent 会收到 `delegate_employee`，必填参数为 `employee_id`、`description`、`prompt`，可选 `run_in_background`（默认 true）。描述要求模型在工作属于名册中的具名员工时使用该工具，而不是 `subagent`。本包不是 `tool-*` 叶子包，因此生成的 [工具 catalog](../../../docs/tool-catalog.md) 不会采集它。

#### Token 影响

工具已注册时，每个父级请求都有固定的 schema token 开销。关闭插件会同时移除该 schema 和提示词分段。

#### KV Cache 影响

只要工具保持注册且描述与参数不变，前缀就保持稳定。启用／禁用会重新挂载工具，并可能使从第一个变化的工具定义起的缓存复用失效。

### 可继续结果

#### 模型看到的内容

省略或为 true 的 `run_in_background` 会启动可继续 child，并原样返回 `started employee <childId>`。每次调用都会与该员工开启一个全新会话——一个任务一个聊天：新任务请再次调用本工具，而不是把所有内容都发进同一个聊天；`send_message`（已加载时）只用于向同一任务的那个聊天补充工作，其 `deliver: "now"` 模式会先中断员工当前轮次并立即送达。

#### Token 影响

确认文本保留在父级历史中。child 的工作上下文留在 child 中。

#### KV Cache 影响

仅追加；新可见内容位于可复用请求前缀之后，不会使现有 KV-cache 条目失效。

### 前台结果

#### 模型看到的内容

`run_in_background: false` 会等待 child 并返回其最终文本。非 `completed` 的停止原因变为 `Error: employee run ended (<reason>)`。未知、已禁用或缺失的员工、缺失的 spawn provider、缺失的调用 agent，以及委派调用者，都会成为出错的工具结果。

#### Token 影响

prompt 与结果会保留在父级历史中直到压缩（compaction）；child 的工作上下文留在 child 中。

#### KV Cache 影响

仅追加；新可见内容位于可复用请求前缀之后，不会使现有 KV-cache 条目失效。

## 已知限制与暂缓事项

- **编排器 MCP 仅出现在提示词中** — 这些行提供给父级模型，不会挂成父级工具，因此不会泄漏到 host context 上的每个 agent。
- **员工 MCP 在可继续发布之后才挂载** — skill 正文在启动前加载；MCP 服务器在已发布的 child 上启动，如果第一轮立即开始，可能赶不上第一次模型请求。
- **侧栏优先匹配 `employee:` label** — 普通 `subagent` child 仍会在已启用员工的 id 或名称出现在其 label 中时显示。
- **已经驻留的员工 Activation 会保留创建时的工具集，直到重新物化** — 重启进程或一次新的 `delegate_employee` 会重建 child 并应用派生锁定。
- **仍把 child 称作编排器的已存员工提示词会被框住，而不是改写** — specialist 身份会前置；要删掉残留的编排器文案，请在设置中编辑该行。
