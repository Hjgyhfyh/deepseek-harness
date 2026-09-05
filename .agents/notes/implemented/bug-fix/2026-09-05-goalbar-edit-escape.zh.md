# Agent Note: GoalBar 编辑 Escape 从保存/取消与图标焦点颜色

Status: implemented

[English](2026-09-05-goalbar-edit-escape.md) | 中文

## 问题

GoalBar 的行内编辑表单只在目标输入框上用 Escape 取消。Tab 到保存或取消后 Escape 什么都不做，下一次按键会打到 composer 或浮层，而不是离开表单。图标动作在 `:focus-visible` 上用了产品环，但仍是空闲的三级色和透明底，所以键盘焦点和悬停不一致。

## 决策

编辑条带处理 Escape（`preventDefault`）并走与输入框和取消按钮相同的离开编辑路径，把焦点还到编辑。空闲的暂停/编辑/清除忽略该键，浮层仍能拿走。键盘焦点把图标涂成与指针悬停相同的次级色和悬停底。环仍在 `:focus-visible` 上。

## 考虑过的方案

**把编辑表单放进浮层 Escape 栈。** 否决：这是 composer 堆栈里的文档流条带，不是一层。文档订阅会在任何 goal 碰巧处于编辑时从设置或菜单抢走 Escape。

**焦点上图标仍用三级色，只靠环。** 否决：悬停已经把图标升到次级色并加上交互底。键盘焦点还停在空闲色，看起来像指针没点中控件。

**只从输入框取消，让用户 Tab 回去。** 否决：保存和取消是输入框之后的下一个 tab 停点；那里的 Escape 应与输入框上的 Escape 同义。

## 后果

键盘用户可以从输入框、保存或取消用 Escape 离开进行中的 goal 编辑并落到编辑上。第二次 Escape 仍到达浮层。Tab 到图标看起来像悬停。

## 测试

`packages/client/ui-goal/tests/goalbar.client.spec.tsx` 钉死输入框 Escape、保存/取消 Escape，以及空闲动作忽略。`packages/client/ui-goal/tests/goalbar-styles.client.spec.ts` 钉死悬停/焦点配色和已有的环。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出 GoalBar 图标环。
