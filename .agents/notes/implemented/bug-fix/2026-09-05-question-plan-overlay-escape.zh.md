# Agent Note: 提问与计划审阅的 Escape 加入浮层栈

Status: implemented

[English](2026-09-05-question-plan-overlay-escape.md) | 中文

## 问题

作曲器提问接管有取消和收起，但 Escape 什么都不做。第一下就会丢掉整次 host 等待。计划审阅的「去聊天里说」就是同一套取消，却只能点。标题/翻页图标按钮和计划正文（为了能读长计划而做成 tab stop）仍用浏览器轮廓或没有轮廓。

## 决策

提问的 Escape 在浮层栈上分两步：第一次收起卡片并把焦点送回展开按钮；第二次（或已经收起时）取消等待。计划审阅的 Escape 就是这次取消。发送进行中栈退订。标题/翻页按钮和计划正文使用 `--dsw-shadow-focus-ring`。计划正文是带名的 `tabIndex={0}` group，键盘可以滚动。

## 考虑过的方案

**第一次 Escape 就取消。** 否决：等同点放弃，自定义答案会和等待一起消失。

**计划审阅不进栈。** 否决：「去聊天里说」已经是取消动词；后挂的对话框仍须赢第一次。

## 后果

键盘用户可以先收起提问去看正文，再放弃。计划审阅 Escape 和「去聊天里说」一样把作曲器还回来。盖在上面的设置浮层仍先拿走 Escape。

## 测试

`packages/client/ui-user-questions/tests/user-questions-composer.client.spec.tsx` 钉死先收起再取消，以及后挂浮层让路。`packages/client/ui-user-questions/tests/plan-review-panel.client.spec.tsx` 钉死 Escape 取消、后挂让路、以及决策后 Escape 不再取消。`packages/client/ui-user-questions/tests/browser-styles.client.spec.ts` 钉死环。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有环 token。
