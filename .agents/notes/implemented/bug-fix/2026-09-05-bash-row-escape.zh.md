# Agent Note: Bash 行 Escape 收起与剩余键盘铬

Status: implemented

[English](2026-09-05-bash-row-escape.md) | 中文

## 问题

专用的 bash/pwsh 工具行是整行展开，支持点击/Enter/Space，但 Escape 什么都不做——键盘打开终端卡片后，只能再点摘要才能收起。可展开表头用的是浏览器默认轮廓或没有轮廓，icon→chevron 预览只在悬停时出现，所以键盘焦点和指针不一致。Inspect 在悬停前 `opacity: 0`，Tab 会落到看不见的控件上。

## 决策

卡片上的 Escape（`preventDefault`）收起已打开的行并把焦点送回表头，包括 Inspect 持焦时。已收起的行忽略该键，之后的浮层仍能拿走。表头使用 `--dsw-shadow-focus-ring`，并在 `:focus-visible` 上显示悬停 chevron。Inspect 在卡片包含焦点时保持可见，并使用产品环。

## 考虑过的方案

**把行放进浮层 Escape 栈。** 否决：这是文档流展开，不是一层。文档订阅会在 bash 行碰巧展开时从对话框抢走 Escape。

**Inspect 只在自己聚焦时才显示。** 否决：Tab 会进入看不见的控件。在 `:focus-within` 上显示，既匹配悬停，也不会在每条收起的行上画出它。

**把行改接到 `DisclosureRow`。** 否决：bash 注册项是 ToolRow 铬的本地副本（终端卡片、运行扫光），不能引入 chat 域的行。Escape 和剩余铬属于这份副本。

## 后果

键盘用户可以用 Escape 关掉 bash 终端卡片并留在摘要上。只要卡片是键盘上下文，Inspect 就可见。设置浮层仍能拿走第一次 Escape，因为该行只在自己（或 Inspect）持焦时处理该键。

## 测试

`packages/client/ui-tool/tests/terminal-card.client.spec.tsx` 钉死收起时忽略、打开行收起、以及 Inspect Escape 恢复表头焦点。`packages/client/ui-tool/tests/bash-row-styles.client.spec.ts` 钉死两处环和焦点 chevron 预览。

## 相关

[Skill 行 Escape](2026-09-05-skill-row-escape.md) 是兄弟副本。[DisclosureRow Escape](2026-09-05-disclosure-row-escape.md) 是通用 ToolRow 已经在用的。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 现在把 bash 行环列在 skill 旁边。
