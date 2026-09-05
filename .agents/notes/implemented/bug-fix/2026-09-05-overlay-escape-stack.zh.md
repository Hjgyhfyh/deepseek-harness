# Agent Note: 浮层 Escape 是 LIFO 栈

Status: implemented

[English](2026-09-05-overlay-escape-stack.md) | 中文

## 问题

Menu、Modal、SettingsRoot、ContextMeter 和 ImageLightbox 各自在 document 或 window 上注册 Escape 监听器。冒泡顺序就是挂载顺序，所以先挂上的 Settings 会在同一下 Escape 里关掉，而这时本该先关 Settings 里刚打开的 Menu。嵌套 Modal 能活下来，只是因为 DirectoryBrowser 给外层 `onClose` 加了闸。若订阅寿命跟着 `onClose` 身份走，父组件重渲染换掉回调还会把 Settings 重新压到仍打开的 Menu 上面。

## 决策

`subscribeOverlayEscape` 维护 LIFO 栈和一条 document 监听。只有栈顶处理 Escape（`preventDefault`；若已经 `defaultPrevented` 则跳过）。`useOverlayEscape(active, onClose)` 按浮层打开寿命订阅，并把 `onClose` 放进 ref，父组件重渲染不会打乱栈序。Menu、Modal、Settings、ContextMeter 和 ImageLightbox 消费该 hook。Settings 的 Escape 把焦点送回触发器。Composer 附件、AgentPresetSeat、工具卡复制/展开、Search 文件头、JsonBlock 开关、消息图片框/重试使用 `--dsw-shadow-focus-ring`。

## 考虑过的方案

**在顶层浮层上 `stopImmediatePropagation`。** 否决：会和无关的 document 监听打架（菜单箭头、路径编辑）。所有浮层的 document Escape 迁过来之后，栈加上 `defaultPrevented` 就够。

**只靠 DirectoryBrowser 的外层闸处理嵌套对话框。** 否决：Settings+Menu 和灯箱盖在对话框上没有同等的闸。

## 后果

Escape 一次只关一层浮层。Settings 里的 Menu 不再连带关掉 Settings。嵌套新建文件夹仍先关；外层闸留作纵深防御。附件、预设座位和工具卡的键盘铬与产品环一致。

## 测试

`packages/client/ui-primitives/tests/overlay-escape.client.spec.tsx` 钉死 LIFO、二次退订、`defaultPrevented`、hook 的 active/`onClose` 替换，以及父级 `onClose` 身份变化不抢栈。Modal、Menu、Settings、ContextMeter、ImageLightbox 测试仍在 `document` 上发 Escape。DirectoryBrowser 嵌套新建的 Escape 仍钉死先关最上层。

## 相关

[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有环 token。[反馈备注 Escape](2026-09-05-feedback-note-escape.md) 先前拥有 ContextMeter 的 `preventDefault`（现在走栈）。
