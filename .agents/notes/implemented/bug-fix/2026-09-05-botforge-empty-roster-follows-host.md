# Agent Note: Empty BotForge roster follows host defaults

Status: implemented

English | [中文](2026-09-05-botforge-empty-roster-follows-host.zh.md)

## Problem

The Employees settings page treated a missing or empty `workers` array as an empty roster and wrote `[]` when the last employee was deleted. Host `applyRoster` maps that same empty array to `defaultWorkers()`, so live routing still had four employees while the page said there were none. Adding one employee then saved a one-row document and replaced the live defaults.

## Decision

`EmployeesSection` memoizes `defaultEmployees()` when `workers` is missing or empty, so the fallback roster is a stable array for the stored snapshot. Deleting the last employee writes that default roster instead of `[]`. Host `applyRoster` is unchanged: an empty stored array still becomes `defaultWorkers()`.

## Alternatives considered

**Honor `[]` on the host and run with no employees.** Rejected: `applyRoster` already treats empty as the built-in roster, and the settings empty-state copy told the user to restore defaults rather than run empty.

**Keep writing `[]` from the page and only change the empty-state copy.** Rejected: the next save of a newly added employee would still persist a one-row document over the live defaults.

## Consequences

A settings document with no workers shows and saves the same four employees the host already runs. The empty-roster line remains for a theoretically empty `defaultEmployees()` result.

## Testing

`packages/client/ui-botforge/tests/employees-section.client.spec.tsx` pins an empty stored roster to `Roblox Scripter` and last-employee delete to `defaultEmployees()`.

## Related

[BotForge worker normalize fills required strings](2026-09-05-botforge-normalize-worker-required-fields.md) owns the host row shape.
