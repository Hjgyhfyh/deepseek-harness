# Agent Note: Agent-preset 已揭示路径 Escape 与行内操作焦点颜色

Status: implemented

[English](2026-09-05-agent-preset-path-escape.md) | 中文

## 问题

宿主没有桌面打开器时，位置操作把目录印在卡片上。Escape 什么都不做，下一次按键会关掉设置，路径仍留在屏幕上。行内操作在 `:focus-visible` 上用了产品环，但仍是空闲的三级色和透明底，所以键盘焦点和悬停不一致。删除操作只在指针悬停时涂成危险色。

## 决策

正在显示路径的卡片上的 Escape（`preventDefault`）隐藏路径并把焦点还到位置操作。未显示路径的卡片忽略该键，设置层仍能拿走。键盘焦点把操作涂成与悬停相同的主色和底，把删除操作涂成相同的危险色。环仍在 `:focus-visible` 上。

## 考虑过的方案

**把已揭示路径放进浮层 Escape 栈。** 否决：这是设置卡片上的文档流行，不是一层。文档订阅会在任何路径碰巧显示时从设置抢走 Escape。

**焦点上操作仍用三级色，只靠环。** 否决：悬停已经把图标升到主色（或危险色）。键盘焦点还停在空闲色，看起来像指针没点中控件。

**等到名单重新加载再拿掉路径。** 否决：用户要看目录，也需要键盘方式把它收起，而不关掉设置。

## 后果

键盘用户可以用 Escape 隐藏已揭示目录并留在位置操作上；第二次 Escape 仍关闭设置。Tab 到行内操作看起来像悬停，包括删除。

## 测试

`packages/client/ui-agent-preset/tests/section.client.spec.tsx` 钉死 Escape 隐藏并恢复焦点，以及空闲行忽略。`packages/client/ui-agent-preset/tests/section-store.client.spec.ts` 钉死隐藏，以及路径已不在时的空操作。`packages/client/ui-agent-preset/tests/section-styles.client.spec.ts` 钉死悬停/焦点配色。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出 AgentPreset 操作环。
