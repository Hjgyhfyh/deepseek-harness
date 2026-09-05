# Agent Note: Escape 清空插件清单搜索

Status: implemented

[English](2026-09-05-plugin-inventory-search-escape.md) | 中文

## 问题

设置里的插件清单是受控的 `type="search"` 字段。Escape 不改 React 状态，Chrome 自带的搜索清除可能把 DOM 值清空却不丢掉过滤。空字段还留着焦点。加载失败的 Retry 没有产品焦点环。

## 决策

查询非空时 Escape 会 `preventDefault` 并写入 `''`。查询为空时 Escape 让字段失焦。`.failure button:focus-visible` 使用 `--dsw-shadow-focus-ring`。

## 考虑过的方案

**依赖浏览器自带的搜索清除。** 否决：原生 Escape/`type="search"` 不能可靠更新受控 React 值。轨迹工具栏已经做过这个判断。

**空字段上 Escape 关闭设置。** 否决：清单页签不是浮层主人；SettingsRoot 已经从文档 Escape 关对话框。

## 后果

一次 Escape 恢复完整目录。第二次 Escape 离开字段。加载失败时键盘 Retry 与其余设置铬一致。

## 测试

`packages/client/ui-settings-plugin-inventory/tests/components.client.spec.tsx` 钉死先清空再失焦，以及 Enter 不清空。

## 相关

[Escape 清空轨迹工具栏搜索](2026-09-05-trajectory-search-escape.md) 拥有账本搜索上同一套模式。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有环 token。
