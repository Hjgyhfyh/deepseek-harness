/**
 * Agent preset leftover chrome: creator dash on hover/focus, retry ring.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../src/client/AgentPresetSection.module.css', import.meta.url)),
  'utf8',
)

function declarationsFrom(source: string, selector: string): Map<string, string> | undefined {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const found = new Map<string, string>()
  for (const [, selectorList = '', body = ''] of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectorList.split(',').map(value => value.trim()).includes(selector)) continue
    for (const part of body.split(';')) {
      const colon = part.indexOf(':')
      if (colon === -1) continue
      found.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim().replace(/\s+/g, ' '))
    }
  }
  return found.size === 0 ? undefined : found
}

describe('agent preset leftover keyboard chrome', () => {
  it('paints the creator dash blue on hover and keyboard focus, with the product ring', () => {
    const blue = 'var(--dsw-alias-state-business-primary)'
    const ring = 'var(--dsw-shadow-focus-ring)'
    expect(declarationsFrom(css, '.creatorButton:hover:not(:disabled)')?.get('border-color')).toBe(blue)
    expect(declarationsFrom(css, '.creatorButton:focus-visible:not(:disabled)')?.get('border-color')).toBe(blue)
    expect(declarationsFrom(css, '.creatorButton:focus-visible:not(:disabled)')?.get('box-shadow')).toBe(ring)
    expect(declarationsFrom(css, '.secondaryButton:focus-visible')?.get('box-shadow')).toBe(ring)
  })

  it('paints row actions primary on keyboard focus, matching hover', () => {
    expect(declarationsFrom(css, '.iconButton:hover:not(:disabled)')?.get('color')).toBe(
      'var(--dsw-alias-label-primary)',
    )
    expect(declarationsFrom(css, '.iconButton:focus-visible:not(:disabled)')?.get('color')).toBe(
      'var(--dsw-alias-label-primary)',
    )
    expect(declarationsFrom(css, '.iconButton:focus-visible')?.get('box-shadow')).toBe(
      'var(--dsw-shadow-focus-ring)',
    )
  })

  it('paints the delete action danger on keyboard focus, matching hover', () => {
    expect(declarationsFrom(css, '.iconDanger:hover:not(:disabled)')?.get('color')).toBe(
      'var(--dsw-alias-state-error-primary)',
    )
    expect(declarationsFrom(css, '.iconDanger:focus-visible:not(:disabled)')?.get('color')).toBe(
      'var(--dsw-alias-state-error-primary)',
    )
  })
})
