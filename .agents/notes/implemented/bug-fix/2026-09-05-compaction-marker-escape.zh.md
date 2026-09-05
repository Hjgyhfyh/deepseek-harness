# Agent Note: 压缩标记 Escape 收起与焦点悬停底

Status: implemented

[English](2026-09-05-compaction-marker-escape.md) | 中文

## 问题

压缩检查点标记只能点击展开摘要。Escape 什么都不做，所以下一记按键可能关掉对话框或 Settings，而摘要仍开着。键盘焦点用了产品环但仍是透明底，所以和悬停不一致。

## 决策

已打开标记上的 Escape（`preventDefault`）收起摘要并把焦点送回按钮。已收起的标记忽略该键。嵌套控件已经处理过的键（`defaultPrevented`）不收起摘要。键盘焦点把标记涂成与指针悬停相同的底。环仍在 `:focus-visible` 上。

## 考虑过的方案

**把打开的摘要放进浮层 Escape 栈。** 否决：它是 transcript 里的流内披露，不是一层。文档订阅者会在压缩碰巧展开时从 Settings 或对话框抢走 Escape。

**让焦点保持透明底，只靠环。** 否决：悬停已经铺上底，悬停/焦点已经切换披露字形。键盘焦点保持透明底看起来像指针没点到控件。

**只从按钮收起，不从整行。** 否决：摘要正文可以有 markdown 链接。从那些链接来的 Escape 必须打到同一个处理器。

## 后果

键盘用户用 Escape 关闭压缩摘要并留在标记上；第二次 Escape 仍归栈顶浮层。Tab 到标记看起来像悬停。

## 测试

`packages/client/ui-conversation/tests/compaction-item.client.spec.tsx` 钉死 Escape 收起并恢复焦点、已收起忽略，以及 `defaultPrevented` 的 Escape 让摘要保持打开。`packages/client/ui-conversation/tests/message-item-styles.client.spec.ts` 钉死悬停/焦点底配对和已有的环。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出压缩标记环。
