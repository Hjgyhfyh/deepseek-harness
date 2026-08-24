# Agent Note: 员工 child 不是编排器

Status: implemented

[English](2026-08-21-employee-children-are-not-orchestrators.md) | 中文

## 问题

`delegate_employee` 会启动一个进程内 `spawn` child，该 child 加入父级 preset，并继承 host 全局注册。BotForge 编排器分段 `botforge:workers`（order 12）和 `delegate_employee` 工具都是 host 全局的，child 还会继承 preset 上的 `subagent` / `subagent_fork` / `send_message` / `interrupt_agent` / `list_agents`。child 自己的 `deployment:persona` 只覆盖 order 0，因此每位员工仍然读到「你是编排器，请调用 `delegate_employee`」，并且仍然能看见这些工具。嵌套 child 随后作为更多员工出现在实时侧栏中。

## 决策

当正在组装的 agent 是委派会话（`origin: 'subagent'` 或 `delegationDepth > 0`）时，编排器分段为空。只有根会话保留名册和 `delegate_employee` 指令。

每次员工启动都会构建非空的 specialist 人设：写明名册 id、声明该 child 不是编排器，并禁止再派生。当 spawn provider 声明 `persona` 能力时，这段文字就是 child 的 `deployment:persona`；否则它被前置到用户 prompt。

派生工具在员工 child 上被隐藏并拒绝执行，而不是只写在父级启动请求上。`isDelegationTool` 匹配 `delegate_employee`、`subagent`、任何 `subagent_*` 名称、`send_message`、`interrupt_agent` 和 `list_agents`。启动请求的 `toolFilter.deny` 只列出父级当前可见的子集；未知名称会被省略，因为 `tools.restrict()` 遇到未知名称会大声失败。`applyChildComposition` 加入父级 preset 之后，`registerContinuableSetup` 在 `childCtx.tools` 上调用 `lockEmployeeDelegation`（必须用 scoped accessor，而不是 `ctx.get('tools')`），这样 `subagent_fork` 这类 preset 行会在第一轮模型请求之前进入 deny 列表。`installEmployeeExtras` 在已发布或一次性 child 上应用同一把锁。进程级 `tools.guard` 在调用者是员工 child（`employee:` 创建 label）时拒绝这些名称。`delegate_employee` 本身会拒绝会话已经是委派会话的调用者。

已存储的员工系统提示词不会被改写。若某一行仍含编排器文案，会被 specialist 段落框住；要删掉该文案，需要在设置中编辑该行。

## 验证

`packages/botforge/botforge/tests/prompt.spec.ts` 覆盖委派 header 下的空分段，以及 specialist 人设前缀，包括空白已存提示词和仅有 skill 名称的回退。`tool.spec.ts` 覆盖嵌套调用者拒绝、仅针对父级可见名称（含 `subagent_fork`）的 `toolFilter.deny`、空白提示词时仍带 specialist 段落的 persona，以及 provider 没有 persona 能力时的 prompt 前置。`delegation-lock.spec.ts` 覆盖 `isDelegationTool`、child 上的 restrict-and-guard 锁定，以及来自 `subagent/descriptor` 的 `employee:` 身份。`extras.spec.ts` 覆盖 extras 路径上的锁定。`index.spec.ts` 用 child 的 `AssembleContext.agent` 组装并断言编排器包装文字不存在，对员工调用者拒绝 `subagent_fork`，并且只对 `employee:` child 应用 continuable setup。`config.spec.ts` 覆盖 `isDelegatedSession`。

## 考虑过的替代方案

**只把 `delegate_employee` 注册到根 agent 自己的 scope。** 之所以否决：BotForge 在 host 加载时挂载，此时还没有任何会话，而且没有「每个根 agent 运行一次」的 host 钩子，除非去重复 preset 组合。

**在员工启动时传入 `maxDepth: 0`。** 之所以否决：该上限作用于正在启动的这个 child：深度为 1 的员工会启动失败，而不是被禁止再启动孙 child。

**只在启动 `toolFilter` 上拒绝父级可见名称。** 之所以不能单独作为锁：`tools.restrict()` 会拒绝未知名称，而 `subagent_fork` 这类 preset 派生工具不在 host 全局视图上。child 必须在 `composeFrom` 之后再锁定。

**用完整的 `systemPrompt.section({ complete: true })` 替换已存员工提示词。** 之所以否决：complete 分段会丢掉 harness 身份、工具指导和 child 已分配的 skills，而不只是编排器包装。

**改写仍提到编排器的已存员工提示词。** 之所以否决：那段文案的来源是用户所有的设置；运行时只框住它，并在文档中说明要在设置中编辑。

## 后果

员工 child 看到的是自己的 specialist 人设、已存提示词以及自己的 skills／MCP，而不是编排器名册或委派工具。同一父级下的普通 `subagent` child 也会省略编排器分段，但会保留派生工具。`delegate_employee` 仍是全局注册；员工 child 无法执行它。可继续员工第一轮的 MCP 仍可能与第一次模型请求竞态；人设、启动 `toolFilter` 和 continuable-setup 锁定不会，因为它们在未发布的创建窗口里运行。已经驻留的 Activation 会保留创建时的工具集，直到重新物化。
