# Agent Note: IMAP FETCH accepts RFC SP before BODY nstrings

Status: implemented

English | [中文](2026-08-24-imap-fetch-body-nstring-spacing.zh.md)

## Problem

`mail_codes` / `mail_list_recent` against live Dovecot authenticated, then failed with `IMAP FETCH response carried 0 of 1 expected section literals`. RFC 3501 `msg-att-static` is `BODY SP "[" section "]" SP nstring`. Dovecot emits that SP (`BODY[HEADER.FIELDS (FROM SUBJECT DATE)] {123}`). The client required `]{n}` with no SP, so a valid FETCH with a consumed literal still counted as zero sections.

## Decision

`readFetchedMessage` accepts optional SP between `BODY[…]` and `{n}`. Glued `]{n}` remains valid. Fixtures in `packages/mail/mail-imap/tests/helpers/fake-imap-server.ts` emit the Dovecot SP so the suite pins the production wire shape.

## Testing

`packages/mail/mail-imap/tests/imap.spec.ts` lists a FETCH that includes `INTERNALDATE` plus SP-before-literal, and asserts `MAIL_PROVIDER_ERROR` when `fetchSections` is 1 and the FETCH has no BODY nstring.

## Alternatives considered

**Parse every FETCH nstring form (NIL, quoted, literal).** Rejected for this fix: Dovecot returns `{n}` literals for these PEEK sections. Quoted/NIL remains a later gap if a server emits it.

**Rewrite FETCH to `BODY.PEEK[HEADER]` without `HEADER.FIELDS`.** Rejected: the failure was framing, not the section name. Dovecot already returns `BODY[HEADER.FIELDS (…)]` for that request.

## Consequences

Listing and `mail_codes` work against Dovecot 2.3. Servers that send NIL or quoted BODY nstrings still fail the same error. The running `dsh web` process must restart to load the parser change.
