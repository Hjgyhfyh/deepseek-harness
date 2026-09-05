# Agent Note: Workspace 会话溢出 Escape 收起与焦点颜色

Status: implemented

[English](2026-09-05-session-overflow-escape.md) | 中文

## 问题

打开的 Workspace 默认显示五条 Session，其余用临时的**展开其余**控件。点击/Enter 能露出多余行，但 Escape 什么都不做——键盘展开后只能再点**收起**，下一次 Escape 会打到搜索或浮层。控件在 `:focus-visible` 上用了产品环，但仍是空闲的三级色，所以键盘焦点和悬停不一致。

## 决策

已展开其余条目上的 Escape（`preventDefault`）收回到五条并把焦点留在控件上。已收起的控件忽略该键，搜索和浮层仍能拿走。关闭 Workspace 仍然忘掉这次临时展开。键盘焦点把标签涂成与悬停相同的次级色。

## 考虑过的方案

**把其余条目放进浮层 Escape 栈。** 否决：这是侧边栏里的文档流列表展开，不是一层。文档订阅会在任何 Workspace 碰巧显示多余 Session 时从设置或菜单抢走 Escape。

**焦点上标签仍用三级色，只靠环。** 否决：悬停已经把标签升到次级色。键盘焦点还停在空闲色，看起来像指针没点中控件。

**Escape 收起整个 Workspace 分组。** 否决：那会藏起用户正在浏览的五条可见 Session。溢出控件只拥有多余的行。

## 后果

键盘用户可以用 Escape 关掉**展开其余**并留在控件上；第二次 Escape 仍到达搜索或浮层。Workspace 仍开着，只显示五条 Session。Tab 到控件看起来像悬停。

## 测试

`packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx` 钉死收起时忽略、展开其余后收起且不关闭 Workspace、以及焦点留在控件上。`packages/client/ui-workspace/tests/browser-styles.client.spec.ts` 钉死悬停/焦点配色和已有的环。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出溢出按钮环。
