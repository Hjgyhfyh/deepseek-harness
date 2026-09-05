# Agent Note: 插件配置嵌套 Escape 跳过与 chevron/Discard 焦点颜色

Status: implemented

[English](2026-09-05-plugin-card-nested-escape.md) | 中文

## 问题

可配置插件卡片在打开时会收起任何冒泡而来的 Escape。嵌套控件已经处理过该键（`preventDefault`）时卡片仍会关上，表单里的 select、搜索或浮层无法自己关掉。标题 chevron 在键盘焦点下变深，悬停时仍是三级色。Discard 在 `:focus-visible` 上用了产品环，但仍是空闲的次级色，所以键盘焦点和悬停不一致。

## 决策

卡片处理函数跳过 `event.defaultPrevented`，然后照旧 `preventDefault` 并收起。悬停把 chevron 涂成与标题 `:focus-visible` 相同的次级色。Discard 的键盘焦点把标签涂成主色并带上悬停边框。环仍在 Discard/Save 的 `:focus-visible` 上。

## 考虑过的方案

**即使嵌套已经 preventDefault 也照样收起。** 否决：那会从已经用过该键的控件手里抢走。timeout 和其他空闲字段仍会冒泡，所以从那些字段按 Escape 仍关闭卡片。

**悬停时 chevron 仍用三级色，焦点上 Discard 仍用空闲色。** 否决：键盘焦点已经把字形升色，悬停已经把 Discard 升色。不匹配看起来像指针没点中控件。

## 后果

嵌套控件可以把 Escape 花在自己身上而不收起卡片。字段上未处理的 Escape 仍关闭卡片并把焦点还到标题。Tab 或悬停到标题时 chevron 同样变深。Tab 到 Discard 看起来像悬停。

## 测试

`packages/client/ui-settings-plugins/tests/section.client.spec.tsx` 钉死嵌套字段收起，以及 `defaultPrevented` 的 Escape 不收起卡片。`packages/client/ui-settings-plugins/tests/plugin-card-styles.client.spec.ts` 钉死悬停/焦点 chevron 和 Discard 配色。

## 相关

[插件配置 Escape](2026-09-05-plugin-card-escape.md) 拥有打开卡片的收起。[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出插件卡片环。
