# Agent Note: Queue 编辑 Escape 从保存/取消与操作焦点颜色

Status: implemented

[English](2026-09-05-queue-edit-escape.md) | 中文

## 问题

Queue 的行内编辑器只在输入框上用 Escape 取消。Tab 到保存或取消后 Escape 什么都不做：dock 把任何进行中的编辑当成忽略，下一次按键会打到 composer 或浮层，而不是离开草稿。行内操作在 `:focus-visible` 上用了产品环，但仍是空闲的三级色和透明底，所以键盘焦点和悬停不一致。

## 决策

编辑打开时 dock 处理 Escape（`preventDefault`）并走与输入框和取消按钮相同的离开编辑路径，把焦点还到编辑，多行列表仍展开。进行中的变更仍忽略该键。键盘焦点把操作涂成与指针悬停相同的次级色和悬停底。环仍在 `:focus-visible` 上。

## 考虑过的方案

**把编辑器放进浮层 Escape 栈。** 否决：这是 composer 堆栈里的文档流条带，不是一层。文档订阅会在任何队列行碰巧处于编辑时从设置或菜单抢走 Escape。

**焦点上操作仍用三级色，只靠环。** 否决：悬停已经给控件铺了底。键盘焦点还停在空闲色，看起来像指针没点中控件。

**从保存或取消按 Escape 时收起列表。** 否决：编辑器里的 Escape 已经表示取消草稿。下一个 tab 停点上的同一键必须保持这个意思，否则用户刚回到的行会消失。

## 后果

键盘用户可以从输入框、保存或取消用 Escape 离开进行中的队列编辑并落到编辑上。第二次 Escape 仍收起已打开的多行列表。Tab 到行内操作看起来像悬停。

## 测试

`packages/client/ui-conversation/tests/queue-dock.client.spec.tsx` 钉死输入框 Escape、单行和多行队列上的保存/取消 Escape，以及列表仍开着。`packages/client/ui-conversation/tests/composer-dock-styles.client.spec.ts` 钉死悬停/焦点操作配色。

## 相关

[Composer dock Escape](2026-09-05-composer-dock-escape.md) 拥有列表收起。[GoalBar 编辑 Escape](2026-09-05-goalbar-edit-escape.md) 是兄弟条带。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出 QueueDock 操作环。
