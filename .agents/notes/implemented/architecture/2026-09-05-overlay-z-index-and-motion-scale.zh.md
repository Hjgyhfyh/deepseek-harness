# Agent Note: 浮层 z-index 阶梯、圆角与动效尺度

Status: implemented

[English](2026-09-05-overlay-z-index-and-motion-scale.md) | 中文

## 问题

浮层铬（对话框、设置、灯箱、toast、tooltip、菜单）各自写了一个局部整数。Tooltip 与悬停卡片在 `100`，对话框在 `1000`，日后若把气泡挂到 `document.body` 就会画在遮罩下面。Toast 用 `1100` 压过灯箱的 `1000`，菜单 portal 也用 `1100` 压过对话框——两次互不相干的「比 1000 高一点」。若干控件把键盘焦点写成 `outline: none`。深色主题仍用浅色阴影的 alpha，抬升会塌成发丝光晕。

## 决策

`packages/client/ui-theme/src/styles/base.css` 拥有四组可叠加尺度：

- `--dsw-z-sticky` 100、`--dsw-z-dropdown` 1000、`--dsw-z-overlay` 1100、`--dsw-z-modal` 1200、`--dsw-z-popover` 1300、`--dsw-z-tooltip` 1400、`--dsw-z-toast` 1500
- `--dsw-radius-xs` 到 `--dsw-radius-3xl` 以及 `--dsw-radius-pill`
- `--dsw-motion-fast|normal|slow` 与 `--dsw-easing-*`；`@media (prefers-reduced-motion: reduce)` 把动效尺度归零
- `--dsw-shadow-focus-ring`，深色主题在 `body[data-ds-dark-theme]` 上用更高 alpha

视口浮层消费 z-index 阶梯。文档流内的层叠（时间线、composer 座位、拖动手柄）仍用局部整数。Portal 菜单用 `--dsw-z-popover`，保证仍在 `--dsw-z-modal` 之上。键盘铬（`Button`、`Input` 的 focus-within、对话框/设置/灯箱关闭、侧边栏新建会话、设置触发与导航、composer 附件/发送/Continue/Plan 选择、模型芯片、ModelSelect 行/重试、权限芯片、GoalBar 图标、ContextMeter 触发器、TodoPanel 标题、消息复制/分支、消息反馈、压缩标记、详情关闭、会话面包屑/页签、更早/回到底部、AttachmentRail 删除/箭头、消息图片框/重试、CodeBlock 复制、Terminal/Search/Read/Diff 复制与展开、Search 文件头、JsonBlock 开关、EnterBehavior 选择器、Language/Appearance/Permission/AgentPreset 选择器、AgentPresetSeat、SubagentCatalog 触发器、JobList 触发器、QueueDock 标题与操作、工作区搜索/行/重命名/溢出、新建工作区与目录创建字段、键盘编辑路径时的目录面包屑栏、目录面包屑/行/显示隐藏、BotForge 花名册/坞、提问选项、插件/预设/模型字段、插件卡片/页签/清单卡片与重试、轨迹工具栏/「更早历史」/轨道/折叠行/源跳转/详情分隔条/关闭与详情页签/概览开关/工具调用行、产出文件芯片、JsonTree 展开与复制、markdown 链接与文件提及、web 搜索/抓取源链接、slash 菜单项、workflow 运行/阶段/成员、命令面板当前行、Menu 项、DisclosureRow、重试摘要、Plan 芯片、风险确认复选框、提问卡片标题/翻页、审批详情正文、计划审阅正文）使用焦点环。AppFrame 的会话栏是 `<main>` 地标。

## 考虑过的方案

### 保留原来的 100 / 1000 / 1100，只把 tooltip 提到 1100

否决：每个新浮层还会再猜一个数，toast、灯箱、菜单 portal 仍会撞车。

### 在外壳样式表写一条全局 `:focus-visible`

否决：许多控件以更高优先级写了 `outline: none`，部分 figma 节点（composer 对话框输入）有意不要环。作为 Tab 停靠点的铬自行选择加入。

### 把每个 figma 圆角（18、22、14）都改成最近的尺度档

否决：那些半径是已上线的 DeepSeek Chat 几何。尺度只用于数值已经对齐的地方。

## 后果

Tooltip 或悬停卡片在对话框上仍可读。Portal 菜单仍在设置面板之上。Toast 仍是最顶层公告。减少动效的用户得到时长为零的动效尺度，而不必每条动画自己写 `@media`。键盘用户在主铬上能看见焦点环。Figma 特有的 18/22 半径仍按原稿数字书写。

## 测试

`packages/client/ui-layout/tests/app-frame.client.spec.tsx` 钉死会话栏为 `main`。原语与设置测试继续覆盖同一套铬，不快照计算后的 z-index。

## 相关

[主题滚动条与预留槽](../bug-fix/2026-07-28-themed-scrollbars-and-reserved-gutter.md) 拥有滚动条重新绑定。[`dsh-client-ui-theme`](../../../../packages/client/ui-theme/README.md) 拥有主题 token。
