# Agent Note: Models 自定义设置嵌套 Escape 跳过与危险操作焦点底

Status: implemented

[English](2026-09-05-models-customized-nested-escape.md) | 中文

## 问题

「自定义设置」折叠在打开时会收起任何冒泡而来的 Escape。嵌套控件已经处理过该键（`preventDefault`）时折叠仍会关上，所以额外字段里的 select、搜索或浮层留不住自己的关闭。行上的 Remove 和确认删除在 `:focus-visible` 上用了产品环，但仍是透明底，所以键盘焦点和危险悬停不一致。

## 决策

折叠处理器跳过 `event.defaultPrevented`，然后照旧 `preventDefault` 并收起。键盘焦点把 Remove 和确认删除涂成与悬停相同的危险底。环仍在 `:focus-visible` 上。容量折叠仍 `stopPropagation`，因此它们收起后折叠还能拿走下一次。

## 考虑过的方案

**即使嵌套已经 preventDefault 也照样收起。** 否决：那会从已经用过该键的控件手里抢走键。空闲字段仍会冒泡，所以从那些字段来的 Escape 仍会关上折叠。

**让 Remove 和确认删除在焦点上保持透明，只靠环。** 否决：悬停已经铺上危险底。键盘焦点保持透明底看起来像指针没点到控件。

**把折叠放进浮层 Escape 栈。** 否决：它是设置卡片上的流内披露，不是一层。文档订阅者会在折叠碰巧打开时从 Settings 抢走 Escape。

## 后果

嵌套控件可以把 Escape 花在自己身上而不收起「自定义设置」。字段上未处理的 Escape 仍会关上折叠并把焦点送回摘要。Tab 到 Remove 或确认删除看起来像悬停。

## 测试

`packages/client/ui-settings-models/tests/provider-form.client.spec.tsx` 钉死嵌套字段收起，以及 `defaultPrevented` 的 Escape 让折叠保持打开。`packages/client/ui-settings-models/tests/styles.client.spec.ts` 钉死悬停/焦点危险底配对。

## 相关

[插件配置嵌套 Escape](2026-09-05-plugin-card-nested-escape.md) 拥有插件卡片上同一套跳过。[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出模型字段环。
