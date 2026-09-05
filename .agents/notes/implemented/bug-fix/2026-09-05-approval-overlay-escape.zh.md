# Agent Note: 审批 Escape 加入浮层栈

Status: implemented

[English](2026-09-05-approval-overlay-escape.md) | 中文

## 问题

作曲器审批接管有拒绝和允许，但 Escape 什么都不做。键盘用户读完长命令后无法像对话框取消那样结束等待。理由/命令区已经是 `tabIndex={0}` group 以便滚到末尾，轮廓仍是浏览器默认或没有。

## 决策

Escape 拒绝等待——拒绝按钮的 `rejected` 结果，绝不是允许——并走浮层栈。发送进行中栈退订；回执被拒则重新武装。滚动正文使用 `--dsw-shadow-focus-ring`。InputBar 灯箱单测在 `document` 上发 Escape，与栈监听一致。

## 考虑过的方案

**Escape 映射为允许。** 否决：那会用到处表示取消的键跑特权命令。

**两步 Escape（先失焦正文，再拒绝）。** 否决：面板没有需要保护的键入草稿，不像提问的自定义答案。计划审阅已经用一次 Escape 取消。

**审批 Escape 不进栈。** 否决：盖在上面的设置浮层仍须赢第一次。

## 后果

键盘用户拒绝审批的方式和关掉对话框一样。误按 Escape 会拦住工具而不是执行。后挂浮层仍先拿走 Escape。

## 测试

`packages/client/ui-conversation/tests/approval-panel.client.spec.tsx` 钉死命令提取、拒绝/允许、Escape 即拒绝、后挂让路、决策后 Escape 不再拒绝、以及丢失回执后重新武装。`packages/client/ui-conversation/tests/approval-panel-styles.client.spec.ts` 钉死正文环。`packages/client/ui-conversation/tests/input-bar.client.spec.tsx` 在 `document` 上发灯箱 Escape。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO。[提问与计划审阅 Escape](2026-09-05-question-plan-overlay-escape.md) 拥有提问的两步路径。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有环 token。
