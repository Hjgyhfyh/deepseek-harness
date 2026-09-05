# Agent Note: Models 自定义设置 Escape 收起与焦点颜色

Status: implemented

[English](2026-09-05-models-customized-escape.md) | 中文

## 问题

Models 编辑器的「自定义设置」是原生 `<details>` 展开。点击/Enter 能打开 API 地址、目录和身份字段，但 Escape 什么都不做——键盘打开折叠或 Tab 进嵌套字段后，只能再点摘要才能收起，下一次 Escape 会关掉设置。摘要在 `:focus-visible` 上用了产品环，但仍是空闲的次级色，所以键盘焦点和悬停不一致。

## 决策

已打开折叠上的 Escape（`preventDefault`）收起折叠并把焦点送回摘要，包括嵌套字段持焦时。已收起的折叠忽略该键，设置浮层仍能拿走。草稿留在 React state 里，和点击收起时一样。键盘焦点把摘要（以及通过 `currentcolor` 的 chevron）涂成与悬停相同的主标签色。

## 考虑过的方案

**把折叠放进浮层 Escape 栈。** 否决：这是设置里的文档流展开，不是一层。文档订阅会在折叠碰巧展开时从设置抢走 Escape。

**焦点上摘要仍用次级色，只靠环。** 否决：悬停已经把标签升到主色。键盘焦点还停在空闲色，看起来像指针没点中控件。

## 后果

键盘用户可以从摘要或嵌套字段用 Escape 关掉「自定义设置」并留在摘要上；第二次 Escape 仍关闭设置。Tab 到摘要看起来像悬停。模型行的高级折叠不变。

## 测试

`packages/client/ui-settings-models/tests/provider-form.client.spec.tsx` 钉死收起时忽略、从嵌套字段收起、以及摘要焦点恢复。`packages/client/ui-settings-models/tests/styles.client.spec.ts` 钉死悬停/焦点配色。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[重试 Escape](2026-09-05-retry-escape-and-continue-ring.md) 是 transcript `<details>` 的兄弟。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出摘要环。
