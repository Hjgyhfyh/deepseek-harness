# Agent Note: IMAP FETCH 接受 BODY nstring 前的 RFC 空格

Status: implemented

[English](2026-08-24-imap-fetch-body-nstring-spacing.md) | 中文

## 问题

对真实 Dovecot 调用 `mail_codes` / `mail_list_recent` 时登录已成功，随后失败并报 `IMAP FETCH response carried 0 of 1 expected section literals`。RFC 3501 的 `msg-att-static` 是 `BODY SP "[" section "]" SP nstring`。Dovecot 发出该空格（`BODY[HEADER.FIELDS (FROM SUBJECT DATE)] {123}`）。客户端要求无空格的 `]{n}`，因此一份已读完 literal 的合法 FETCH 仍被计为零个 section。

## 决策

`readFetchedMessage` 允许 `BODY[…]` 与 `{n}` 之间有可选空格。紧贴的 `]{n}` 仍然有效。`packages/mail/mail-imap/tests/helpers/fake-imap-server.ts` 中的夹具发出 Dovecot 空格，使测试钉住生产线上的帧格式。

## 测试

`packages/mail/mail-imap/tests/imap.spec.ts` 列出带 `INTERNALDATE` 且 `{n}` 前有空格的 FETCH，并在 `fetchSections` 为 1 且 FETCH 没有 BODY nstring 时断言 `MAIL_PROVIDER_ERROR`。

## 考虑过的替代方案

**解析 FETCH nstring 的全部形式（NIL、quoted、literal）。** 此次修复否决：Dovecot 对这些 PEEK section 返回 `{n}` literal。若其他服务器发出 quoted/NIL，仍作为后续缺口。

**把 FETCH 改成不带 `HEADER.FIELDS` 的 `BODY.PEEK[HEADER]`。** 否决：失败点是帧格式，不是 section 名。Dovecot 对该请求已经返回 `BODY[HEADER.FIELDS (…)]`。

## 后果

对 Dovecot 2.3 的列表和 `mail_codes` 可以工作。仍发送 NIL 或 quoted BODY nstring 的服务器会继续报同一错误。正在运行的 `dsh web` 进程必须重启才能加载解析器改动。
