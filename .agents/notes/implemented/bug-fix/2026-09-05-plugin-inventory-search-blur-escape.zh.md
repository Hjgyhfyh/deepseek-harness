# Agent Note: 插件清单空搜索 Escape 与 chevron 悬停颜色

Status: implemented

[English](2026-09-05-plugin-inventory-search-blur-escape.md) | 中文

## 问题

插件列表目录搜索清空查询时会 `preventDefault`，第二次 Escape 只让字段失焦。浮层栈是 document 冒泡监听，所以空字段上的这次按键还会关掉设置。卡片 chevron 在键盘焦点下变深，悬停时仍是三级色，指针和键盘不一致。

## 决策

搜索 Escape 始终 `preventDefault`。查询非空时仍写入 `''` 并留住焦点；空字段失焦。字段离开后设置才能拿走下一次。悬停把 chevron 涂成与 `:has(.cardContent:focus-visible)` 相同的次级色。

## 考虑过的方案

**空字段上不拦截 Escape，让 SettingsRoot 拥有该键。** 否决：那会在离开搜索的同一击里关掉设置。清单页签不是浮层主人；字段失焦之前不能把键让出去。

**悬停时 chevron 仍用三级色，只靠标题底。** 否决：键盘焦点已经把字形升色。悬停还停在空闲色，看起来像指针没点中控件。

## 后果

一次 Escape 恢复完整目录。第二次 Escape 离开字段且不关设置。第三次 Escape 仍关闭设置。Tab 或悬停到卡片时 chevron 同样变深。

## 测试

`packages/client/ui-settings-plugin-inventory/tests/components.client.spec.tsx` 钉死先清空再失焦，以及两次 Escape 都 `preventDefault`。`packages/client/ui-settings-plugin-inventory/tests/inventory-card-styles.client.spec.ts` 钉死悬停/焦点 chevron 配色。

## 相关

[Escape 清空插件清单搜索](2026-09-05-plugin-inventory-search-escape.md) 引入了先清空再失焦。[插件清单卡片 Escape](2026-09-05-plugin-inventory-card-escape.md) 拥有展开收起。[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。
