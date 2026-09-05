# Agent Note: 页头弹出层加入浮层 Escape 栈

Status: implemented

[English](2026-09-05-header-overlay-escape.md) | 中文

## 问题

第 9 轮把 Menu/Modal/Settings/ContextMeter/ImageLightbox 迁到 LIFO Escape 栈。ModelSelect、JobList 和 SubagentCatalog 仍在自己的根节点上处理 Escape。ModelSelect 住在 Settings 里：冒泡的 Escape 会先关面板再关设置浮层。JobList 和目录只有焦点还在子树里时才听得到 Escape，所以上层对话框抢不到第一下，对话框关掉后弹出层还挂着。

## 决策

这三个弹出层在打开寿命内通过 `useOverlayEscape` 订阅。ModelSelect 仍先退出钻入的子面板再关闭。JobList 和目录仍把焦点送回触发器。Web 搜索/抓取源链接使用 `--dsw-shadow-focus-ring`。

## 考虑过的方案

**在 ModelSelect 的 Escape 上 `stopPropagation`。** 否决：这是把事件藏起来而不是入栈，JobList/目录仍然听不到 document 级 Escape。

**页头弹出层继续只听子树。** 否决：Settings + ModelSelect 仍会双关，对话框下面的弹出层也看不到第二下 Escape。

## 后果

设置里的模型菜单上 Escape 只关菜单。后挂上的浮层先关，JobList 或目录留着；下一把 Escape 关掉弹出层，即使焦点已经回到别的触发器。

## 测试

`packages/client/ui-model-selection/tests/model-select.client.spec.tsx` 钉死先退出子面板再关闭。`packages/client/ui-jobs/tests/job-list-action.client.spec.tsx` 钉死后挂的栈帧先赢，然后列表才关。Subagent 目录键盘测试仍在获焦行上发 Escape。

## 相关

[浮层 Escape 是 LIFO 栈](2026-09-05-overlay-escape-stack.md) 拥有共享监听。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有环 token。
