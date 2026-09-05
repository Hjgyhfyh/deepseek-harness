# Agent Note: 无工作区作曲器卡片切换选择器

Status: implemented

[English](2026-09-05-workspace-card-picker-toggle.md) | 中文

## 问题

没有当前工作区时，虚线作曲器卡片是选工作区的目标。它拦住 `pointerdown`，以免 Menu 的外部关闭与再次打开抢跑，于是第二次点击也到不了 document。`onRequestWorkspace` 只把选择器设为打开，第二次点击或 Enter 会卡住。旁边的 hero 芯片已经在切换。悬停把虚线涂成业务蓝；键盘焦点和打开的选择器不会。

## 决策

ConversationRoot 从卡片切换 `pickerOpen`，与芯片一致。虚线在 `:hover`、`:focus-within` 和 `:has(textarea[aria-expanded='true'])` 上使用 `--dsw-alias-state-business-primary`。卡片仍拦住 `pointerdown`；Escape 仍经 Menu 走浮层栈。

## 考虑过的方案

**保持只打开，靠外部关闭。** 否决：卡片必须拦住 `pointerdown` 才能避免先关再开的闪烁，外部关闭看不到第二次点击。

**在 InputBar 里用 `workspacePickerOpen` 切换。** 否决：所有者已经为芯片和 slot 拥有 `pickerOpen`；栏内再做一个布尔会漂。

## 后果

在虚线卡片上第二次点击或 Enter 会关掉选择器。键盘焦点和打开的菜单与悬停显示同一条蓝虚线。芯片和卡片仍是同一个控件。

## 测试

`packages/client/ui-conversation/tests/skeleton.client.spec.tsx` 钉死卡片切换以及芯片再卡片关闭。`packages/client/ui-conversation/tests/input-bar-styles.client.spec.ts` 钉死三条虚线选择器。InputBar 仍把 `onRequestWorkspace` 当作只负责触发的回调来监视。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 Menu 的 Escape。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有卡片已有的 `:focus-within` 环。
