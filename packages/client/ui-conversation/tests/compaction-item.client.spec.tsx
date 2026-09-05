// @vitest-environment jsdom
/**
 * Compaction marker: Escape collapses an open summary, a closed marker
 * ignores the key, and a nested preventDefault leaves the summary open.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { CompactionSummaryNode } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { CompactionItem } from '../src/client/chat/CompactionItem.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh)

function node(over: Partial<CompactionSummaryNode> = {}): CompactionSummaryNode {
  return {
    kind: 'compaction',
    seq: 8,
    time: 8_000,
    summary: '## 压缩摘要\n\n保留的事实。',
    summaryEventSeq: 7,
    shadowedItemCount: 16,
    shadowedTokenCount: 11_309,
    ...over,
  }
}

describe('CompactionItem', () => {
  it('Escape collapses an open summary and restores button focus', () => {
    render(<CompactionItem node={node()} t={t} />)
    const button = screen.getByRole('button')
    button.focus()
    fireEvent.keyDown(button, { key: 'Escape' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.keyDown(button, { key: 'a' })
    expect(button.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('保留的事实。')).toBeTruthy()
    fireEvent.keyDown(button, { key: 'Escape' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button)
    expect(screen.queryByText('保留的事实。')).toBeNull()
  })

  it('Escape that a nested field already handled leaves the summary open', () => {
    render(<CompactionItem node={node()} t={t} />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    button.focus()
    button.addEventListener('keydown', (event) => { event.preventDefault() }, true)
    fireEvent.keyDown(button, { key: 'Escape' })
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('保留的事实。')).toBeTruthy()
    expect(document.activeElement).toBe(button)
  })
})
