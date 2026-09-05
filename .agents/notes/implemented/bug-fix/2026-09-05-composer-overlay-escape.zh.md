# Agent Note: Composer 的 slash 与命令面板加入浮层 Escape 栈

Status: implemented

[English](2026-09-05-composer-overlay-escape.md) | 中文

## 问题

Slash 建议和命令 `popupSelect` 外壳只在 composer 子树上处理 Escape（textarea 的 `dismissPopup`、卡片的 `onKeyDown`）。后挂到共享栈上的对话框看不到第一下 Escape，对话框关掉后面板还挂着。Slash 选项行是真正的 Tab 停靠点，Tab 会离开 combobox 的 textarea。高亮的 slash 行也还是浏览器轮廓（或没有），而不是产品环。

## 决策

`MenuView` 和 `PopupSelectView` 在卡片显示期间通过 `useOverlayEscape` 订阅。命令外壳在 `RiskConfirmation` Modal 打开时退订，确认框成为栈顶。Slash 选项按钮使用 `tabIndex={-1}`。激活和 `:focus-visible` 的 slash 行使用 `--dsw-shadow-focus-ring`。

## 考虑过的方案

**Slash 的 Escape 继续只走 textarea。** 否决：Tab 进到一行，或对话框关掉后再按 Escape，列表都不会关。

**在命令卡片的 Escape 上 `stopPropagation`。** 否决：这是把事件藏起来而不是入栈；若卡片和确认 Modal 都在听，仍会抢。

## 后果

Escape 一次只关一层 composer 浮层。`popupSelect` 里的风险确认先关。Tab 留在 slash 的 textarea。Slash 行的键盘高亮与命令面板的环一致。

## 测试

`packages/client/ui-input-trigger/tests/menu-view.client.spec.tsx` 钉死 `tabIndex={-1}` 以及后挂栈帧先赢 Escape。`packages/client/ui-commands/tests/popup-view.client.spec.tsx` 仍从搜索框关闭，并钉死后挂浮层的情况。

## 相关

[页头弹出层加入浮层 Escape 栈](2026-09-05-header-overlay-escape.md) 在会话页头操作上拥有同一套订阅。[浮层 Escape 是 LIFO 栈](2026-09-05-overlay-escape-stack.md) 拥有共享监听。
