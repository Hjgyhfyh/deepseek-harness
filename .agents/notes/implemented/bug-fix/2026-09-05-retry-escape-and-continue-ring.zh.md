# Agent Note: 重试行 Escape 收起与文档流 Continue 环

Status: implemented

[English](2026-09-05-retry-escape-and-continue-ring.md) | 中文

## 问题

模型重试行是原生 `<details>` 展开。Enter/点击能打开延迟和失败正文，但 Escape 什么都不做——键盘打开后没有收起手势。轮次失败和 max-tokens 行上的文档流 Continue 芯片看起来只服务指针：`cursor: pointer`，没有悬停底色，也没有产品 `:focus-visible` 环，和 composer 的 Continue 不一样。

## 决策

重试 `<details>` 上的 Escape 收起已打开的行（`preventDefault`），并把焦点送回摘要。已收起的行忽略该键，后挂浮层仍能拿走。文档流 Continue 芯片使用 `--dsw-shadow-focus-ring` 和悬停底色。

## 考虑过的方案

**把重试行放进浮层 Escape 栈。** 否决：这是文档流里的 transcript 展开，不是一层。文档订阅会在重试行碰巧展开时从对话框抢走 Escape。

**把芯片改成 composer Continue 的样式。** 否决：composer 控件是输入铬里的 28px 胶囊；transcript 芯片是状态文案旁的紧凑带边框续跑入口。环和悬停底色是剩下的键盘/指针铬，不是改几何。

## 后果

键盘用户可以用 Escape 关掉重试详情并留在摘要上。失败或封顶轮次之后 Tab 到 Continue 能看到产品环。设置浮层仍赢第一次 Escape，因为该行只在自身持焦时处理该键。

## 测试

`packages/client/ui-conversation/tests/chat-view.client.spec.tsx` 钉死收起时忽略、展开时收起、以及摘要焦点恢复。`packages/client/ui-conversation/tests/message-item-styles.client.spec.ts` 钉死 Continue 的悬停底色和环。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO 浮层。[DisclosureRow Escape](2026-09-05-disclosure-row-escape.md) 是共用紧凑标题收起。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有环 token。
