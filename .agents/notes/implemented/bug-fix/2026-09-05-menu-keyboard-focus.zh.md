# Agent Note: Menu 键盘焦点与方向键导航

Status: implemented

[English](2026-09-05-menu-keyboard-focus.md) | 中文

## 问题

打开的 `Menu` 列表原先只在 Escape 和外部 pointerdown 时关闭。焦点留在触发器上。方向键什么也不做。菜单项是真正的 button，Tab 能走到，但没有列表内导航，`.item` 也没有产品焦点环。

## 决策

`open` 期间，文档上的 `keydown` 监听器在 ArrowUp/Down 之间移动 `button[role="menuitem"]:not([disabled])` 并循环。打开时通过 `data-menu-id` 把焦点放到已选项（启用的），否则放到第一个启用项。`.item:focus-visible` 使用 `--dsw-shadow-focus-ring`。

## 考虑过的方案

**给每一项 roving tabindex。** 否决：列表很短，已经是单个 `role="menu"`；文档方向键加 `focus()` 足够。

**焦点留在触发器，只有列表内有焦点才处理方向键。** 否决：鼠标点开后键盘用户仍在列表外。

## 后果

JsonTree 上下文菜单和工作区溢出菜单打开即获焦。方向键跳过禁用项和标题行。现有点击测试仍可用。

## 测试

`packages/client/ui-primitives/tests/atoms.client.spec.tsx` 钉死已选项获焦、循环方向键、无焦点行时的 ArrowUp/Down、仅有标题的列表，以及 portal 尚无矩形时的 ArrowDown。

## 相关

[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有菜单项以及同一次改动里对齐的轨迹/Plan/重试/Disclosure 铬所用的环 token。
