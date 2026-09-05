# Agent Note: JsonBlock Escape 收起与焦点悬停底

Status: implemented

[English](2026-09-05-json-block-escape.md) | 中文

## 问题

`JsonBlock` 只能点击展开未知或剩余载荷。Escape 什么都不做，所以下一记按键可能关掉对话框或 Settings，而 JSON 仍开着。键盘焦点用了产品环但仍是透明底，所以和悬停不一致。

## 决策

已打开块上的 Escape（`preventDefault`）收起正文并把焦点送回开关。已收起的块忽略该键。嵌套控件已经处理过的键（`defaultPrevented`）不收起正文。键盘焦点把开关涂成与指针悬停相同的底。环仍在 `:focus-visible` 上。开关报告 `aria-expanded`。

## 考虑过的方案

**把打开的块放进浮层 Escape 栈。** 否决：它是 transcript 里的流内额外折叠，不是一层。文档订阅者会在剩余载荷碰巧展开时从 Settings 或对话框抢走 Escape。

**让焦点保持透明底，只靠环。** 否决：悬停已经铺上底。键盘焦点保持透明底看起来像指针没点到控件。

**用同样方式收起 JsonTree。** 否决：树已经用 ArrowLeft 关闭节点。那里的 Escape 会和这套词汇打架。

## 后果

键盘用户用 Escape 关闭剩余 JSON 并留在开关上；第二次 Escape 仍归栈顶浮层。Tab 到开关看起来像悬停。

## 测试

`packages/client/ui-primitives/tests/markdown.client.spec.tsx` 钉死 Escape 收起并恢复焦点、已收起忽略，以及 `defaultPrevented` 的 Escape 让正文保持打开。`packages/client/ui-primitives/tests/json-block-styles.client.spec.ts` 钉死悬停/焦点底配对和已有的环。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出 JsonBlock 开关环。
