# Agent Note: 模型行容量折叠 Escape 收起与 chevron 焦点颜色

Status: implemented

[English](2026-09-05-model-advanced-escape.md) | 中文

## 问题

每个 Models 目录行把输出上限（Capacities）收在 chevron 后面。点击/Enter 能打开字段，但 Escape 什么都不做——键盘打开折叠或 Tab 进最大输出 token 后，只能再点 chevron 才能收起。下一次 Escape 就会关掉「自定义设置」（或设置本身）。chevron 在 `:focus-visible` 上用了产品环，但仍是空闲的三级色，所以键盘焦点和悬停不一致。

## 决策

已打开容量折叠上的 Escape（`preventDefault`、`stopPropagation`）收起折叠并把焦点送回 chevron，包括输出上限字段持焦时。已收起的折叠忽略该键，「自定义设置」`<details>` 和设置层仍能拿走。必须 `stopPropagation`，因为该行住在「自定义设置」里面；只 `preventDefault` 仍会跑到祖先 details 的处理器，一次按键会收起两层。草稿留在 React state 里，和点击收起时一样。键盘焦点把 chevron 涂成与指针悬停相同的主标签色和悬停底；删除字形保持危险色。

## 考虑过的方案

**把每一行放进浮层 Escape 栈。** 否决：这是设置里的文档流展开，不是一层。文档订阅会在任何一行碰巧展开时从设置（以及「自定义设置」）抢走 Escape。

**焦点上 chevron 仍用三级色，只靠环。** 否决：悬停已经把字形升到主色。键盘焦点还停在空闲色，看起来像指针没点中控件。

**收起时不 `stopPropagation`。** 否决：「自定义设置」的处理器是祖先 `onKeyDown`。一次 Escape 会同时关掉 Capacities 和「自定义设置」。

## 后果

键盘用户可以从 chevron 或输出上限字段用 Escape 关掉 Capacities 并留在 chevron 上；第二次 Escape 仍收起「自定义设置」，第三次仍关闭设置。Tab 到 chevron 看起来像悬停。

## 测试

`packages/client/ui-settings-models/tests/provider-form.client.spec.tsx` 钉死收起时忽略（冒泡到「自定义设置」）、从输出上限字段收起且不关闭父 details、以及 chevron 焦点恢复。`packages/client/ui-settings-models/tests/components.client.spec.tsx` 以同样方式钉死 DeepSeek 目录编辑器。`packages/client/ui-settings-models/tests/styles.client.spec.ts` 钉死悬停/焦点配色。

## 相关

[Models 自定义设置 Escape](2026-09-05-models-customized-escape.md) 是父折叠。[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出模型图标按钮环。
