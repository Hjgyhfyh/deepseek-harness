# Agent Note: 目录路径编辑加入浮层 Escape 栈

Status: implemented

[English](2026-09-05-directory-path-edit-overlay-escape.md) | 中文

## 问题

工作区目录选择器里的路径编辑用 `stopPropagation` 拦 Escape，以免浏览对话框旧的 document 监听把整窗关掉。嵌套新建也在名称框上同样拦。浮层改成 LIFO 栈之后，这些 stop 会把 Escape 藏过后来的对话框，并和 Modal 关闭重复。面包屑按钮、Miller 行和「显示隐藏」仍用浏览器轮廓（或没有轮廓）。

## 决策

浏览 Modal 内部挂一个子级 `useOverlayEscape` 帧（有路径草稿时），Escape 先收起编辑器，后挂的浮层仍能赢。嵌套新建的 Escape 只走嵌套 Modal 的栈帧（创建进行中 `onClose` 仍空操作）。面包屑、行和显示隐藏使用 `--dsw-shadow-focus-ring`。焦点离开对话框时，卡片作用域的 `blur` 仍取消路径编辑。

## 考虑过的方案

**继续在卡片上 `stopPropagation`。** 否决：它和共享栈打架，和以前的 composer 面板一样，后来的对话框看不到第一次 Escape。

**在 DirectoryBrowser 本体 hooks 里订阅路径编辑。** 否决：会压在浏览 Modal 下面（父 hooks 先于子 Modal hooks），Escape 会先关对话框。

## 后果

键盘用户可以丢掉已输入路径而不关选择器，再按一次 Escape 才关窗。盖在路径编辑上面的对话框拿走第一次 Escape。Tab 到的面包屑和文件夹行与产品环一致。

## 测试

`packages/client/ui-directory-picker-browse/tests/directory-browser.client.spec.tsx` 仍钉死输入框/行上的 Escape、嵌套新建 LIFO、以及创建进行中；现在还钉死后挂浮层让路。`packages/client/ui-directory-picker-browse/tests/browser-styles.client.spec.ts` 钉死面包屑、行、显示隐藏和新建字段上的环。

## 相关

[浮层 Escape 栈](2026-09-05-overlay-escape-stack.md) 拥有 LIFO。[浮层 z-index 阶梯](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) 拥有环 token。
