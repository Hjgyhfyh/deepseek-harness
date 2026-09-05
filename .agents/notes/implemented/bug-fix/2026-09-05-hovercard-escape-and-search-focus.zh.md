# Agent Note: HoverCard Escape 与工作区搜索焦点还原

Status: implemented

[English](2026-09-05-hovercard-escape-and-search-focus.md) | 中文

## 问题

侧边栏会话搜索第二次 Escape 已经会收起字段，但输入框在变成 `tabIndex={-1}` 后仍占着焦点，键盘停在不可 Tab 的控件上。清除按钮卸掉自己后焦点落到 `document.body`。点到外面本来就会先 blur 再收起空查询，不能再把光标抢回来。HoverCard 预览（会话/项目被截断的标题）忽略 Escape：可复制卡片的 `onKeyDown` 只处理 Enter/Space，Escape 既不复制也不关闭。

## 决策

宽栏搜索保留触发器 ref。空查询上的 Escape 和清除按钮置还原标记；收起后的 effect 把焦点送回搜索芯片，`:focus-visible` 画出 `--dsw-shadow-focus-ring`。点到外面仍然收起但不还原。HoverCard 调用 `useOverlayEscape(open, close)`，Escape 按当前浮层关掉预览（z-popover 在 modal 之上）。会话行和搜索结果行沿用同一环 token（工作区样式测试现在钉死）。

## 考虑过的方案

**点到外面也把焦点送回搜索芯片。** 否决：点到别处会把键盘焦点拽回侧边栏。

**只在可复制卡片节点上处理 HoverCard 的 Escape。** 否决：不可复制预览没有 tab stop，而且后挂的对话框必须赢共享栈。

## 后果

第二次 Escape（以及清除）把光标送回搜索图标并带上产品环。点到外面仍把焦点留在指针去处。悬停截断行再按 Escape 关闭预览且不复制；后挂的浮层仍拿走第一次 Escape。

## 测试

`packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx` 钉死 Escape/清除还原，以及点到外面不还原。`packages/client/ui-primitives/tests/hover-card.client.spec.tsx` 钉死 Escape 关闭且不复制，以及让给后挂浮层。

## 相关

[工作区搜索 Escape](2026-09-05-workspace-search-escape.md) 拥有两步先清空再收起。[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有环 token。
