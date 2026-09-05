# Agent Note: ReadBlock 展开 Escape 收起与焦点悬停色

Status: implemented

[English](2026-09-05-read-expand-escape.md) | 中文

## 问题

封顶的 `ReadBlock` 只能点击揭开隐藏的中间段。Escape 什么都不做，所以下一记按键可能关掉对话框或 Settings，而完整窗口仍开着。键盘焦点用了产品环但仍是空闲的三级色，所以和悬停不一致。

## 决策

已展开上限上的 Escape（`preventDefault`）收起中间段并把焦点留在控件上。已收起的控件忽略该键。嵌套控件已经处理过的键（`defaultPrevented`）不收起上限。键盘焦点把展开控件涂成与悬停相同的次级色。环仍在 `:focus-visible` 上。

## 考虑过的方案

**把展开的上限放进浮层 Escape 栈。** 否决：它是卡片上的流内切片，不是一层。文档订阅者会在长 read 碰巧展开时从 Settings 或对话框抢走 Escape。

**让焦点保持三级空闲色，只靠环。** 否决：悬停已经把标签升到次级色。键盘焦点保持空闲色看起来像指针没点到控件。

**同一改动里收起 DiffBlock 和 SearchBlock。** 否决：每张卡片拥有自己的展开控件。这些兄弟可以跟上 TerminalBlock 已经验证过的模式。

## 后果

键盘用户用 Escape 关闭长文件窗口并留在上限控件上；第二次 Escape 仍归栈顶浮层。Tab 到展开控件看起来像悬停。

## 测试

`packages/client/ui-primitives/tests/read-block.client.spec.tsx` 钉死 Escape 收起、已收起忽略，以及 `defaultPrevented` 的 Escape 让上限保持展开。`packages/client/ui-primitives/tests/read-block-styles.client.spec.ts` 钉死悬停/焦点配色和已有的环。

## 相关

[TerminalBlock 展开 Escape](2026-09-05-terminal-expand-escape.md) 拥有命令输出上同一套模式。[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出 Read 展开环。
