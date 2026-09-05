/**
 * AttachmentRail keyboard chrome: thumbnails, remove, and paging arrows use
 * the product focus ring; arrows match hover fill on keyboard focus.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/AttachmentRail.module.css', import.meta.url)), 'utf8')

function declarations(selector: string): Map<string, string> | undefined {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
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

describe('AttachmentRail.module.css keyboard chrome', () => {
  it('uses the product focus ring on thumbnails, remove, and arrows', () => {
    const ring = 'var(--dsw-shadow-focus-ring)'
    expect(declarations('.thumbnail:focus-visible')?.get('box-shadow')).toBe(ring)
    expect(declarations('.remove:focus-visible')?.get('box-shadow')).toBe(ring)
    expect(declarations('.arrow:focus-visible')?.get('box-shadow')).toBe(ring)
  })

  it('paints paging arrows to match hover on keyboard focus', () => {
    expect(declarations('.arrow:hover')?.get('background')).toBe('var(--dsw-alias-interactive-bg-hover-solid)')
    expect(declarations('.arrow:focus-visible')?.get('background')).toBe('var(--dsw-alias-interactive-bg-hover-solid)')
  })
})
