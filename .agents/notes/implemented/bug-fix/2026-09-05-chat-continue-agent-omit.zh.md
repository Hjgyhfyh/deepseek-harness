# Agent Note: 聊天节点省略 undefined 的 continueAgent

Status: implemented

[English](2026-09-05-chat-continue-agent-omit.md) | 中文

## 问题

`ChatNodeOwnerProps.continueAgent` 是可选的（`?: () => void`）。`ChatNodeSeat` 在值为 `undefined` 时仍把它拷进 owner，turn-error / max-tokens 视图写 `continueAgent={running ? undefined : continueAgent}`。在 `exactOptionalPropertyTypes` 下这不是完整 owner，下游客户端包（包括 ui-model-selection）的 `tsc -b` 失败。

## 决策

owner 用条件展开：没有续跑就省略字段，而不是写成 `undefined`。通知视图只在会话未运行且回调存在时展开它。

## 考虑过的方案

**把 `continueAgent` 放宽成 `(() => void) | undefined`。** 否决：slot 注释已经把省略定义为「视图不能续跑」；BotForge 员工行教过同一套省略/undefined 分界。

**继续赋值 `undefined`，跳过客户端 `tsc -b`。** 否决：插件包从这份 emit 编译，现场 `/plugins/*/client.js` 就重建不了。

## 后果

运行中的会话仍然隐藏通知上的 Continue。停住的会话仍然显示。客户端 project references 再次通过类型检查。

## 测试

`packages/client/ui-conversation/tests/chat-view.client.spec.tsx` 仍点击终端失败上的 Continue。`tsc -b packages/client/ui-model-selection/tsconfig.json` 为绿。

## 相关

[BotForge worker normalize](2026-09-05-botforge-normalize-worker-required-fields.md) 拥有存储行上同一条 exactOptionalPropertyTypes 的省略/undefined 规则。
