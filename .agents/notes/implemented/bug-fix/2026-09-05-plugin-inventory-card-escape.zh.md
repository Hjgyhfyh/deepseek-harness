# Agent Note: 插件清单卡片 Escape 收起与不被裁切的环

Status: implemented

[English](2026-09-05-plugin-inventory-card-escape.md) | 中文

## 问题

插件列表的目录卡片是就地展开。点击/Enter 能打开 Loader id 和状态正文，但 Escape 什么都不做——键盘打开后只能再点一次才能收起，下一次 Escape 会关掉设置。产品环画在内层标题按钮上，卡片的 `overflow: hidden` 会裁掉它。

## 决策

已打开卡片上的 Escape（`preventDefault`）收起卡片并把焦点送回标题。已收起的卡片忽略该键，设置浮层仍能拿走。焦点环通过 `:has(.cardContent:focus-visible)` 画在卡片上，展开时也一样，裁切藏不住。chevron 在同一键盘焦点下变深。

## 考虑过的方案

**把每张卡片放进浮层 Escape 栈。** 否决：这些是设置里的目录展开，不是一层。文档订阅会在某张卡片碰巧展开时从设置抢走 Escape，或和设置框抢第一次按键。

**把环留在内层按钮上并去掉 `overflow: hidden`。** 否决：裁切是为了让展开后的详情贴合卡片圆角。把环移到卡片上可以保留裁切。

## 后果

键盘用户可以用 Escape 关掉插件卡片并留在标题上；第二次 Escape 仍关闭设置。Tab 到卡片时产品环围住整张瓷砖。搜索框的 Escape（先清空再失焦）不变。

## 测试

`packages/client/ui-settings-plugin-inventory/tests/components.client.spec.tsx` 钉死收起时忽略、展开时收起、以及标题焦点恢复。`packages/client/ui-settings-plugin-inventory/tests/inventory-card-styles.client.spec.ts` 钉死卡片环，以及内层按钮不再画环。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[DisclosureRow Escape](2026-09-05-disclosure-row-escape.md) 是共用紧凑标题收起。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出清单卡片环。
