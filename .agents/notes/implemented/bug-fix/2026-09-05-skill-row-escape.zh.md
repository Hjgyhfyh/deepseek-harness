# Agent Note: Skill 行 Escape 收起并补齐剩余铬环

Status: implemented

[English](2026-09-05-skill-row-escape.md) | 中文

## 问题

专用 skill 工具行是整行展开，支持 Enter/Space，但 Escape 什么都不做——键盘打开说明卡片后，除了 Tab 走开再点一下，没有收起手势。Inspect 在悬停前 `opacity: 0`，Tab 会落到看不见的控件上。可展开标题用浏览器轮廓或没有轮廓；Inspect 的 `:focus-visible` 只是让按钮现身。

## 决策

卡片上的 Escape 收起已展开的行（`preventDefault`）并把焦点送回标题，Inspect 持焦时也一样。已收起的行忽略 Escape，后挂浮层仍能拿走该键。标题使用 `--dsw-shadow-focus-ring`，并在 `:focus-visible` 上显示悬停时的 chevron。卡片包含焦点时 Inspect 保持可见，并使用产品环。

## 考虑过的方案

**把该行放进浮层 Escape 栈。** 否决：这是文档流内的展开，不是一层。文档订阅会在 skill 行碰巧展开时从对话框抢走 Escape。

**Inspect 直到聚焦才显示。** 否决：Tab 会进入看不见的控件。在 `:focus-within` 上显示与悬停一致，又不会在每条收起的行上画出它。

## 后果

键盘用户可以用 Escape 关掉说明并留在摘要上。只要卡片是键盘上下文，Inspect 就可见。设置浮层仍赢第一次 Escape，因为该行只在自身（或 Inspect）持焦时处理该键。

## 测试

`packages/client/ui-skill/tests/skill-row.client.spec.tsx` 钉死收起时忽略、展开时收起、以及 Inspect 上 Escape 把焦点送回标题。`packages/client/ui-skill/tests/skill-row-styles.client.spec.ts` 钉死两处环。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有环 token。紧凑标题铬仿写 DisclosureRow；Escape 留在本 toolview 本地。
