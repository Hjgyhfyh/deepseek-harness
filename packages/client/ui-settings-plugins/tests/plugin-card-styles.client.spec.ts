/**
 * Plugin configuration cards: product ring on the card while it contains focus.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/PluginCard.module.css', import.meta.url)), 'utf8')

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

describe('plugin configuration card keyboard chrome', () => {
  it('paints the product ring on the card and darkens the chevron on header focus', () => {
    expect(declarationsFrom(css, '.card:focus-within')?.get('box-shadow')).toBe('var(--dsw-shadow-focus-ring)')
    expect(declarationsFrom(css, '.header:focus-visible')?.get('box-shadow')).toBeUndefined()
    expect(declarationsFrom(css, '.header:focus-visible .chevron')?.get('color')).toBe(
      'var(--dsw-alias-label-secondary)',
    )
  })
})
