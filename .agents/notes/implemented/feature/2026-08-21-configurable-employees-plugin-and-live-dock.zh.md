# Agent Note: 可配置员工插件与实时侧栏

Status: implemented

[English](2026-08-21-configurable-employees-plugin-and-live-dock.md) | 中文

## 问题

BotForge 界面把用户需要分开处理的三件事混在一起：总开关、每位员工自己的系统提示词／skills／MCP，以及主 agent 刚刚委派出去的员工的实时视图。已发布的 Web 入口是侧栏底部的 `🤖 BotForge` 按钮，点开后是一层假聊天，因此配置和委派都不是一等产品控件。

## 决策

**由 host 设置持有名册和开关。** `dsh-botforge` 把 `botforge-workers` 和 `botforge-orchestrator` 注册为 live 设置 namespace。`enabled`（默认 true）会同时去掉 `botforge:workers` 提示词分段并注销 `delegate_employee`。每位员工保存自己的系统提示词、skill 名称和 MCP 服务器。

**委派是 host 工具，而不是第二层假聊天。** `delegate_employee(employee_id, description, prompt, run_in_background?)` 启动进程内 `spawn` child，将其 label 设为 `employee:<id>: <description>`；在 provider 允许时写入 persona；启动前从 `ctx.skills` 加载 skill 正文；并在发布后把该员工的 MCP 服务器挂到 child 上。默认在后台运行，以便父级继续工作。

**Web 侧栏是 `shell.overlay` 面板，而不是 footer action。** `dsh-client-ui-botforge` 注册「设置 → 员工」和右侧侧栏，overlay 根节点就是该面板本身（空白处保持 `pointer-events: none`）。侧栏列出当前会话或其父会话中 label 能匹配到员工的 catalog child，并用 `sessions.openSubagent` 打开。关闭插件时设置页仍然保留。

## 曾考虑的替代方案

**保留侧栏底部的 BotForge 按钮并重新设计样式。** 不采用：第二层聊天浮层会重复 Conversation、隐藏真正的 child transcript，而且仍然没有设置页来配置每位员工。

**复用 `subagent` 而不做专用工具。** 不采用：普通 child 没有名册 id、没有按员工区分的 persona／skills／MCP，也没有侧栏能稳定匹配的 label。

**把编排器 MCP 挂到 host context。** 不采用：根 context 上的工具会出现在进程内每个 agent 上。这些行只出现在提示词中。

**用 `registerContinuableSetup` 安装员工 extras。** 不采用：该贡献会对每个可继续 child 同步运行，而员工 MCP 启动是异步的，并且只针对特定员工。

## 后果

用户可以在设置中开关员工插件、独立编辑每一行，并且一旦 catalog 带有 `employee:`（或模糊匹配）label，就能在右侧看到被委派的员工。侧栏不再显示 BotForge footer 控件。可继续 child 第一轮的 MCP 仍可能与第一次模型请求竞态；skill 正文不会，因为它们在启动前加载。
