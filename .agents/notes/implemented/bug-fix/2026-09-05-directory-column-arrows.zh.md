# Agent Note: 目录浏览器分栏方向键与行/显示隐藏焦点颜色

Status: implemented

[English](2026-09-05-directory-column-arrows.md) | 中文

## 问题

Miller 分栏的文件夹行只认指针：Tab 能落到一行，但 ArrowUp/ArrowDown 什么都不做，键盘用户只能把每个兄弟都 Tab 一遍。「显示隐藏」开关在 `:focus-visible` 上用了产品环，但仍是空闲的次级色，聚焦的行保持透明底，所以键盘焦点和悬停不一致。

## 决策

已聚焦行上的 ArrowUp 和 ArrowDown（`preventDefault`）把焦点和选择移到同一栏的上一行或下一行。栏任一端的行忽略该键。Escape 仍归浏览对话框、路径编辑和嵌套创建。键盘焦点把「显示隐藏」涂成与悬停相同的主色，给空闲行铺上悬停底，已选中的行保留选中底。环仍在 `:focus-visible` 上。

## 考虑过的方案

**在「显示隐藏」上抢走 Escape 来关掉过滤。** 否决：开关在浏览对话框里。浮层栈已经拥有 Escape，用该键关掉过滤并不会关闭用户想关掉的东西。

**移动选择但不把焦点带到下一行。** 否决：下一次方向键仍打在旧行上。焦点必须跟着选择走。

**把分栏方向键放进浮层 Escape 栈。** 否决：方向键不是关闭。对话框、路径编辑和创建仍在栈上。

## 后果

键盘用户可以用方向键在一栏里步进，并看到与指针悬停相同的底。「显示隐藏」作为 tab 停点时看起来像悬停。Escape 仍先关路径编辑，再关创建，再关浏览对话框。

## 测试

`packages/client/ui-directory-picker-browse/tests/directory-browser.client.spec.tsx` 钉死 ArrowDown/ArrowUp 选择、栏尾忽略，以及其他键不移动。`packages/client/ui-directory-picker-browse/tests/browser-styles.client.spec.ts` 钉死悬停/焦点配色和已有的环。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 已列出目录面包屑、行和显示隐藏环。
