# Agent Note: Explicit send-now delivery and one-task-per-employee-chat

Status: implemented

English | [中文](2026-08-23-send-now-and-per-chat-employee-delegation.zh.md)

## Problem

Three affordances were missing around mid-work messaging. In the Web composer, a busy ordinary session showed only Stop — a pointer user could not queue a typed draft or send it into the running turn without knowing the keyboard preference. The queue dock's per-row steer action was labeled "Steer" (插话发送), which does not read as "send this now". And for employees, nothing told the orchestrator that every `delegate_employee` call opens a fresh conversation, so in practice follow-ups piled into one long-lived chat, and `send_message` could only park behind an employee's running turn — no way to redirect work immediately.

## Decision

**The composer shows the choice.** While an ordinary session runs with a non-empty draft, `InputBar` renders two ghost controls beside Stop: Queue (`排队发送（本轮结束后送达）`, machine queue mode) and Send now (`立即发送（打断当前轮次）`, new `InputActions.submitNow()` → steer mode). Continuable children expose neither button; idle sessions keep the single Send.

**One vocabulary: "Send now".** The dock's per-row action, the whole-queue gesture copy, the Settings busy-Enter option (`settings.enter.steer`), and the failure toasts all rename Steer → 立即发送 / Send now. Keys keep their `queue.steer*` names to limit churn.

**Immediate parent→child delivery.** `send_message` gains `deliver: "queued" | "now"` (default queued). `"now"` interrupts the child's current turn via the existing ancestor authority, waits bounded (10 s cap) on the live Agent registry (`agents` is now injected) for the driver to settle, then admits the message as a waking turn; timeout degrades to the queued path and reports `queued`. The output schema carries the resolved `delivered` mode and the render states it.

**One task per employee chat.** Every `delegate_employee` call already opened a NEW continuable child; the default orchestrator prompt (both host and client copies) and the tool description now say so explicitly: new task → new chat, `send_message` only extends the same task's chat.

## Alternatives considered

**A compose-time modal choosing queue vs send.** Rejected: the keyboard policy already owns gesture defaults; two visible buttons are reversible and discoverable without blocking input.

**Service-level steer inside `subagents.followup`.** Rejected: the service's FIFO contract stays intact; composing interrupt+followup at the tool keeps the authority checks where they live today and degrades gracefully.

**A `new_chat` flag on delegate_employee.** Pointless — each call already spawns a fresh child; the gap was documentation and prompt guidance, not mechanics.

## Consequences

Busy-state pointer parity with the keyboard; "steer" survives only as internal naming. Immediate redirection can cut short work an employee was mid-way through — that is its purpose — and the 10 s settle cap bounds the tool call when a child ignores cancellation. Repairing ui-botforge's project reference exposed latent type errors there (missing css-modules declaration, catalog fixture drift, dock narrowing); fixed, the client graph typechecks end to end again.
