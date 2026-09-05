# Agent Note: AgentPreset 创造卡虚线与重试焦点环

Status: implemented

[English](2026-09-05-agent-preset-creator-ring.md) | 中文

## 问题

预设分区上的虚线 Creator 添加卡只有悬停底色。键盘焦点仍是空闲灰虚线，外加浏览器默认描边或没有描边，不像无工作区 composer 卡片（悬停/焦点业务蓝虚线），也不像设置里其他用产品环的控件。名单读取失败的重试控件有悬停底色、没有环。

## 决策

创造卡在悬停和 `:focus-visible` 上把虚线涂成 `--dsw-alias-state-business-primary`，键盘焦点使用 `--dsw-shadow-focus-ring`。重试控件使用同一环。禁用的创造铬不变（透明度，无虚线变色，无环）。无写根原因只在按钮禁用时作为 `title`。

## 考虑过的方案

**对齐模型页 `addButton`（有环、虚线不变色）。** 否决：创造卡被写成「预设将出现的空位」，和无工作区 composer 卡片同一读法。焦点上仍是灰虚线，键盘用户看不出自己在空位上。

**把 Creator 放进浮层 Escape 栈。** 否决：它不是一层。设置已经拥有 Escape；原生按钮上的 Enter 会开始草稿。

## 后果

键盘用户 Tab 到 Creator 时看到与指针悬停相同的蓝虚线和产品环，Enter 仍离开设置进入新会话。名单失败后的重试是可见的 tab 停点。禁用的 Creator（没有可写根）不会假装成可点空位。

## 测试

`packages/client/ui-agent-preset/tests/section-styles.client.spec.ts` 钉死创造卡虚线/环和重试环。现有分区测试仍点击 Creator 和 Retry。

## 相关

[无工作区 composer 卡片](2026-09-05-workspace-card-picker-toggle.md) 拥有蓝虚线空位语言。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有环 token，并已列入此铬。
