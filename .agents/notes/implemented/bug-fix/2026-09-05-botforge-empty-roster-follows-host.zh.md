# Agent Note: 空的 BotForge 花名册跟随 Host 默认

Status: implemented

[English](2026-09-05-botforge-empty-roster-follows-host.md) | 中文

## Problem

员工设置页把缺失或空的 `workers` 数组当成空花名册，并在删掉最后一位员工时写入 `[]`。Host 的 `applyRoster` 把同一个空数组映射成 `defaultWorkers()`，因此线上路由仍有四名员工，页面却显示没有。再添加一名员工会存下一行文档并盖掉线上默认名册。

## Decision

`EmployeesSection` 在 `workers` 缺失或为空时把 `defaultEmployees()` 记进 memo，使回退名册对当前存储快照保持稳定数组。删除最后一位员工写入该默认名册，而不是 `[]`。Host `applyRoster` 不变：空的存储数组仍变成 `defaultWorkers()`。

## Alternatives considered

**让 Host 接受 `[]` 并在没有员工时运行。** 否决：`applyRoster` 已经把空数组当成内置名册，设置页的空状态文案是让用户恢复默认，而不是空跑。

**页面继续写 `[]`，只改空状态文案。** 否决：下一次保存新加的员工仍会把一行文档盖到线上默认名册上。

## Consequences

没有 workers 的设置文档显示并保存 Host 已经在跑的四名员工。空花名册那一行仍留给理论上 `defaultEmployees()` 为空的结果。

## Testing

`packages/client/ui-botforge/tests/employees-section.client.spec.tsx` 把空存储名册钉成 `Roblox Scripter`，把删除最后一位钉成 `defaultEmployees()`。

## Related

[BotForge 员工规范化补齐必填字符串](2026-09-05-botforge-normalize-worker-required-fields.md) 拥有 Host 行形状。
