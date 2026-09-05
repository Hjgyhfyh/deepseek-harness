# Agent Note: 附件栏缩略图方向键与翻页箭头焦点底

Status: implemented

[English](2026-09-05-attachment-rail-arrows.md) | 中文

## 问题

草稿图片缩略图在邻项移动上只认指针：Tab 能落到一张卡片，但 ArrowLeft/ArrowRight 什么都不做，键盘用户只能把每张缩略图和它的删除都 Tab 一遍。翻页箭头在 `:focus-visible` 上用了产品环，但仍是空闲底，所以键盘焦点和悬停不一致。缩略图本身没有产品环。

## 决策

已聚焦缩略图或删除按钮上的 ArrowLeft 和 ArrowRight（`preventDefault`）把焦点移到上一张或下一张上的同一控件并滚入视野。栏任一端的条目忽略该键。键盘焦点把翻页箭头涂成与指针悬停相同的实心底。缩略图在 `:focus-visible` 上使用 `--dsw-shadow-focus-ring`。Escape 仍归输入框弹层栈和灯箱。

## 考虑过的方案

**用 ArrowLeft/ArrowRight 按视口翻页。** 否决：那会跳过卡片。邻项移动加上 `scrollIntoView` 落在下一张图上，这正是该键要的。

**把附件栏放进浮层 Escape 栈。** 否决：方向键不是关闭。灯箱和输入框弹层仍在栈上。

**让翻页箭头在焦点上保持空闲底，只靠环。** 否决：悬停已经铺上实心底。键盘焦点保持空闲底看起来像指针没点到控件。

## 后果

键盘用户可以用方向键在草稿图之间步进，并在翻页控件上看到与悬停相同的底。作为 tab 停点的缩略图显示产品环。Escape 仍关闭打开的灯箱或输入框弹层。

## 测试

`packages/client/ui-attachment/tests/attachment-rail.client.spec.tsx` 钉死缩略图和删除上的 ArrowLeft/ArrowRight、栏尾忽略，以及其他键不移动。`packages/client/ui-attachment/tests/attachment-rail-styles.client.spec.ts` 钉死缩略图/删除/箭头环和箭头悬停/焦点底配对。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 列出 AttachmentRail 缩略图、删除和箭头环。
