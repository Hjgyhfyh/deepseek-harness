# Agent Note: Escape 清空轨迹工具栏搜索

Status: implemented

[English](2026-09-05-trajectory-search-escape.md) | 中文

## 问题

轨迹账本搜索是受控的 `type="search"` 字段。Escape 不改 React 状态：Chrome 自带的搜索清除可能把 DOM 值清空却不走 `onChange`，过滤仍停在上一次查询。空字段也留着焦点，第二次 Escape 无法离开工具栏。

## 决策

查询非空时 Escape 会 `preventDefault`，并通过 `onSearchQueryChange` 写入 `''`。查询为空时 Escape 让字段失焦。工具栏开关以及剩余的插件/队列/workflow/JsonTree/风险铬使用 `--dsw-shadow-focus-ring`。

## 考虑过的方案

**依赖浏览器自带的搜索清除。** 否决：原生 Escape/`type="search"` 不能可靠更新受控 React 值。

**拦住事件，以免时间线范围的 Escape 被触发。** 否决：搜索框不是时间线的祖先，冒泡不是这个 bug。

## 后果

一次 Escape 去掉实时账本过滤。第二次 Escape 把焦点还回页面。工具栏上的键盘焦点与其余产品环一致。

## 测试

`packages/client/ui-trajectory/tests/layout.client.spec.tsx` 钉死先清空再失焦、输入，以及 duration/折叠控件。

## 相关

[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有环 token。
