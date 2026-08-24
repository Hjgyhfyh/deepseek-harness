# Agent Note: 显式「立即发送」投递与员工一任务一聊天

状态：已实现

[English](2026-08-23-send-now-and-per-chat-employee-delegation.md) | 中文

## 问题

围绕工作中间的消息传递，有三处能力缺口。Web 作曲器在普通会话忙碌时只显示 Stop——鼠标用户既无法把已输入的草稿排队，也无法把它送进正在运行的轮次，除非知道键盘偏好。队列 dock 的行级动作叫「Steer」（插话发送），读不出"现在就发"的意思。对员工而言，没有任何东西告诉编排器每次 `delegate_employee` 都会开启全新会话，于是实践中后续消息都堆进一个长寿聊天；而且 `send_message` 只能排在员工运行中的轮次后面——无法立即重定向正在进行的工作。

## 决策

**作曲器直接展示选择。** 当普通会话运行且草稿非空时，`InputBar` 在 Stop 旁渲染两个 ghost 控件：Queue（`排队发送（本轮结束后送达）`，机器 queue 模式）与 Send now（`立即发送（打断当前轮次）`，新增的 `InputActions.submitNow()` → steer 模式）。可继续子会话两个按钮都不显示；空闲会话保留单一 Send。

**统一词汇：「立即发送 / Send now」。** dock 行级动作、整队手势文案、设置中的 busy-Enter 选项（`settings.enter.steer`）与失败提示全部由 Steer 改名为 立即发送 / Send now。本地化键保留 `queue.steer*` 名称以减少改动。

**父→子的立即投递。** `send_message` 新增 `deliver: "queued" | "now"`（默认 queued）。`"now"` 先用既有 ancestor 授权中断子智能体当前轮次，通过在线 Agent 注册表（现已注入 `agents`）有界等待（上限 10 秒）驱动停稳，再把消息作为唤醒轮次准入；超时则降级为排队路径并报告 `queued`。输出模式携带解析后的 `delivered` 模式，render 会说明。

**员工一任务一聊天。** 每次 `delegate_employee` 本来就打开新的可继续子会话；默认编排器提示词（宿主与客户端两份副本）和工具描述现在明确说明：新任务 → 新聊天，`send_message` 只用于给同一任务的聊天补充工作。

## 考虑过的替代方案

**发送时的 queue/send 弹窗。** 否决：键盘偏好策略已经拥有手势默认值；两个可见按钮可逆、可发现，且不阻塞输入。

**在 `subagents.followup` 内做 steer。** 否决：服务的 FIFO 契约保持完整；在工具层组合 interrupt+followup 让权限检查留在今天所在的位置，并优雅降级。

**给 delegate_employee 加 `new_chat` 标志。** 无意义——每次调用本就生成全新子会话；缺口在文档与提示词指引，不在机制。

## 后果

忙碌状态下鼠标与键盘能力对齐；「steer」只剩内部命名。立即重定向可能把员工做到一半的工作拦腰打断——这正是它的目的；10 秒停稳上限在子智能体忽略取消时为工具调用兜底。修复 ui-botforge 的项目引用暴露了那里的潜伏类型错误（缺 css-modules 声明、目录 fixture 漂移、dock 类型收窄）；修复后客户端类型检查图再次端到端通过。
