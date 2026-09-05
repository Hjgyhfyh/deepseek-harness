/**
 * Inventory cards: product ring on the card so overflow clipping cannot hide it.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../src/client/PluginInventorySettingsTab.module.css', import.meta.url)),
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

describe('plugin inventory card keyboard chrome', () => {
  it('paints the product ring on the card, including while open', () => {
    const ring = 'var(--dsw-shadow-focus-ring)'
    expect(declarationsFrom(css, '.card:has(.cardContent:focus-visible)')?.get('box-shadow')).toBe(ring)
    expect(declarationsFrom(css, '.card[data-open=\'true\']:has(.cardContent:focus-visible)')?.get('box-shadow')).toBe(ring)
    expect(declarationsFrom(css, '.cardContent:focus-visible')?.get('box-shadow')).toBeUndefined()
  })

  it('paints the chevron secondary on hover and keyboard focus', () => {
    const secondary = 'var(--dsw-alias-label-secondary)'
    expect(declarationsFrom(css, '.cardContent:hover .chevron')?.get('color')).toBe(secondary)
    expect(declarationsFrom(css, '.card:has(.cardContent:focus-visible) .chevron')?.get('color')).toBe(secondary)
  })
})
