# Agent Note: 插件配置卡片 Escape 收起与卡片焦点环

Status: implemented

[English](2026-09-05-plugin-card-escape.md) | 中文

## 问题

可配置插件卡片是带嵌套字段的就地展开。点击/Enter 能打开表单，但 Escape 什么都不做——键盘打开卡片或 Tab 进字段后，只能再点标题才能收起，下一次 Escape 会关掉设置。产品环画在内层标题按钮上，因此正在编辑的打开卡片（焦点在字段里）周围没有环。chevron 在键盘焦点下仍是第三级色。

## 决策

已打开卡片上的 Escape（`preventDefault`）收起卡片并把焦点送回标题，包括嵌套字段持焦时。已收起的卡片忽略该键，设置浮层仍能拿走。暂存编辑在收起后仍在，和点击收起时一样。产品环画在 `.card:focus-within` 上而不是标题上，chevron 在标题 `:focus-visible` 下变深。

## 考虑过的方案

**把每张卡片放进浮层 Escape 栈。** 否决：这些是设置里的目录展开，不是一层。文档订阅会在某张卡片碰巧展开时从设置抢走 Escape，或和设置框抢第一次按键。

**把环留在标题上。** 否决：用户 Tab 进超时字段后标题不再持焦，正在编辑的瓷砖就没有环。卡片上的 `focus-within` 跟着工作走。

## 后果

键盘用户可以从标题或嵌套字段用 Escape 关掉插件卡片并留在标题上；第二次 Escape 仍关闭设置。Tab 进打开的卡片时产品环围住整张瓷砖。Discard/Save 保留自己的环。

## 测试

`packages/client/ui-settings-plugins/tests/section.client.spec.tsx` 钉死收起时忽略、从嵌套字段收起、以及标题焦点恢复。`packages/client/ui-settings-plugins/tests/plugin-card-styles.client.spec.ts` 钉死卡片环和标题 chevron。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[插件清单卡片 Escape](2026-09-05-plugin-inventory-card-escape.md) 是只读目录的兄弟。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出插件卡片环。
