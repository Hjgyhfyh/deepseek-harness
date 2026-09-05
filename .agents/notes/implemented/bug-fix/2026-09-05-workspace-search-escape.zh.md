# Agent Note: 工作区搜索 Escape 先清空再收起

Status: implemented

[English](2026-09-05-workspace-search-escape.md) | 中文

## 问题

侧边栏会话搜索把 Escape 当成一次「清空并收起」。点到外面时非空查询本来会保持展开，以免过滤被误丢。Escape 不一致：输入过的查询消失，字段也关上。会话头 JobList 触发器没有产品焦点环。

## 决策

非空（经过 sanitize）查询上 Escape 写入 `''` 并保持展开。空查询上 Escape 收起。JobList 触发器使用 `--dsw-shadow-focus-ring`。

## 考虑过的方案

**保留一键 Escape 当更快的关闭。** 否决：它和已有的「查询比收起活得更久」约定，以及轨迹/清单搜索的模式打架。

**清除按钮也改成两步。** 否决：那个控件的标签就是清除并关闭；Escape 才是键盘路径。

## 后果

第一次 Escape 去掉实时会话过滤，但不把标题栏收回去。第二次 Escape 把搜索图标还回来。任务芯片上的键盘焦点与其余标题铬一致。

## 测试

`packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx` 钉死先清空再收起，以及 Enter 不关闭。

## 相关

[Escape 清空轨迹工具栏搜索](2026-09-05-trajectory-search-escape.md) 和 [Escape 清空插件清单搜索](2026-09-05-plugin-inventory-search-escape.md) 拥有同一套两步模式。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有环 token。
