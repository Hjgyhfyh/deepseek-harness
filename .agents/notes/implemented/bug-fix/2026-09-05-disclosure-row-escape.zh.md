# Agent Note: DisclosureRow 的 Escape 收起文档流内的行

Status: implemented

[English](2026-09-05-disclosure-row-escape.md) | 中文

## 问题

Think、上下文注入、工具、命令和 workflow 行共用 `DisclosureRow`。Enter/Space 能切换整行展开，但 Escape 什么都不做——键盘打开正文后没有收起手势。悬停 chevron 只服务指针，聚焦的标题仍显示静止图标。

## 决策

展开根上的 Escape 收起已打开且可展开的行（`preventDefault`），并把焦点送回标题（整行目标，或作为控件的 leading 按钮）。已收起的行和强制打开的 `expandable={false}` 行忽略 Escape，后挂浮层仍能拿走该键。悬停 chevron 也在行和 leading 按钮的 `:focus-visible` 上显示。

## 考虑过的方案

**把 DisclosureRow 放进浮层 Escape 栈。** 否决：这些是文档流里的 transcript 行，不是一层。文档订阅会在 Think 行碰巧展开时从对话框抢走 Escape。

**关闭时 Escape 也调用 `onToggle`。** 否决：那会用到处表示放弃的键去展开一行。

## 后果

键盘用户可以用 Escape 关掉 Think、上下文、工具、命令和 workflow 展开，并留在摘要上。类似 Inspect 的嵌套按钮冒泡同一套收起。设置浮层仍赢第一次 Escape，因为该行只在自身持焦时处理该键。

## 测试

`packages/client/ui-primitives/tests/disclosure-row.client.spec.tsx` 钉死 Enter/Space、收起时忽略、展开时收起、嵌套控件焦点恢复、leading 按钮收起、以及强制打开时 Escape 惰性。`packages/client/ui-primitives/tests/disclosure-row-styles.client.spec.ts` 钉死焦点 chevron 和已有的标题环。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[Skill 行 Escape](2026-09-05-skill-row-escape.md) 是该铬的专用 skill toolview 分叉。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有环 token。
