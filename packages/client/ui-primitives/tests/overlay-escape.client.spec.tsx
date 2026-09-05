// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { subscribeOverlayEscape } from '../src/overlay-escape.ts'
import { useOverlayEscape } from '../src/useOverlayEscape.ts'

afterEach(cleanup)

describe('subscribeOverlayEscape', () => {
  it('the top frame handles Escape; a lower frame waits; non-Escape is ignored', () => {
    const lower = vi.fn()
    const upper = vi.fn()
    const releaseLower = subscribeOverlayEscape(lower)
    const releaseUpper = subscribeOverlayEscape(upper)
    const ignored = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    document.dispatchEvent(ignored)
    expect(ignored.defaultPrevented).toBe(false)
    expect(lower).not.toHaveBeenCalled()
    expect(upper).not.toHaveBeenCalled()
    const first = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.dispatchEvent(first)
    expect(first.defaultPrevented).toBe(true)
    expect(upper).toHaveBeenCalledTimes(1)
    expect(lower).not.toHaveBeenCalled()
    releaseUpper()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(lower).toHaveBeenCalledTimes(1)
    releaseLower()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(lower).toHaveBeenCalledTimes(1)
  })

  it('a middle-frame release leaves the new top in charge; a second release is a no-op', () => {
    const bottom = vi.fn()
    const middle = vi.fn()
    const top = vi.fn()
    const releaseBottom = subscribeOverlayEscape(bottom)
    const releaseMiddle = subscribeOverlayEscape(middle)
    const releaseTop = subscribeOverlayEscape(top)
    releaseMiddle()
    releaseMiddle()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(top).toHaveBeenCalledTimes(1)
    expect(middle).not.toHaveBeenCalled()
    expect(bottom).not.toHaveBeenCalled()
    releaseTop()
    releaseBottom()
  })

  it('leaves Escape that already had default prevented', () => {
    const close = vi.fn()
    const release = subscribeOverlayEscape(close)
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    event.preventDefault()
    document.dispatchEvent(event)
    expect(close).not.toHaveBeenCalled()
    release()
  })
})

describe('useOverlayEscape', () => {
  it('subscribes only while active and follows a replaced onClose', () => {
    const first = vi.fn()
    const second = vi.fn()
    function Probe({ active, onClose }: { active: boolean; onClose: () => void }) {
      useOverlayEscape(active, onClose)
      return null
    }
    const view = render(<Probe active={false} onClose={first} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(first).not.toHaveBeenCalled()
    view.rerender(<Probe active onClose={first} />)
    view.rerender(<Probe active onClose={second} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    view.rerender(<Probe active={false} onClose={second} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('a parent onClose identity change does not steal the stack from a later overlay', () => {
    const parent = vi.fn()
    const child = vi.fn()
    function Host({ parentClose }: { parentClose: () => void }) {
      useOverlayEscape(true, parentClose)
      useOverlayEscape(true, child)
      return null
    }
    const view = render(<Host parentClose={parent} />)
    view.rerender(<Host parentClose={() => { parent() }} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(child).toHaveBeenCalledTimes(1)
    expect(parent).not.toHaveBeenCalled()
  })
})
