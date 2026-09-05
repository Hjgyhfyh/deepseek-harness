# Agent Note: 停靠栏取消编辑后焦点回到按钮

Status: implemented

[English](2026-09-05-dock-edit-focus-restore.md) | 中文

## 问题

取消 GoalBar 或队列行的行内编辑会卸掉输入框，键盘焦点落到 `document.body`。计划条标题没有指向列表的 `aria-controls`。若干紧挨作曲器的控件仍用浏览器默认焦点轮廓。

## 决策

Escape、取消和成功保存把焦点送回编辑控件。TodoPanel 保留（可能 `hidden` 的）列表并用 `aria-controls` 指向它。ContextMeter、TodoPanel、消息复制/分支、压缩、详情关闭、EnterBehavior 和 SubagentCatalog 触发器使用 `--dsw-shadow-focus-ring`。

## 考虑过的方案

**取消后让焦点留在 body。** 否决：JobList 的 Escape 已经回到触发器；停靠栏编辑器应该一致。

**折叠时卸掉 todo 列表。** 否决：`aria-controls` 需要稳定目标。QueueDock 本来就留着隐藏列表。

## 后果

取消后 Tab 顺序还在。读屏可以把计划标题和行关联起来。作曲器附近的键盘铬与其余产品环一致。

## 测试

`packages/client/ui-goal/tests/goalbar.client.spec.tsx` 和 `packages/client/ui-conversation/tests/queue-dock.client.spec.tsx` 钉死焦点还原。`packages/client/ui-conversation/tests/todo-panel.client.spec.tsx` 钉死 `aria-controls`。

## 相关

[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有环 token。
