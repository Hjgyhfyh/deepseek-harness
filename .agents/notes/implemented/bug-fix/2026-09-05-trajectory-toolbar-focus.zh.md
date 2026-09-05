# Agent Note: 轨迹工具栏空搜索 Escape 与控件焦点颜色

Status: implemented

[English](2026-09-05-trajectory-toolbar-focus.md) | 中文

## 问题

账本搜索清空查询时会 `preventDefault`，第二次 Escape 只让字段失焦。文档浮层监听会拿走空字段上的这次按键。Duration、Turns 和 Calls 在 `:focus-visible` 上用了产品环，但仍是空闲的三级色和透明底，所以键盘焦点和悬停不一致。折叠字形在标签升到主色时仍停在三级色。

## 决策

搜索 Escape 始终 `preventDefault`。查询非空时仍写入 `''` 并留住焦点；空字段失焦。键盘焦点把 Duration、Turns 和 Calls 涂成与指针悬停相同的主色和悬停底。折叠字形在悬停和焦点下继承该标签色。环仍在 `:focus-visible` 上。

## 考虑过的方案

**空字段上不拦截 Escape，让时间线轨道能清区间。** 否决：搜索字段不是轨道的祖先；冒泡不是区间 Escape 的路径。文档浮层会在离开搜索的同一击里关掉。

**焦点上控件仍用三级色，只靠环。** 否决：悬停已经把标签升到主色并加上交互底。键盘焦点还停在空闲色，看起来像指针没点中控件。

**折叠字形与标签分开上色。** 否决：⊞/⊟ 和 Turns/Calls 在同一芯片里。灰色字形配主色标签看起来像控件的一半被禁用。

## 后果

一次 Escape 恢复完整账本。第二次 Escape 离开字段且不关浮层。Tab 到 Duration、Turns 或 Calls 看起来像悬停，包括折叠字形。

## 测试

`packages/client/ui-trajectory/tests/layout.client.spec.tsx` 钉死先清空再失焦，以及两次 Escape 都 `preventDefault`。`packages/client/ui-trajectory/tests/toolbar-styles.client.spec.ts` 钉死悬停/焦点配色、字形继承和已有的环。

## 相关

[Escape 清空轨迹工具栏搜索](2026-09-05-trajectory-search-escape.md) 引入了先清空再失焦。[插件清单空搜索 Escape](2026-09-05-plugin-inventory-search-blur-escape.md) 是设置里的兄弟。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出工具栏环。
