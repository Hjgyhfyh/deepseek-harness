# Agent Note: 反馈备注 Escape 后焦点回到按钮

Status: implemented

[English](2026-09-05-feedback-note-escape.md) | 中文

## 问题

每条消息的反馈备注没有 Escape。取消会卸掉字段，键盘焦点落到 `document.body`。ContextMeter 的 Escape 关面板但不 `preventDefault`，上层浮层也可能一起关。设置里的选择器药丸、会话面包屑/页签、回到底部、附件轨铬和 markdown 复制按钮仍用浏览器默认轮廓。

## 决策

Escape（以及取消/保存）关闭备注并把焦点送回打开按钮。打开时 textarea 自动聚焦。ContextMeter 的 Escape 会 `preventDefault`。剩下的铬使用 `--dsw-shadow-focus-ring`。

## 考虑过的方案

**把 Escape 留给浏览器。** 否决：textarea 不会自己关上，而且 GoalBar/QueueDock 取消后已经回到按钮。

**让 ContextMeter 的 Escape 继续冒泡。** 否决：SettingsRoot 也在 `document` 上听；两个会一起关。

## 后果

键盘用户可以丢掉反馈备注而不丢行。打开上下文环再按 Escape 不再和设置浮层抢。设置和正文铬与产品环一致。

## 测试

`packages/client/ui-message-feedback/tests/message-feedback-actions.client.spec.tsx` 钉死 Escape/取消/保存的焦点还原，以及 Enter 留在编辑器里。`packages/client/ui-conversation/tests/context-meter.client.spec.tsx` 仍然钉死 Escape 关闭。

## 相关

[停靠栏取消编辑后焦点回到按钮](2026-09-05-dock-edit-focus-restore.md) 在作曲器停靠栏上拥有同一套还原。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有环 token。
