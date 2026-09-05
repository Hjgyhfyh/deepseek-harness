# Agent Note: Trajectory thinking Escape 收起与焦点颜色

Status: implemented

[English](2026-09-05-trajectory-thinking-escape.md) | 中文

## 问题

Trajectory 检查器里的助手 thinking 是 Thinking 控件后面的文档流展开。点击/Enter 能打开思维链，但 Escape 什么都不做——键盘展开后只能再点控件才能收起。下一次 Escape 就会离开检查器或打到浮层。控件在 `:focus-visible` 上用了产品环，但仍是空闲的三级色，所以键盘焦点和悬停不一致。

## 决策

已打开 thinking 折叠上的 Escape（`preventDefault`）收起折叠并把焦点送回 Thinking 控件。已收起的折叠忽略该键，记录表和浮层仍能拿走。键盘焦点把控件涂成与悬停相同的次级标签色。

## 考虑过的方案

**把折叠放进浮层 Escape 栈。** 否决：这是检查器里的文档流展开，不是一层。文档订阅会在 thinking 碰巧展开时从设置或菜单抢走 Escape。

**焦点上标签仍用三级色，只靠环。** 否决：悬停已经把标签升到次级色。键盘焦点还停在空闲色，看起来像指针没点中控件。

## 后果

键盘用户可以用 Escape 关掉 thinking 并留在 Thinking 控件上；第二次 Escape 仍到达记录表或浮层。Tab 到控件看起来像悬停。

## 测试

`packages/client/ui-trajectory/tests/table.client.spec.tsx` 钉死收起时忽略、打开折叠收起、以及控件焦点恢复。`packages/client/ui-trajectory/tests/thinking-styles.client.spec.ts` 钉死悬停/焦点配色。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[DisclosureRow Escape](2026-09-05-disclosure-row-escape.md) 是共享的紧凑表头收起。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出 Thinking 控件环。
