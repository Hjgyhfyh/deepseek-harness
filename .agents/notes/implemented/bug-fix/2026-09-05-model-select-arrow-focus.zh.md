# Agent Note: ModelSelect 打开获焦与 ArrowDown 跳项

Status: implemented

[English](2026-09-05-model-select-arrow-focus.md) | 中文

## 问题

`ModelSelect.moveFocus` 把「没有当前行」当成下标 `0` 再加方向键偏移，所以从触发器按第一下 ArrowDown 会跳过第一行。打开后面焦点留在触发器上。根上的 `.cell` 行和菜单内 Retry 没有产品焦点环。

## 决策

没有行获焦时，ArrowDown 落到第一个启用项，ArrowUp 落到最后一个。打开或钻入子面板时，若有 `aria-checked` 的 radio 就聚焦它，否则聚焦第一个启用行。`.cell:focus-visible` 和 `.retry:focus-visible` 使用 `--dsw-shadow-focus-ring`。

## 考虑过的方案

**焦点留在触发器，只修 `-1` 的下标算术。** 否决：鼠标点开后键盘用户仍在芯片上，直到按方向键。

**Roving tabindex。** 否决：列表很短，已经是 `role="menu"`；`focus()` 与 Menu 原语一致。

## 后果

鼠标点开的模型菜单从第一行就能用方向键走。钻进模型或推理等级会停在当前选择。加载失败条上的 Retry 与其余铬同一套环。

## 测试

`packages/client/ui-model-selection/tests/model-select.client.spec.tsx` 钉死触发器 ArrowDown/Up、Model 与 Effort 之间循环，以及钻入后聚焦当前模型 radio。

## 相关

[Menu 键盘焦点](2026-09-05-menu-keyboard-focus.md) 拥有共享 Menu 原语上同一套「打开并方向键」模式。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有环 token。
