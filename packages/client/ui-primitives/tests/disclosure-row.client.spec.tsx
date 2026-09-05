// @vitest-environment jsdom
/**
 * Shared disclosure header: Enter/Space toggle, Escape collapse, and that a
 * closed or forced-open row leaves Escape alone.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DisclosureRow } from '../src/DisclosureRow.tsx'

afterEach(cleanup)

function Row({
  expandOnRowClick = true,
  expandable = true,
}: {
  expandOnRowClick?: boolean
  expandable?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <DisclosureRow
      icon={<span>i</span>}
      title="Think"
      open={expandable ? open : true}
      expandable={expandable}
      expandOnRowClick={expandOnRowClick}
      onToggle={() => { setOpen(value => !value) }}
    >
      <button type="button">inside</button>
    </DisclosureRow>
  )
}

describe('DisclosureRow', () => {
  it('opens with Enter and Space on a whole-row disclosure', () => {
    render(<Row />)
    const row = screen.getByRole('button', { name: /Think/ })
    expect(row.getAttribute('aria-expanded')).toBe('false')
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(row.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(row, { key: ' ' })
    expect(row.getAttribute('aria-expanded')).toBe('false')
  })

  it('Escape collapses an open row and restores focus from nested chrome', () => {
    render(<Row />)
    const row = screen.getByRole('button', { name: /Think/ })
    fireEvent.keyDown(row, { key: 'Escape' })
    expect(row.getAttribute('aria-expanded')).toBe('false')

    fireEvent.keyDown(row, { key: 'Enter' })
    expect(row.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(row, { key: 'Escape' })
    expect(row.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(row)

    fireEvent.keyDown(row, { key: 'Enter' })
    const inside = screen.getByRole('button', { name: 'inside' })
    inside.focus()
    fireEvent.keyDown(inside, { key: 'Escape' })
    expect(row.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(row)
    expect(screen.queryByRole('button', { name: 'inside' })).toBeNull()
  })

  it('Escape on the leading control collapses a header-only disclosure', () => {
    render(<Row expandOnRowClick={false} />)
    const leading = screen.getByRole('button')
    expect(leading.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(leading)
    expect(leading.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(leading, { key: 'Escape' })
    expect(leading.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(leading)
  })

  it('does not toggle a forced-open row on Escape', () => {
    const onToggle = vi.fn()
    render(
      <DisclosureRow icon={<span>i</span>} title="Run" open expandable={false} onToggle={onToggle}>
        <span>body</span>
      </DisclosureRow>,
    )
    fireEvent.keyDown(screen.getByText('Run'), { key: 'Escape' })
    expect(onToggle).not.toHaveBeenCalled()
    expect(screen.getByText('body')).toBeTruthy()
  })
})
