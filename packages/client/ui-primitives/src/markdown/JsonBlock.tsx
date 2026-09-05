// JsonBlock: collapsible JSON block (conversation side; independent from the RPC panel's PayloadJson to avoid cross-panel coupling).

import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import css from './JsonBlock.module.css'

const MAX_CHARS = 20_000

/** Default truncation footer; the owner passes a localized formatter. */
function defaultTruncatedLabel(total: number): string {
  return `… 已截断，共 ${total} 字符`
}

export function JsonBlock({ label, payload, defaultOpen = false, truncatedLabel = defaultTruncatedLabel }: {
  label: string
  payload: unknown
  defaultOpen?: boolean
  /** Footer appended when the body exceeds the char cap, given the full length (this package is cordis-free, so copy arrives via props). */
  truncatedLabel?: ((total: number) => string) | undefined
}) {
  const [open, setOpen] = useState(defaultOpen)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const body = useMemo(() => {
    if (!open) return ''
    let s: string
    try {
      // lib typing hides stringify's undefined arm (undefined/function/symbol payloads).
      // oxlint-disable-next-line typescript/no-unnecessary-condition
      s = JSON.stringify(payload, null, 2) ?? String(payload)
    } catch {
      s = String(payload)
    }
    return s.length > MAX_CHARS ? `${s.slice(0, MAX_CHARS)}\n${truncatedLabel(s.length)}` : s
  }, [open, payload, truncatedLabel])
  // In-flow disclosure, not an overlay: Escape only while the body is
  // showing, so a later dialog still wins the first key. Closed blocks ignore
  // it. A nested control that already handled the key keeps the body open.
  const collapseFromEscape = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape' || event.defaultPrevented || !open) return
    event.preventDefault()
    setOpen(false)
    toggleRef.current?.focus()
  }
  return (
    <div className={css.root} onKeyDown={collapseFromEscape}>
      <button
        ref={toggleRef}
        type="button"
        className={css.toggle}
        aria-expanded={open}
        onClick={() => { setOpen(v => !v) }}
      >
        {open ? '▾' : '▸'} {label}
      </button>
      {open && <pre className={css.body}>{body}</pre>}
    </div>
  )
}
