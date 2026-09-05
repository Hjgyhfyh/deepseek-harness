# Agent Note: Composer dock Escape 收起与 chevron 焦点颜色

Status: implemented

[English](2026-09-05-composer-dock-escape.md) | 中文

## 问题

Composer 上方的 Todo 计划条和多行 Queue dock 是文档流展开。点击/Enter 能打开列表，但 Escape 什么都不做——键盘展开计划或 Tab 进行列操作后，只能再点表头才能收起。空闲时按 Queue 行上的 Escape 也无法回到计数表头。两个 chevron 在 `:focus-visible` 上用了产品环，但仍是空闲的三级色，所以键盘焦点和悬停不一致。

## 决策

已打开 dock 上的 Escape（`preventDefault`）收起它并把焦点送回表头，包括从 Queue 行内操作。已收起的 dock 忽略该键，浮层（设置、菜单）仍能拿走。Queue 的行内编辑器已经对 Escape `preventDefault` 以取消编辑；dock 处理器跳过 `event.defaultPrevented`，因此该手势仍只取消编辑。单行队列没有计数表头，因此不收起。键盘焦点把每个 chevron 涂成与悬停相同的主标签色。

## 考虑过的方案

**把每个 dock 放进浮层 Escape 栈。** 否决：这是 composer 里的文档流条，不是一层。文档订阅会在 dock 碰巧展开时从设置或菜单抢走 Escape。

**焦点上 chevron 仍用三级色，只靠环。** 否决：悬停已经把字形升到主色。键盘焦点还停在空闲色，看起来像指针没点中控件。

**正在编辑时也收起 Queue。** 否决：编辑器里的 Escape 已经表示取消草稿。同一按键再收起，会藏起用户刚回到的那一行。

## 后果

键盘用户可以用 Escape 关掉打开的 Todo 或 Queue dock 并留在表头上；第二次 Escape 仍关闭浮层。取消队列编辑后列表仍开着。Tab 到 dock 表头看起来像悬停。

## 测试

`packages/client/ui-conversation/tests/todo-panel.client.spec.tsx` 钉死收起时忽略、打开计划收起、以及表头焦点恢复。`packages/client/ui-conversation/tests/queue-dock.client.spec.tsx` 以同样方式钉死计数表头、从行内操作收起、以及编辑器 Escape 仍只取消。`packages/client/ui-conversation/tests/composer-dock-styles.client.spec.ts` 钉死悬停/焦点 chevron 配色。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[重试 Escape](2026-09-05-retry-escape-and-continue-ring.md) 是 transcript `<details>` 的兄弟。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出 TodoPanel 和 QueueDock 表头环。
